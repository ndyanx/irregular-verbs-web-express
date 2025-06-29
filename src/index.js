const express = require('express');
const cors = require('cors');
const app = express();
const docsRoutes = require('./routes/docsRoutes');
const dictionaryRoutes = require('./routes/dictionaryRoutes');

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/word', dictionaryRoutes);
app.use('/api/docs', docsRoutes);


app.head('/', (req, res) => {
  res.status(200).json({ message: 'Server is running, Hi uptimerobot' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}/api/docs`);
});
