require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ragRoutes = require('./routes/rag');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/rag', ragRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'RAG API is running' });
});
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });
  
  app.listen(PORT, () => {
    console.log(`RAG API server running on port ${PORT}`);
    console.log(`Chat interface: http://localhost:${PORT}`);
  });
