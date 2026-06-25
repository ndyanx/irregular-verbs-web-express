// Scraper para diccionario Cambridge (EN-ES)
const axios = require("axios");
const cheerio = require("cheerio");
const logger = require("pino")();
const { getFromCache, setToCache } = require("./wordCache");
const { wordQueue } = require("./scrapeQueue");

// Headers estándar
const getHeaders = () => ({
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9",
});

// Extrae ejemplos adicionales
function extractExtraExamples($, container, examples) {
  $(container)
    .find("li.eg.dexamp.hax")
    .each((_, li) => {
      const en = $(li).text().trim();
      if (en && !examples.some((ex) => ex.en === en)) {
        examples.push({ en, es: null });
      }
    });
}

// Obtiene audio/IPA de la vista en inglés
async function fetchCambridgeAudioAndExamplesFromEnglish(word) {
  const url = `https://dictionary.cambridge.org/dictionary/english/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);

  const ipaMap = { us: new Set(), uk: new Set() };
  const audioMap = { us: null, uk: null };

  ["us", "uk"].forEach((region) => {
    const selector = `span.${region}.dpron-i`;
    const block = $(selector).first();
    if (block.length > 0) {
      const ipa = block.find("span.ipa.dipa").first().text().trim();
      const audioSrc = block.find('audio source[type="audio/ogg"]').attr("src");
      const audioUrl = audioSrc
        ? `https://dictionary.cambridge.org${audioSrc}`
        : null;
      if (ipa) ipaMap[region].add(ipa);
      if (audioUrl) audioMap[region] = audioUrl;
    }
  });

  return { ipaMap, audioMap };
}

// Main function to scrape word data from Cambridge Dictionary
const fetchCambridgeData = async (word) => {
  const url = `https://dictionary.cambridge.org/dictionary/english-spanish/${word}`;
  const response = await axios.get(url, { headers: getHeaders() });
  const $ = cheerio.load(response.data);

  const result = {
    word: word.replace("-", "'"),
    pronunciations: {},
    entries: [],
  };

  const ipaMap = { us: new Set(), uk: new Set() };
  const audioMap = { us: null, uk: null };
  let currentRegion = null;

  $("span.pron-info.dpron-info").each((_, el) => {
    const block = $(el);
    const regionRaw = block
      .find("span.region.dreg")
      .first()
      .text()
      .trim()
      .toLowerCase();
    const region = regionRaw === "us" || regionRaw === "uk" ? regionRaw : null;
    const ipa = block.find("span.ipa.dipa").first().text().trim();
    const audioSrc = block.find('audio source[type="audio/ogg"]').attr("src");
    const audioUrl = audioSrc
      ? `https://dictionary.cambridge.org${audioSrc}`
      : null;
    if (region) currentRegion = region;
    const targetRegion = region || currentRegion;
    if (targetRegion && ipa) ipaMap[targetRegion].add(ipa);
    if (region && audioUrl && !audioMap[region]) audioMap[region] = audioUrl;
  });

  // Si no hay audios en la vista inglés-español, intenta con la vista en inglés
  const needsFallback = !audioMap.us && !audioMap.uk;
  let fallback = null;
  if (needsFallback) {
    fallback = await fetchCambridgeAudioAndExamplesFromEnglish(word);
    ["us", "uk"].forEach((region) => {
      if (!audioMap[region] && fallback.audioMap[region]) {
        audioMap[region] = fallback.audioMap[region];
      }
      for (const ipa of fallback.ipaMap[region]) {
        ipaMap[region].add(ipa);
      }
    });
  }

  // Construye pronunciaciones (ipa + url de audio) por región
  ["us", "uk"].forEach((region) => {
    const ipaArray = [...ipaMap[region]];
    if (ipaArray.length > 0 || audioMap[region]) {
      result.pronunciations[region] = {
        ipa: ipaArray.join(" - ") || null,
        audioUrl: audioMap[region] || null,
      };
    }
  });

  // Construye entradas (definiciones y frases) con ejemplos y traducciones
  let id = 1;
  $("div.pr.entry-body").each((_, el) => {
    const entry = $(el);
    let pos = "";
    entry.find("span.pos.dpos").each((_, element) => {
      const word = $(element).text().trim();
      if (word) pos += (pos ? ", " : "") + word;
    });
    const cefr =
      entry.find("span.epp-xref.dxref").first().text().trim() || null;
    const senses = [];

    entry.find("div.sense-block.pr.dsense").each((_, senseBlock) => {
      let sense_title = $(senseBlock)
        .find("span.sense-title.dsense-title")
        .first()
        .text()
        .trim();
      $(senseBlock)
        .find("div.sense-body.dsense_b")
        .each((_, senseBody) => {
          $(senseBody)
            .find("div.def-block.ddef_block")
            .each((_, defBlock) => {
              const def = $(defBlock)
                .find("div.def.ddef_d")
                .first()
                .text()
                .trim();
              const translation1 = $(defBlock)
                .find("span.trans.dtrans.dtrans-se")
                .first()
                .text()
                .trim();
              const translation2 = $(defBlock)
                .find("span.trans.dtrans.dtrans-se span.trans.dtrans")
                .first()
                .text()
                .trim();
              const merged = `${translation1}, ${translation2}`;
              const translation = [
                ...new Set(
                  merged
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                ),
              ].join(", ");

              const examples = [];
              $(defBlock)
                .find("div.examp.dexamp")
                .each((_, ex) => {
                  const en = $(ex).find("span.eg.deg").text().trim();
                  const es = $(ex).find("span.trans.dtrans.hdb").text().trim();
                  if (en || es) examples.push({ en, es });
                });

              const daccord = $(defBlock).nextAll(".daccord").first();
              if (daccord.length > 0) {
                extractExtraExamples($, daccord, examples);
              }

              if (def || sense_title || translation || examples.length > 0) {
                senses.push({
                  type: "definition",
                  phrase: "",
                  definition: def,
                  sense_title,
                  translation,
                  examples,
                });
              }
            });

          $(senseBody)
            .find("div.phrase-block.pr.dphrase-block")
            .each((_, phraseBlock) => {
              const phrase = $(phraseBlock)
                .find("span.phrase-title")
                .first()
                .text()
                .trim();

              $(phraseBlock)
                .find("div.def-block.ddef_block")
                .each((_, defBlock) => {
                  const def = $(defBlock)
                    .find("div.def.ddef_d")
                    .first()
                    .text()
                    .trim();
                  const translation1 = $(defBlock)
                    .find("span.trans.dtrans.dtrans-se")
                    .first()
                    .text()
                    .trim();
                  const translation2 = $(defBlock)
                    .find("span.trans.dtrans.dtrans-se span.trans.dtrans")
                    .first()
                    .text()
                    .trim();
                  const merged = `${translation1}, ${translation2}`;
                  const translation = [
                    ...new Set(
                      merged
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    ),
                  ].join(", ");

                  const examples = [];
                  $(defBlock)
                    .find("div.examp.dexamp")
                    .each((_, ex) => {
                      const en = $(ex).find("span.eg.deg").text().trim();
                      const es = $(ex)
                        .find("span.trans.dtrans.hdb")
                        .text()
                        .trim();
                      if (en || es) examples.push({ en, es });
                    });

                  const daccord = $(defBlock).nextAll(".daccord").first();
                  if (daccord.length > 0) {
                    extractExtraExamples($, daccord, examples);
                  }

                  if (phrase || def || translation || examples.length > 0) {
                    const indexToRemove = senses.findIndex(
                      (s) =>
                        s.type === "definition" &&
                        s.definition === def &&
                        s.translation === translation &&
                        s.sense_title === sense_title,
                    );

                    if (indexToRemove !== -1) {
                      senses.splice(indexToRemove, 1);
                    }

                    senses.push({
                      type: "phrase",
                      phrase,
                      definition: def,
                      sense_title,
                      translation,
                      examples,
                    });
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

// Valida URL de audio
const validateAudioUrl = async (url) => {
  try {
    const response = await axios.head(url, {
      headers: getHeaders(),
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
};

// Obtiene datos de palabra
async function fetchAudioData(word) {
  word = word
    .toLowerCase()
    .trim()
    .replace(/[^a-z]/g, "-");
  const cached = await getFromCache(word);

  if (cached) {
    logger.info(`[CACHE] Loaded from cache for ${word}`);
    logger.info(`[CACHE] JSON cargado desde cache para ${word}`);
    return cached;
    // Cache validation with audio URL check (commented out for performance)
    // Uncomment to enable strict cache validation
    // Comprueba si el caché tiene al menos un audio válido
    // const hasAudio = ['us', 'uk'].some(acc => cached?.pronunciations?.[acc]?.audioUrl);
    // const allValid = await Promise.all(
    //   ['us', 'uk'].map(acc => validateAudioUrl(cached?.pronunciations?.[acc]?.audioUrl || ''))
    // );
    // if (hasAudio && allValid.some(valid => valid)) {
    //   logger.info(`[CACHE] Using cached data for ${word}`);
    //   return cached;
    // }
    // logger.info(`[CACHE] Invalid cache for ${word}, regenerating...`);
  }

  try {
    // Queue the request with deduplication
    const result = await wordQueue.enqueue(`scrape:${word}`, async () => {
      const scraped = await fetchCambridgeData(word);
      const hasValidAudio = ["us", "uk"].some(
        (accent) => scraped?.pronunciations?.[accent]?.audioUrl,
      );
      if (!hasValidAudio) throw new Error("No audio URL found");
      // Update cache on successful scrape
      await setToCache(word, scraped);
      return scraped;
    });
    return result;
  } catch (err) {
    logger.warn("[SCRAPER ERROR]", err.message);
    throw new Error(`No se pudo obtener los datos para "${word}"`);
  }
}

module.exports = { fetchAudioData };
