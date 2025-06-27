const express = require('express');
const router = express.Router();
const { headStatus, getAudio } = require('../controllers/dictionaryController');

// HEAD local: /api/audio → usado por UptimeRobot
router.head('/', headStatus);

// GET: /api/audio/:word
router.get('/:word', getAudio);

module.exports = router;
