const axios = require('axios');
const cheerio = require('cheerio');
const { getFromCache, setToCache } = require('./audioCache');

// Headers para evitar bloqueos
const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0',
  'sec-ch-ua': '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
  'sec-ch-ua-platform': '"Windows"',
  'Accept-Language': 'en-US,en;q=0.9',
});

// Valida que el link funcione
const validateAudioUrl = async (url) => {
  try {
    const response = await axios.head(url, { headers: getHeaders(), timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
};

// Oxford US
const tryOxfordUS = async (word) => {
  const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);

  const div = $('div.phons_n_am div.sound.audio_play_button.pron-us.icon-audio').first();
  const ogg = div.attr('data-src-ogg');

  console.log('OGG URL (Oxford US):', ogg);
  if (!ogg) throw new Error('OGG audio not found in Oxford (US)');
  return ogg;
};

// Oxford UK
const tryOxfordUK = async (word) => {
  const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);

  const div = $('div.phons_br div.sound.audio_play_button.pron-uk.icon-audio').first();
  const ogg = div.attr('data-src-ogg');

  console.log('OGG URL (Oxford UK):', ogg);
  if (!ogg) throw new Error('OGG audio not found in Oxford (UK)');
  return ogg;
};

// Cambridge US
const tryCambridgeUS = async (word) => {
  const url = `https://dictionary.cambridge.org/dictionary/english-spanish/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);

  const title = $('title').text().trim();
  if (!title.toLowerCase().startsWith(word.toLowerCase())) {
    throw new Error(`Word not found in Cambridge (US): ${word}`);
  }

  if ($('span.us.dloc').length === 0) {
    throw new Error('No US pronunciation found in Cambridge');
  }

  const source = $(`audio#audio2 source[type="audio/ogg"]`).attr('src');
  const ogg = `https://dictionary.cambridge.org${source}`;

  if (!source) throw new Error('Audio source not found (US)');
  console.log('OGG URL (Cambridge US):', ogg);
  return ogg;
};

// Cambridge UK
const tryCambridgeUK = async (word) => {
  const url = `https://dictionary.cambridge.org/dictionary/english-spanish/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);

  const title = $('title').text().trim();
  if (!title.toLowerCase().startsWith(word.toLowerCase())) {
    throw new Error(`Word not found in Cambridge (UK): ${word}`);
  }

  if ($('span.uk.dloc').length === 0) {
    throw new Error('No UK pronunciation found in Cambridge');
  }

  const source = $(`audio#audio1 source[type="audio/ogg"]`).attr('src');
  const ogg = `https://dictionary.cambridge.org${source}`;

  if (!source) throw new Error('Audio source not found (UK)');
  console.log('OGG URL (Cambridge UK):', ogg);
  return ogg;
};

// FUNCIÓN PRINCIPAL
async function fetchAudioUrl(accent, word) {
  word = word.toLowerCase().trim().replace(/[^a-z]/g, '-');

  // 1. Verificar en caché
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

  // 2. Scraping
  let audioUrl = null;

  // Primero Oxford
  try {
    if (accent === 'us') {
      audioUrl = await tryOxfordUS(word);
    } else if (accent === 'uk') {
      audioUrl = await tryOxfordUK(word);
    }
  } catch (err) {
    console.warn('[Oxford ERROR]', err.message);
  }

  // Fallback a Cambridge
  if (!audioUrl) {
    try {
      if (accent === 'us') {
        audioUrl = await tryCambridgeUS(word);
      } else if (accent === 'uk') {
        audioUrl = await tryCambridgeUK(word);
      }
    } catch (err) {
      console.warn('[Cambridge ERROR]', err.message);
      throw new Error(`No se pudo obtener el audio para "${word}" (${accent})`);
    }
  }

  // 3. Guardar en caché
  setToCache(word, accent, audioUrl);
  return audioUrl;
}

module.exports = { fetchAudioUrl };
