// src/features/author/author.model.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const authorSchema = new Schema(
  {
    name: { type: String, required: true },
    bio: { type: String },
    socialLinks: {
      twitter: { type: String },
      linkedin: { type: String },
      website: { type: String },
    },
    profileImage: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Author = mongoose.model('Author', authorSchema);
export default Author;