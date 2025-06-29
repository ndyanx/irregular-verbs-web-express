const { fetchAudioData } = require('../services/wordScraper');

const headStatus = (req, res) => {
  res.status(200).json({ message: 'Service is running' });
};

const getAudio = async (req, res) => {
  const { word } = req.params;
  try {
    const data = await fetchAudioData(word);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

module.exports = { headStatus, getAudio };
