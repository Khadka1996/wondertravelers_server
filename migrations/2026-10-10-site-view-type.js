// migrations/2026-10-10-site-view-type.js
// Page views the website reported (/en/..., /ne/...) get their own type, so the
// analytics overview never scans the old tracker's API-call rows.
//   node migrations/2026-10-10-site-view-type.js [--apply]
import 'dotenv/config';
import mongoose from 'mongoose';

const apply = process.argv.includes('--apply');
await mongoose.connect(process.env.MONGO_URI);
const analytics = mongoose.connection.db.collection('analytics');
const filter = { type: 'page_view', path: /^\/(en|ne)(\/|$)/ };
const count = await analytics.countDocuments(filter);
if (apply) await analytics.updateMany(filter, { $set: { type: 'site_view' } });
console.log(`analytics: ${count} website page views ${apply ? 'relabelled site_view' : '(dry run)'}`);
await mongoose.disconnect();
