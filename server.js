const express = require('express');
const http = require('http');
const path = require('path');
require('dotenv').config();

const { initDatabase, getAllSentiments, getEODSnapshots, getIntradaySnapshots } = require('./database');
const PolygonWebSocketClient = require('./polygonWebSocket');
const EODScheduler = require('./eodScheduler');
const IntradayScheduler = require('./intradayScheduler');
const HoldingsScheduler = require('./holdingsScheduler');
const ResetScheduler = require('./resetScheduler');
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

// Intraday Scheduler instance
let intradayScheduler = null;

// Holdings Scheduler instance
let holdingsScheduler = null;

// Reset Scheduler instance
let resetScheduler = null;

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

// API endpoint to get intraday snapshots
app.get('/api/intraday-snapshots', async (req, res) => {
  try {
    const date = req.query.date; // Optional: YYYY-MM-DD format
    const limit = parseInt(req.query.limit) || 100;
    const snapshots = await getIntradaySnapshots(date, limit);
    res.json(snapshots);
  } catch (error) {
    console.error('Error fetching intraday snapshots:', error);
    res.status(500).json({ error: 'Failed to fetch intraday snapshots' });
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

    // Initialize ETF holdings (fetch from StockAnalysis.com)
    await config.initialize();
    console.log('ETF holdings initialized');

    // Start broadcast WebSocket server for clients (must be before schedulers that use it)
    if (!broadcastServer) {
      broadcastServer = new BroadcastServer(server);
      console.log('Broadcast WebSocket server started');
    }

    // Start Holdings Scheduler (refreshes daily at 6:30 AM ET)
    if (!holdingsScheduler) {
      holdingsScheduler = new HoldingsScheduler();
      holdingsScheduler.start();
      console.log('Holdings Scheduler started');
    } else {
      console.log('Holdings Scheduler already running');
    }

    // Start Reset Scheduler (resets sentiments daily at 6:45 AM ET)
    if (!resetScheduler) {
      resetScheduler = new ResetScheduler(broadcastServer);
      resetScheduler.start();
      console.log('Reset Scheduler started');
    } else {
      console.log('Reset Scheduler already running');
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

    // Start Intraday Scheduler
    if (!intradayScheduler) {
      intradayScheduler = new IntradayScheduler();
      intradayScheduler.start();
      console.log('Intraday Scheduler started');
    } else {
      console.log('Intraday Scheduler already running');
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

