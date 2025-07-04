const axios = require('axios');
const cheerio = require('cheerio');
const { getFromCache, setToCache } = require('./wordCache');

const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0',
  'Accept-Language': 'en-US,en;q=0.9',
});

function extractExtraExamples($, container, examples) {
  $(container).find('li.eg.dexamp.hax').each((_, li) => {
    const en = $(li).text().trim();
    if (en && !examples.some(ex => ex.en === en)) {
      examples.push({ en, es: null });
    }
  });
}

async function fetchCambridgeAudioAndExamplesFromEnglish(word) {
  const url = `https://dictionary.cambridge.org/dictionary/english/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);

  const ipaMap = { us: new Set(), uk: new Set() };
  const audioMap = { us: null, uk: null };

  ['us', 'uk'].forEach(region => {
    const selector = `span.${region}.dpron-i`;
    const block = $(selector).first();
    if (block.length > 0) {
      const ipa = block.find('span.ipa.dipa').first().text().trim();
      const audioSrc = block.find('audio source[type="audio/ogg"]').attr('src');
      const audioUrl = audioSrc ? `https://dictionary.cambridge.org${audioSrc}` : null;
      if (ipa) ipaMap[region].add(ipa);
      if (audioUrl) audioMap[region] = audioUrl;
    }
  });

  return { ipaMap, audioMap };
}

const fetchCambridgeData = async (word) => {
  const url = `https://dictionary.cambridge.org/dictionary/english-spanish/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);

  const result = {
    word,
    pronunciations: {},
    entries: []
  };

  const ipaMap = { us: new Set(), uk: new Set() };
  const audioMap = { us: null, uk: null };
  let currentRegion = null;

  $('span.pron-info.dpron-info').each((_, el) => {
    const block = $(el);
    const regionRaw = block.find('span.region.dreg').first().text().trim().toLowerCase();
    const region = regionRaw === 'us' || regionRaw === 'uk' ? regionRaw : null;
    const ipa = block.find('span.ipa.dipa').first().text().trim();
    const audioSrc = block.find('audio source[type="audio/ogg"]').attr('src');
    const audioUrl = audioSrc ? `https://dictionary.cambridge.org${audioSrc}` : null;
    if (region) currentRegion = region;
    const targetRegion = region || currentRegion;
    if (targetRegion && ipa) ipaMap[targetRegion].add(ipa);
    if (region && audioUrl && !audioMap[region]) audioMap[region] = audioUrl;
  });

  const needsFallback = !audioMap.us && !audioMap.uk;
  let fallback = null;
  if (needsFallback) {
    fallback = await fetchCambridgeAudioAndExamplesFromEnglish(word);
    ['us', 'uk'].forEach(region => {
      if (!audioMap[region] && fallback.audioMap[region]) {
        audioMap[region] = fallback.audioMap[region];
      }
      for (const ipa of fallback.ipaMap[region]) {
        ipaMap[region].add(ipa);
      }
    });
  }

  ['us', 'uk'].forEach(region => {
    const ipaArray = [...ipaMap[region]];
    if (ipaArray.length > 0 || audioMap[region]) {
      result.pronunciations[region] = {
        ipa: ipaArray.join(' - ') || null,
        audioUrl: audioMap[region] || null
      };
    }
  });

  let id = 1;
  $('div.pr.entry-body').each((_, el) => {
    const entry = $(el);
    let pos = "";
    entry.find('span.pos.dpos').each((_, element) => {
      const word = $(element).text().trim();
      if (word) pos += (pos ? ', ' : '') + word;
    });
    const cefr = entry.find('span.epp-xref.dxref').first().text().trim() || null;
    const senses = [];

    entry.find('div.sense-block.pr.dsense').each((_, senseBlock) => {
      let sense_title = $(senseBlock).find('span.sense-title.dsense-title').first().text().trim();
      $(senseBlock).find('div.sense-body.dsense_b').each((_, senseBody) => {
        $(senseBody).find('div.def-block.ddef_block').each((_, defBlock) => {
          const def = $(defBlock).find('div.def.ddef_d').first().text().trim();
          const translation1 = $(defBlock).find('span.trans.dtrans.dtrans-se').first().text().trim();
          const translation2 = $(defBlock).find('span.trans.dtrans.dtrans-se span.trans.dtrans').first().text().trim();
          const merged = `${translation1}, ${translation2}`;
          const translation = [...new Set(merged.split(',').map(x => x.trim()).filter(Boolean))].join(', ');

          const examples = [];
          $(defBlock).find('div.examp.dexamp').each((_, ex) => {
            const en = $(ex).find('span.eg.deg').text().trim();
            const es = $(ex).find('span.trans.dtrans.hdb').text().trim();
            if (en || es) examples.push({ en, es });
          });

          const daccord = $(defBlock).nextAll('.daccord').first();
          if (daccord.length > 0) {
            extractExtraExamples($, daccord, examples);
          }

          if (def || sense_title || translation || examples.length > 0) {
            senses.push({ type: 'definition', phrase: '', definition: def, sense_title, translation, examples });
          }
        });

        $(senseBody).find('div.phrase-block.pr.dphrase-block').each((_, phraseBlock) => {
          const phrase = $(phraseBlock).find('span.phrase-title').first().text().trim();

          $(phraseBlock).find('div.def-block.ddef_block').each((_, defBlock) => {
            const def = $(defBlock).find('div.def.ddef_d').first().text().trim();
            const translation1 = $(defBlock).find('span.trans.dtrans.dtrans-se').first().text().trim();
            const translation2 = $(defBlock).find('span.trans.dtrans.dtrans-se span.trans.dtrans').first().text().trim();
            const merged = `${translation1}, ${translation2}`;
            const translation = [...new Set(merged.split(',').map(x => x.trim()).filter(Boolean))].join(', ');

            const examples = [];
            $(defBlock).find('div.examp.dexamp').each((_, ex) => {
              const en = $(ex).find('span.eg.deg').text().trim();
              const es = $(ex).find('span.trans.dtrans.hdb').text().trim();
              if (en || es) examples.push({ en, es });
            });

            const daccord = $(defBlock).nextAll('.daccord').first();
            if (daccord.length > 0) {
              extractExtraExamples($, daccord, examples);
            }

            if (phrase || def || translation || examples.length > 0) {
              const indexToRemove = senses.findIndex(s =>
                s.type === 'definition' &&
                s.definition === def &&
                s.translation === translation &&
                s.sense_title === sense_title
              );

              if (indexToRemove !== -1) {
                senses.splice(indexToRemove, 1);
              }

              senses.push({ type: 'phrase', phrase, definition: def, sense_title, translation, examples });
            }
          });
        });
      });
    });

    if (pos || senses.length > 0) {
      result.entries.push({ id: id++, pos, cefr, senses });
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