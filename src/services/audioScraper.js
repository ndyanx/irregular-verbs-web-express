const axios = require('axios');
const cheerio = require('cheerio');
const { getFromCache, setToCache } = require('./audioCache');

const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0',
  'sec-ch-ua': '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
  'sec-ch-ua-platform': '"Windows"',
  'Accept-Language': 'en-US,en;q=0.9',
});

const validateAudioUrl = async (url) => {
  try {
    const response = await axios.head(url, {headers: getHeaders(), timeout: 5000});
    return response.status === 200;
  } catch (err) {
    return false;
  }
};

const tryOxfordUS = async (word) => {
  const url = `https://www.oxfordlearnersdictionaries.com/us/definition/american_english/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);
  const div = $('span.pron-g div.sound.audio_play_button.pron-usonly.icon-audio').first();
  const ogg = div.attr('data-src-ogg');
  if (!ogg) throw new Error('OGG audio not found in Oxford');
  return ogg;
};

const tryCambridge = async (accent, word) => {
  const url = `https://dictionary.cambridge.org/dictionary/english-spanish/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);
  const title = $('title').text().trim();

  if (!title.toLowerCase().startsWith(word.toLowerCase())) {
    throw new Error(`Word not found in Cambridge: ${word}`);
  }

  const hasUK = $('span.uk.dloc').length > 0;
  const hasUS = $('span.us.dloc').length > 0;

  if ((accent === 'uk' && !hasUK) || (accent === 'us' && !hasUS)) {
    throw new Error(`No pronunciation for ${accent.toUpperCase()} in Cambridge`);
  }

  const typeId = accent === 'uk' ? 'audio1' : 'audio2';
  const source = $(`audio#${typeId} source[type="audio/ogg"]`).attr('src');
  if (!source) throw new Error('Audio source not found in Cambridge');
  return `https://dictionary.cambridge.org${source}`;
};

// FUNCION PRINCIPAL
async function fetchAudioUrl(accent, word) {
  word = word.toLowerCase().trim();

  // 1. Consultamos memoria
  const cached = getFromCache(word, accent);
  if (cached) {
    const isValid = await validateAudioUrl(cached);
    if (isValid) {
      console.log(`[CACHE] URL cargada desde cache para ${word} (${accent})`);
      return cached;
    } else {
      console.log(`[CACHE] URL rota para ${word} (${accent}), se hará nuevo scraping`);
    }
  }

  // 2. Scraping según preferencia
  let audioUrl = null;
  try {
    if (accent === 'us') {
      audioUrl = await tryOxfordUS(word);
    }
  } catch (err) {
    console.warn('[Oxford ERROR]', err.message);
  }

  if (!audioUrl) {
    audioUrl = await tryCambridge(accent, word);
  }

  // 3. Guardar en memoria y archivo
  setToCache(word, accent, audioUrl);
  return audioUrl;
}

module.exports = { fetchAudioUrl };
