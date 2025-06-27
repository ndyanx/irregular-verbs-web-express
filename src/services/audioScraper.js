const axios = require('axios');
const cheerio = require('cheerio');
const { getFromCache, setToCache } = require('./audioCache');

const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0',
  'Accept-Language': 'en-US,en;q=0.9',
});

const fetchCambridgeData = async (word) => {
  const url = `https://dictionary.cambridge.org/dictionary/english-spanish/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);

  const result = {
    word,
    pronunciations: {},
    entries: []
  };

  const pronBlocks = $('span.pron-info.dpron-info');
  const ipaMap = { us: new Set(), uk: new Set() };
  const audioMap = { us: null, uk: null };

  let currentRegion = null;

  pronBlocks.each((_, el) => {
    const block = $(el);
    const regionRaw = block.find('span.region.dreg').first().text().trim().toLowerCase();
    const region = regionRaw === 'us' || regionRaw === 'uk' ? regionRaw : null;

    const ipa = block.find('span.ipa.dipa').first().text().trim();
    const audioSrc = block.find('audio source[type="audio/ogg"]').attr('src');
    const audioUrl = audioSrc ? `https://dictionary.cambridge.org${audioSrc}` : null;

    if (region) currentRegion = region;
    const targetRegion = region || currentRegion;

    if (targetRegion && ipa) {
      ipaMap[targetRegion].add(ipa);
    }

    if (region && audioUrl && !audioMap[region]) {
      audioMap[region] = audioUrl;
    }
  });

  ['us', 'uk'].forEach((region) => {
    const ipaArray = [...ipaMap[region]];
    if (ipaArray.length > 0 || audioMap[region]) {
      result.pronunciations[region] = {
        ipa: ipaArray.join(' - ') || null,
        audioUrl: audioMap[region] || null
      };
    }
  });

  $('div.pr.entry-body__el').each((_, el) => {
    const entry = $(el);
    const pos = entry.find('span.pos.dpos').first().text().trim();
    const cefr = entry.find('span.epp-xref.dxref').first().text().trim() || null;

    const senses = [];

    // Recorremos cada bloque de definición
    entry.find('div.def-block.ddef_block').each((i, defBlock) => {
      const def = $(defBlock).find('div.def.ddef_d').first().text().trim();
      const translation1 = $(defBlock).find('div span.trans.dtrans.dtrans-se').first().text().trim();
      const translation2 = $(defBlock).find('div span.trans.dtrans.dtrans-se span.trans.dtrans').first().text().trim();

      const merged = `${translation1}, ${translation2}`;
      const uniqueParts = [...new Set(
        merged
          .split(',')
          .map(part => part.trim())
          .filter(part => part)
      )];
      const translation = uniqueParts.join(', ');

      const examples = [];

      // Ejemplos dentro del def-block
      $(defBlock).find('div.examp.dexamp').each((_, ex) => {
        const en = $(ex).find('span.eg.deg').text().trim();
        const es = $(ex).find('span.trans.dtrans.hdb').text().trim();
        if (en || es) examples.push({ en, es });
      });

      // Buscar ejemplos extendidos directamente después del defBlock
      // Buscar la sección de ejemplos extendidos asociada a este defBlock
      const siblings = $(defBlock).nextAll();
      for (let j = 0; j < siblings.length; j++) {
        const sib = $(siblings[j]);

        if (sib.hasClass('def-block')) break; // terminó la sección de este sense

        if (sib.hasClass('daccord')) {
          sib.find('li.eg.dexamp.hax').each((_, li) => {
            const en = $(li).text().trim();
            if (en && !examples.some(ex => ex.en === en)) {
              examples.push({ en, es: null });
            }
          });
          break; // solo procesamos el primer daccord encontrado
        }
      }

      if (def) {
        senses.push({ definition: def, translation, examples });
      }
    });

    if (pos && senses.length > 0) {
      result.entries.push({ pos, cefr, senses });
    }
  });

  return result;
};

const validateAudioUrl = async (url) => {
  try {
    const response = await axios.head(url, { headers: getHeaders(), timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
};

async function fetchAudioData(word) {
  word = word.toLowerCase().trim().replace(/[^a-z]/g, '-');

  const cached = await getFromCache(word);

  if (cached) {
    const hasAudio = ['us', 'uk'].some(accent => cached?.pronunciations?.[accent]?.audioUrl);
    const allValid = await Promise.all(
      ['us', 'uk'].map(accent => validateAudioUrl(cached?.pronunciations?.[accent]?.audioUrl || ''))
    );
    if (hasAudio && allValid.some(valid => valid)) {
      console.log(`[CACHE] JSON cargado desde cache para ${word}`);
      return cached;
    }
    console.log(`[CACHE] Alguna URL rota para ${word}, regenerando...`);
  }

  try {
    const result = await fetchCambridgeData(word);
    const hasValidAudio = ['us', 'uk'].some(accent => result?.pronunciations?.[accent]?.audioUrl);
    if (!hasValidAudio) throw new Error('No audio URL found');

    await setToCache(word, result);

    return result;
  } catch (err) {
    console.warn('[SCRAPER ERROR]', err.message);
    throw new Error(`No se pudo obtener los datos para "${word}"`);
  }
}

module.exports = { fetchAudioData };
