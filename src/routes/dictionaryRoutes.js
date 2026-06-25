const express = require('express');
const router = express.Router();
const { getWord, processParagraph } = require('../controllers/dictionaryController');
const validateWordParam = require('../middlewares/validateWordParam');

// Estado del servicio
router.get('/status', (req, res) => res.json({ 
  status: 'OK',
  timestamp: new Date().toISOString()
}));

// Obtiene datos de palabra
router.get('/word/:word', validateWordParam, getWord);

// Procesa múltiples palabras
router.post('/words', express.json(), processParagraph);

// Ruta no encontrada
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    availableEndpoints: [
      'GET /api/status',
      'GET /api/word/:word',
      'POST /api/words'
    ]
  });
});

module.exports = router;
