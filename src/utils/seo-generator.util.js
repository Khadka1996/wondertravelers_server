// src/utils/seo-generator.util.js

/**
 * Slugify string - convert to URL-friendly format
 */
const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 75);
};

/**
 * Generate SEO Title from blog title
 * Format: "{title} | {category}" (max 60 chars for optimal Google display)
 * Google typically shows 50-60 characters on mobile, 60-70 on desktop
 */
const generateSeoTitle = (title, category = '') => {
  let seoTitle = title.trim();
  
  // If too long, truncate intelligently
  if (seoTitle.length > 50) {
    // Try to cut at a word boundary
    const truncated = seoTitle.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 30) {
      seoTitle = truncated.substring(0, lastSpace);
    } else {
      seoTitle = truncated;
    }
  }
  
  // Add category if available and if there's room
  if (category && seoTitle.length < 55) {
    const categoryName = typeof category === 'object' ? category.name : category;
    if (categoryName) {
      const potential = seoTitle + ' | ' + categoryName;
      if (potential.length <= 60) {
        seoTitle = potential;
      }
    }
  }
  
  // Ensure ends with proper punctuation if not already
  if (seoTitle && !seoTitle.match(/[.!?]$/)) {
    seoTitle += '.';
  }
  
  return seoTitle;
};

/**
 * Generate SEO Description from blog content
 * Should be 150-160 characters (Google shows ~155 chars)
 * Extract compelling summary from content
 */
const generateSeoDescription = (title, subHeading, content) => {
  let description = '';
  
  // Strategy 1: Use subHeading if it's a good length (80-160 chars)
  if (subHeading && subHeading.trim().length > 20) {
    const cleanSubHeading = stripHtmlTags(subHeading).trim();
    if (cleanSubHeading.length >= 80 && cleanSubHeading.length <= 160) {
      description = cleanSubHeading;
    } else if (cleanSubHeading.length > 160) {
      description = cleanSubHeading.substring(0, 160).trim() + '...';
    } else if (cleanSubHeading.length > 0) {
      description = cleanSubHeading;
    }
  }
  
  // Strategy 2: Combine title with first sentence
  if (!description && content) {
    const cleanContent = stripHtmlTags(content);
    const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      description = `${title}. ${firstSentence}`;
    }
  }
  
  // Strategy 3: Use first meaningful text from content
  if (!description && content) {
    const cleanContent = stripHtmlTags(content).trim();
    description = cleanContent.substring(0, 160);
  }
  
  // Fallback: Use title + description of content type
  if (!description) {
    description = `Read about ${title} - detailed blog post with insights and information.`;
  }
  
  // Final cleanup and truncation
  description = description.replace(/\s+/g, ' ').trim();
  
  // Truncate at word boundary if > 160
  if (description.length > 160) {
    const truncated = description.substring(0, 160);
    const lastSpace = truncated.lastIndexOf(' ');
    description = truncated.substring(0, lastSpace > 100 ? lastSpace : 160).trim() + '...';
  }
  
  // Ensure proper punctuation
  if (description && !description.match(/[.!?...]$/)) {
    description += '.';
  }
  
  return description;
};

/**
 * Extract and clean HTML tags
 */
const stripHtmlTags = (html) => {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

/**
 * Convert tags array to SEO keywords
 * Tags are perfect as SEO keywords since they're already curated
 * Format: comma-separated, lowercase, unique
 */
const generateSeoKeywords = (tags = [], category = '', title = '') => {
  const keywords = new Set();
  
  // Add tags as primary keywords
  if (Array.isArray(tags) && tags.length > 0) {
    tags.forEach(tag => {
      if (tag && tag.trim()) {
        keywords.add(tag.toLowerCase().trim());
      }
    });
  }
  
  // Add category as keyword
  if (category) {
    const categoryName = typeof category === 'object' ? category.name : category;
    if (categoryName) {
      keywords.add(categoryName.toLowerCase().trim());
    }
  }
  
  // Add main keywords from title
  if (title) {
    const importantWords = title
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 4 && !isCommonWord(word));
    
    importantWords.forEach(word => {
      keywords.add(word);
    });
  }
  
  return Array.from(keywords);
};

/**
 * Check if a word is a common English word (should be excluded from keywords)
 */
const isCommonWord = (word) => {
  const commonWords = new Set([
    'the', 'with', 'this', 'that', 'from', 'have', 'about', 'your', 'more',
    'been', 'very', 'some', 'than', 'also', 'will', 'just', 'such', 'which',
    'these', 'could', 'would', 'should', 'their', 'every', 'there', 'where'
  ]);
  return commonWords.has(word.toLowerCase());
};

/**
 * Generate complete SEO metadata
 */
export const generateSEOMetadata = (blogData) => {
  const {
    title = '',
    subHeading = '',
    content = '',
    tags = [],
    category = null,
    slug = ''
  } = blogData;

  return {
    seoTitle: generateSeoTitle(title, category),
    seoDescription: generateSeoDescription(title, subHeading, content),
    seoKeywords: generateSeoKeywords(tags, category, title),
    slug: slug || slugify(title)
  };
};

/**
 * Export individual generators for granular control
 */
export default {
  generateSeoTitle,
  generateSeoDescription,
  generateSeoKeywords,
  generateSEOMetadata,
  slugify,
  stripHtmlTags
};
