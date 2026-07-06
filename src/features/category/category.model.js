// src/features/category/category.model.js

import mongoose from 'mongoose';

const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: String,
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    color: String,
    postCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const Category = mongoose.model('Category', categorySchema);
export default Category;