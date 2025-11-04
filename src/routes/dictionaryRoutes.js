const express = require('express');
const router = express.Router();
const { headStatus, getWord } = require('../controllers/dictionaryController');
const validateWordParam = require('../middlewares/validateWordParam');

/**
 * Health check endpoint
 * @route HEAD /
 */
router.head('/', headStatus);

/**
 * Get word data
 * @route GET /:word
 * @param {string} word.path.required - Word to look up (letters and hyphens only)
 */
router.get('/:word', validateWordParam, getWord);

module.exports = router;
