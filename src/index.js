const express = require('express');
const cors = require('cors');
const app = express();
const dictionaryRoutes = require('./routes/dictionaryRoutes');

app.use(cors());
app.use(express.json());
app.use('/api/audio', dictionaryRoutes);

// HEAD local: / → usado por UptimeRobot
app.head('/', (req, res) => {
  res.status(200).json({ message: 'Server is running, Hi uptimerobot' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Access the server at: http://localhost:${PORT}/api/audio`);
  console.log(`🔍 Example endpoint to try: http://localhost:${PORT}/api/audio/waste`);
});
