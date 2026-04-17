// src/features/author/author.controller.js

import Author from './author.model.js';

// Create a new author - requires profileImage
export const createAuthor = async (req, res) => {
  try {
    // Validate that profileImage is provided
    if (!req.body.profileImage) {
      return res.status(400).json({ 
        error: 'Profile image is required. Please upload a photo first.' 
      });
    }

    const author = new Author(req.body);
    await author.save();
    res.status(201).json(author);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all authors
export const getAuthors = async (req, res) => {
  try {
    const authors = await Author.find();
    res.status(200).json(authors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update an author
export const updateAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    const author = await Author.findByIdAndUpdate(id, req.body, { new: true });
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }
    res.status(200).json(author);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete an author
export const deleteAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    const author = await Author.findByIdAndDelete(id);
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }
    res.status(200).json({ message: 'Author deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};