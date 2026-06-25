const logger = require('pino')();
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Inicialización de la aplicación
const app = express();

// Middlewares
app.use(cors({ 
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas de la API
app.use('/api', require('./routes/dictionaryRoutes'));

// Ruta de estado básica
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    name: 'API de Diccionario',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/status',
      'GET /api/word/:word',
      'POST /api/words'
    ]
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { 
      message: err.message,
      stack: err.stack 
    })
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  logger.info(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
  logger.info(`🌐 URL: http://localhost:${PORT}`);
});

// Manejo de cierre limpio
process.on('SIGTERM', () => {
  logger.info('Recibida señal SIGTERM. Cerrando servidor...');
  server.close(() => {
    logger.info('Servidor cerrado');
    process.exit(0);
  });
});

module.exports = { app, server };
