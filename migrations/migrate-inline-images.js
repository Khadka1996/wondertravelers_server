// migrations/migrate-inline-images.js
// One-off: move base64 images stored inside documents into uploads/ files.
//   node migrations/migrate-inline-images.js           -> dry run (counts only)
//   node migrations/migrate-inline-images.js --apply   -> write files + update documents
// Run from the server folder (uploads/ is resolved from the working directory).
// Safe to re-run: file names are content hashes and only data: URLs are touched.

import 'dotenv/config';
import mongoose from 'mongoose';
import { replaceInlineImages, resolveImageObjects } from '../src/utils/inline-images.util.js';

const apply = process.argv.includes('--apply');

const JOBS = [
  { collection: 'blogs', folder: 'blogs', html: ['content'], images: [] },
  { collection: 'destinations', folder: 'destinations', html: ['longDesc'], images: ['image', 'gallery'] },
  { collection: 'advertisements', folder: 'advertisements', html: [], images: ['image'] },
];

const hasInline = (value) => JSON.stringify(value ?? '').includes('data:image');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  for (const job of JOBS) {
    const fields = [...job.html, ...job.images];
    const filter = { $or: fields.map((field) => ({ [field]: { $exists: true } })) };
    const cursor = db.collection(job.collection).find(filter, { projection: Object.fromEntries(fields.map((f) => [f, 1])) });

    let affected = 0;
    let bytesBefore = 0;
    let bytesAfter = 0;

    for await (const doc of cursor) {
      if (!fields.some((field) => hasInline(doc[field]))) continue;
      affected += 1;

      const update = {};
      for (const field of job.html) {
        if (!hasInline(doc[field])) continue;
        bytesBefore += doc[field].length;
        update[field] = apply ? await replaceInlineImages(doc[field], job.folder) : doc[field];
        bytesAfter += update[field].length;
      }
      for (const field of job.images) {
        if (!hasInline(doc[field])) continue;
        bytesBefore += JSON.stringify(doc[field]).length;
        update[field] = apply ? await resolveImageObjects(doc[field], job.folder) : doc[field];
        bytesAfter += JSON.stringify(update[field]).length;
      }

      if (apply) {
        const leftover = Object.values(update).some(hasInline);
        await db.collection(job.collection).updateOne({ _id: doc._id }, { $set: update });
        if (leftover) console.warn(`  ${job.collection} ${doc._id}: some images could not be converted (kept inline)`);
      }
    }

    const mb = (n) => (n / 1048576).toFixed(1);
    console.log(
      `${job.collection}: ${affected} documents with inline images, ${mb(bytesBefore)} MB` +
      (apply ? ` -> ${mb(bytesAfter)} MB` : ' (dry run, nothing changed)'),
    );
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
