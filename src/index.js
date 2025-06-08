const express = require('express');
const cors = require('cors');
const app = express();
const dictionaryRoutes = require('./routes/dictionaryRoutes');
const { loadCacheFromFile } = require('./services/audioCache');

// 🧠 Cargar cache al iniciar
loadCacheFromFile();

// Middleware CORS abierto: permite solicitudes desde cualquier origen
app.use(cors());

// Middleware para parsear JSON
app.use(express.json());

// Rutas
app.use('/api/audio', dictionaryRoutes);

// Ruta global HEAD para comprobar que el servidor responde
app.head('/', (req, res) => {
  res.status(200).json({ message: 'Server is running, Hi uptimerobot' });
});

// Servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
