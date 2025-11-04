const { fetchAudioData } = require('../services/wordScraper');

/**
 * Health check endpoint
 * @route GET /api/status
 */
const headStatus = (req, res) => {
  res.status(200).json({ message: 'Service is running' });
};

/**
 * Gets word data including pronunciation and examples
 * @route GET /api/word/:word
 * @param {string} word - Word to look up
 * @returns {Object} Word data with pronunciations and examples
 */
const getWord = async (req, res) => {
  const { word } = req.params;
  try {
    const data = await fetchAudioData(word);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

module.exports = { headStatus, getWord };
