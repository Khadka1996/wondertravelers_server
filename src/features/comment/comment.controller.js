import Comment from './comment.model.js';
import cache from '../../utils/cache.util.js';
import mongoose from 'mongoose';

/**
 * Get all comments for a blog
 */
export const getCommentsForBlog = async (req, res) => {
  try {
    const blogId = req.params.id || req.params.blogId;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    const comments = await Comment.find({ blog: blogId, status: 'active' })
      .populate('author', '_id name profileImage')
      .sort({ createdAt: -1 })
      .lean();

    console.log('Fetched comments:', {
      count: comments.length,
      sample: comments[0] ? {
        _id: comments[0]._id,
        author: comments[0].author
      } : null
    });

    res.status(200).json({ success: true, data: comments });
  } catch (error) {
    console.error('Error in getCommentsForBlog:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comments. Please try again.' });
  }
};

/**
 * Add a comment to a blog
 */
export const addCommentToBlog = async (req, res) => {
  try {
    const blogId = req.params.id || req.params.blogId;
    const { text } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Comment cannot be empty' });
    }

    const comment = new Comment({
      blog: blogId,
      author: userId,
      content: text.trim(),
      status: 'active'
    });

    await comment.save();
    await comment.populate('author', '_id name profileImage');

    // Invalidate cache
    await cache.del(`comments:blog:${blogId}`);

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    console.error('Error in addCommentToBlog:', error);
    res.status(500).json({ success: false, error: 'Failed to add comment. Please try again.' });
  }
};

/**
 * Delete a comment
 */
export const deleteComment = async (req, res) => {
  try {
    const blogId = req.params.id || req.params.parentId || req.params.blogId;
    const { commentId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, error: 'Invalid comment ID format' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Check if user is comment author or admin
    const isAuthor = comment.author.toString() === userId.toString();
    const isAdmin = req.user?.role === 'admin';
    
    console.log('Delete comment request:', {
      commentId,
      userId: userId.toString(),
      commentAuthorId: comment.author.toString(),
      isAuthor,
      userRole: req.user?.role,
      isAdmin
    });
    
    if (!isAuthor && !isAdmin) {
      console.warn('Unauthorized delete attempt:', { commentId, userId, userRole: req.user?.role });
      return res.status(403).json({ success: false, error: 'You can only delete your own comments' });
    }

    await Comment.findByIdAndDelete(commentId);

    // Invalidate cache
    if (blogId) {
      await cache.del(`comments:blog:${blogId}`);
    }

    console.log('Comment deleted successfully:', { commentId, deletedBy: userId });
    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error in deleteComment:', error);
    res.status(500).json({ success: false, error: 'Failed to delete comment. Please try again.' });
  }
};

/**
 * Update a comment (only author can edit)
 */
export const updateComment = async (req, res) => {
  try {
    const blogId = req.params.id || req.params.parentId || req.params.blogId;
    const { commentId } = req.params;
    const { text } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, error: 'Invalid comment ID format' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Comment cannot be empty' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Check if user is comment author (only authors can edit, not admins)
    const isAuthor = comment.author.toString() === userId.toString();
    
    console.log('Update comment request:', {
      commentId,
      userId: userId.toString(),
      commentAuthorId: comment.author.toString(),
      isAuthor
    });
    
    if (!isAuthor) {
      console.warn('Unauthorized edit attempt:', { commentId, userId });
      return res.status(403).json({ success: false, error: 'You can only edit your own comments' });
    }

    // Update the comment
    comment.content = text.trim();
    await comment.save();
    await comment.populate('author', '_id name profileImage');

    // Invalidate cache
    if (blogId) {
      await cache.del(`comments:blog:${blogId}`);
    }

    console.log('Comment updated successfully:', { commentId, updatedBy: userId });
    res.status(200).json({ success: true, data: comment, message: 'Comment updated successfully' });
  } catch (error) {
    console.error('Error in updateComment:', error);
    res.status(500).json({ success: false, error: 'Failed to update comment. Please try again.' });
  }
}