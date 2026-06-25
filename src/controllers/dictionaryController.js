const logger = require("pino")();
const { fetchAudioData } = require("../services/wordScraper");
const { wordQueue, paragraphWordQueue } = require("../services/scrapeQueue");

// Obtiene datos de una palabra
// @route GET /api/word/:word
const getWord = async (req, res) => {
  const { word } = req.params;
  try {
    const data = await wordQueue.enqueue(`word:${word.toLowerCase()}`, () =>
      fetchAudioData(word),
    );
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(404).json({
      success: false,
      error: err.message,
    });
  }
};

// Procesa múltiples palabras
// @route POST /api/words
const processParagraph = async (req, res) => {
  const { words } = req.body;

  if (!Array.isArray(words)) {
    return res.status(400).json({
      success: false,
      error: "Se esperaba un arreglo de palabras",
    });
  }

  // if (words.length > 1000) {
  //   return res.status(400).json({
  //     success: false,
  //     error: 'Máximo 1000 palabras por solicitud'
  //   });
  // }

  try {
    // Procesar cada palabra en la cola de párrafos
    words.forEach((word, index) => {
      const taskKey = `para:${Date.now()}:${index}:${word.toLowerCase()}`;

      paragraphWordQueue.enqueue(taskKey, async () => {
        try {
          await fetchAudioData(word);
        } catch (error) {
          return;
        }
      });
    });

    res.status(202).json({
      success: true,
      message: `Se han encolado ${words.length} palabras para procesamiento`,
      wordsInQueue: paragraphWordQueue.queue.length,
      processing: paragraphWordQueue.currentRunning,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Se han encolado ${words.length} palabras para procesamiento`);
  } catch (error) {
    logger.warn("Error al procesar párrafo:", error);
    res.status(500).json({
      success: false,
      error: "Error al iniciar el procesamiento del lote de palabras",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = { getWord, processParagraph };
