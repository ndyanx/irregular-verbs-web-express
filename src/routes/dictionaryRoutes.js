const express = require('express');
const router = express.Router();
const { headStatus, getAudio } = require('../controllers/dictionaryController');

router.head('/', headStatus);
router.get('/:word', getAudio);

module.exports = router;
