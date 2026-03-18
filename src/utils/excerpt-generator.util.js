// src/utils/excerpt-generator.util.js

/**
 * Capitalize first letter of a string
 */
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Remove HTML tags from string
 */
const stripHtmlTags = (html) => {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace HTML entities
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

/**
 * Extract key phrase from title
 * Example: "Top 10 Amazing Places in Nepal" → "Amazing Places in Nepal"
 */
const extractKeyPhrase = (title) => {
  if (!title) return '';
  
  // Remove common prefixes and numbers
  let cleaned = title
    .replace(/^(top|best|amazing|incredible|ultimate|the\s+)/gi, '')
    .replace(/^\d+\s+/g, '') // Remove leading numbers like "10"
    .replace(/\s*tips?$|guide$|tutorial$|how\s+to\s+/gi, '') // Remove common suffixes
    .trim();
  
  return cleaned || title;
};

/**
 * Get the first meaningful sentence from content
 */
const getFirstSentence = (content, maxLength = 100) => {
  const cleanContent = stripHtmlTags(content);
  const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length === 0) return '';
  
  let firstSentence = sentences[0].trim();
  
  // Truncate if too long
  if (firstSentence.length > maxLength) {
    firstSentence = firstSentence.substring(0, maxLength).trim() + '...';
  }
  
  return firstSentence;
};

/**
 * Main excerpt generation algorithm
 * Uses multiple strategies to create a compelling excerpt
 */
export const generateExcerpt = (title, subHeading, content) => {
  let excerpt = '';
  
  // Strategy 1: Use subHeading if available and meaningful
  if (subHeading && subHeading.trim().length > 10) {
    excerpt = stripHtmlTags(subHeading).trim();
    if (excerpt.length > 160) {
      excerpt = excerpt.substring(0, 160).trim() + '...';
    }
    return excerpt;
  }
  
  // Strategy 2: Create from title + first sentence
  if (title && content) {
    const keyPhrase = extractKeyPhrase(title);
    const firstSentence = getFirstSentence(content, 100);
    
    if (firstSentence) {
      // Combine key phrase with first sentence
      excerpt = `${capitalize(keyPhrase)}. ${firstSentence}`;
    } else {
      // Just use key phrase
      excerpt = capitalize(keyPhrase) + '.';
    }
  }
  
  // Strategy 3: Use just the first few sentences
  if (!excerpt && content) {
    const cleanContent = stripHtmlTags(content);
    const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let combined = '';
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (combined.length + sentence.length + 2 <= 160) {
        combined += (combined ? ' ' : '') + sentence + '.';
      } else {
        break;
      }
    }
    
    excerpt = combined || sentences[0]?.trim() + '.' || '';
  }
  
  // Strategy 4: Fallback - process title
  if (!excerpt && title) {
    excerpt = capitalize(extractKeyPhrase(title)) + '.';
  }
  
  // Final cleanup and truncation
  excerpt = excerpt.trim();
  if (excerpt.length > 160) {
    // Truncate at word boundary
    const truncated = excerpt.substring(0, 160);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    excerpt = truncated.substring(0, lastSpaceIndex > 100 ? lastSpaceIndex : 160).trim() + '...';
  }
  
  // Remove multiple spaces
  excerpt = excerpt.replace(/\s+/g, ' ').trim();
  
  // Ensure it ends with proper punctuation
  if (excerpt && !excerpt.match(/[.!?]$/)) {
    excerpt += '.';
  }
  
  return excerpt;
};

export default {
  generateExcerpt,
  stripHtmlTags,
  extractKeyPhrase,
  getFirstSentence,
  capitalize,
};
