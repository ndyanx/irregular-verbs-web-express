const express = require('express');
const router = express.Router();
const { headStatus, getAudio } = require('../controllers/dictionaryController');

// HEAD local: /api/audio → usado por UptimeRobot
router.head('/', headStatus);

// GET: /api/audio/:accent/:word
router.get('/:accent/:word', getAudio);

module.exports = router;
