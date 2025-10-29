const express = require('express');
const http = require('http');
const path = require('path');
require('dotenv').config();

const { initDatabase, getAllSentiments, getEODSnapshots } = require('./database');
const PolygonWebSocketClient = require('./polygonWebSocket');
const EODScheduler = require('./eodScheduler');
const BroadcastServer = require('./broadcastServer');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Single WebSocket client instance (to Polygon)
let wsClient = null;

// Broadcast server instance (to clients)
let broadcastServer = null;

// EOD Scheduler instance
let eodScheduler = null;

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

// API endpoint to get EOD snapshots
app.get('/api/eod-snapshots', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const snapshots = await getEODSnapshots(limit);
    res.json(snapshots);
  } catch (error) {
    console.error('Error fetching EOD snapshots:', error);
    res.status(500).json({ error: 'Failed to fetch EOD snapshots' });
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

    // Start broadcast WebSocket server for clients
    if (!broadcastServer) {
      broadcastServer = new BroadcastServer(server);
      console.log('Broadcast WebSocket server started');
    }

    // Start WebSocket client to Polygon (singleton)
    if (!wsClient) {
      const apiKey = process.env.POLYGON_API_KEY;
      if (!apiKey) {
        throw new Error('POLYGON_API_KEY not found in environment variables');
      }

      wsClient = new PolygonWebSocketClient(apiKey, broadcastServer);
      wsClient.connect();
      console.log('Polygon WebSocket client started');
    } else {
      console.log('Polygon WebSocket client already running');
    }

    // Start EOD Scheduler
    if (!eodScheduler) {
      eodScheduler = new EODScheduler();
      eodScheduler.start();
      console.log('EOD Scheduler started');
    } else {
      console.log('EOD Scheduler already running');
    }

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Dashboard: http://localhost:${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();

