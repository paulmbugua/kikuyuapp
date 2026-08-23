// src/modules/bookmark/bookmark.routes.js
const express = require('express');
const router = express.Router();
const bookmarkController = require('./bookmark.controller');
const { protect } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validationMiddleware');
const { validatePostId } = require('../post/post.validation');

// All bookmark routes are protected
router.use(protect);

// Collections
router.get('/collections', bookmarkController.getCollections);

// Bookmarks
router.get('/', bookmarkController.getUserBookmarks);
router.post('/:postId', validatePostId, validate, bookmarkController.bookmarkPost);
router.delete('/:postId', validatePostId, validate, bookmarkController.removeBookmark);
router.put('/:postId/move', validatePostId, validate, bookmarkController.moveToCollection);
router.get('/:postId/check', validatePostId, validate, bookmarkController.checkBookmark);

module.exports = router;