const express = require('express');
const cors = require('cors');
const app = express();
const dictionaryRoutes = require('./routes/dictionaryRoutes');
const { loadCacheFromFile } = require('./services/audioCache');

const allowedOrigins = [
  'https://irregular-verbs-icpnx.pages.dev', // tu frontend desplegado
  'http://localhost:5173' // si usas local también agregarlo
];

// 🧠 Cargar cache al iniciar
loadCacheFromFile();

// Middleware
app.use(express.json());

// CORS antes de las rutas
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // herramientas sin origin, ej Postman
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `El CORS policy no permite el origen: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

// Rutas
app.use('/api/audio', dictionaryRoutes);

// Ruta global HEAD para comprobar que el servidor responde
app.head('/', (req, res) => {
  res.status(200).json({ message: 'Server is running, Hi uptimerobot' });
});

// Servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
