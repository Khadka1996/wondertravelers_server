// src/features/video/video.model.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const videoSchema = new Schema(
  {
    videoUrl: {
      type: String,
      required: true,
      trim: true,
      match: [
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/,
        'Please provide a valid YouTube URL'
      ]
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    order: {
      type: Number,
      default: 0,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

// Indexes for performance
videoSchema.index({ isActive: 1, order: 1 });
videoSchema.index({ createdAt: -1 });

// Extract YouTube video ID
videoSchema.methods.getYouTubeId = function() {
  const match = this.videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/);
  return match ? match[1] : null;
};

// Get video thumbnail URL
videoSchema.methods.getThumbnailUrl = function(quality = 'maxresdefault') {
  const videoId = this.getYouTubeId();
  return videoId ? `https://img.youtube.com/vi/${videoId}/${quality}.jpg` : null;
};

// Get embed URL
videoSchema.methods.getEmbedUrl = function() {
  const videoId = this.getYouTubeId();
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

// Get active videos sorted by order
videoSchema.statics.getActiveVideos = async function(limit = 10) {
  return this.find({ isActive: true })
    .select('videoUrl title description order')
    .sort({ order: 1, createdAt: -1 })
    .limit(limit)
    .lean()
    .then(videos => videos.map(video => ({
      ...video,
      embedUrl: `https://www.youtube.com/embed/${video.videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/)?.[1]}`
    })));
};

// Get all videos for admin
videoSchema.statics.getAllVideosAdmin = async function() {
  return this.find()
    .select('videoUrl title description order isActive createdAt')
    .sort({ order: 1 })
    .lean();
};

const Video = mongoose.model('Video', videoSchema);

export default Video;
