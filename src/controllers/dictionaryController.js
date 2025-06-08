const { fetchAudioUrl } = require('../services/audioScraper');

// HEAD para comprobar disponibilidad
const headStatus = (req, res) => {
  res.status(200).json({ message: 'Service is running' });
};

// Ruta principal de audio
const getAudio = async (req, res) => {
  const { accent, word } = req.params;
  try {
    const audioUrl = await fetchAudioUrl(accent, word);
    res.json({ audioUrl });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

module.exports = {
  headStatus,
  getAudio
};
