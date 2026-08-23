// src/utils/contentModeration.js
// Simple content moderation utility (can be expanded with AI services)

// List of prohibited words (expand based on requirements)
const prohibitedWords = [
  'spam', 'scam', 'fraud', // Add actual prohibited words
  // This should be loaded from database or external service
];

// Check if content contains prohibited words
const containsProhibitedContent = (text) => {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  return prohibitedWords.some(word => lowerText.includes(word.toLowerCase()));
};

// Validate post content length
const validatePostContent = (content) => {
  const maxLength = 5000;
  const minLength = 1;
  
  if (!content) return { isValid: true }; // Media-only posts are allowed
  
  if (content.length < minLength) {
    return { isValid: false, reason: 'Content is too short' };
  }
  
  if (content.length > maxLength) {
    return { isValid: false, reason: `Content exceeds maximum length of ${maxLength} characters` };
  }
  
  return { isValid: true };
};

// Validate comment content
const validateCommentContent = (content) => {
  const maxLength = 1000;
  const minLength = 1;
  
  if (!content || content.length < minLength) {
    return { isValid: false, reason: 'Comment cannot be empty' };
  }
  
  if (content.length > maxLength) {
    return { isValid: false, reason: `Comment exceeds maximum length of ${maxLength} characters` };
  }
  
  return { isValid: true };
};

// Extract hashtags from content
const extractHashtags = (content) => {
  if (!content) return [];
  
  const hashtagRegex = /#([A-Za-z0-9_]+)/g;
  const matches = content.match(hashtagRegex);
  
  if (!matches) return [];
  
  return matches.map(tag => tag.substring(1).toLowerCase());
};

// Extract mentions from content (@username)
const extractMentions = (content) => {
  if (!content) return [];
  
  const mentionRegex = /@([A-Za-z0-9_]+)/g;
  const matches = content.match(mentionRegex);
  
  if (!matches) return [];
  
  return matches.map(mention => mention.substring(1));
};

// Check if content contains links
const containsLinks = (content) => {
  if (!content) return false;
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return urlRegex.test(content);
};

// Moderate content (combines all checks)
const moderateContent = (content) => {
  const issues = [];
  
  // Check prohibited content
  if (containsProhibitedContent(content)) {
    issues.push('Content contains prohibited words');
  }
  
  // Check excessive links (potential spam)
  if (containsLinks(content)) {
    const links = content.match(/(https?:\/\/[^\s]+)/g) || [];
    if (links.length > 3) {
      issues.push('Too many links in content');
    }
  }
  
  return {
    isClean: issues.length === 0,
    issues,
    needsReview: issues.length > 0
  };
};

module.exports = {
  containsProhibitedContent,
  validatePostContent,
  validateCommentContent,
  extractHashtags,
  extractMentions,
  containsLinks,
  moderateContent
};