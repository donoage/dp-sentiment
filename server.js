const express = require('express');
const path = require('path');
require('dotenv').config();

const { initDatabase, getAllSentiments } = require('./database');
const PolygonWebSocketClient = require('./polygonWebSocket');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API endpoint to get current sentiments
app.get('/api/sentiments', async (req, res) => {
  try {
    const sentiments = await getAllSentiments();
    res.json(sentiments);
  } catch (error) {
    console.error('Error fetching sentiments:', error);
    res.status(500).json({ error: 'Failed to fetch sentiments' });
  }
});

// API endpoint to get holdings configuration
app.get('/api/holdings', (req, res) => {
  try {
    res.json({
      spy: config.SPY_TOP_20,
      qqq: config.QQQ_TOP_20
    });
  } catch (error) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initDatabase();
    console.log('Database initialized');

    // Start WebSocket client
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      throw new Error('POLYGON_API_KEY not found in environment variables');
    }

    const wsClient = new PolygonWebSocketClient(apiKey);
    wsClient.connect();
    console.log('WebSocket client started');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Dashboard: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();

