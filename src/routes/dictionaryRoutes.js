const express = require('express');
const router = express.Router();
const { headStatus, getWord } = require('../controllers/dictionaryController');
const validateWordParam = require('../middlewares/validateWordParam');

router.head('/', headStatus);
router.get('/:word', validateWordParam, getWord);

module.exports = router;
