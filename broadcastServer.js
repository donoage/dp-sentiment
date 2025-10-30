const WebSocket = require('ws');
const { getAllSentiments } = require('./database');

class BroadcastServer {
  constructor(httpServer) {
    this.wss = new WebSocket.Server({ 
      server: httpServer,
      path: '/ws'
    });
    this.clients = new Set();
    this.syncInterval = null;
    this.setupServer();
    this.startPeriodicSync();
  }

  setupServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      console.log(`📱 Client connected: ${clientId} (Total: ${this.wss.clients.size})`);
      
      this.clients.add(ws);

      // Send initial data immediately on connection
      this.sendInitialData(ws);

      // Handle client messages (if needed for ping/pong)
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          console.error('Error parsing client message:', error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`📱 Client disconnected: ${clientId} (Total: ${this.wss.clients.size})`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        this.clients.delete(ws);
      });
    });

    console.log('🔌 WebSocket broadcast server ready at /ws');
  }

  async sendInitialData(ws) {
    try {
      const sentiments = await getAllSentiments();
      ws.send(JSON.stringify({
        type: 'initial',
        data: sentiments
      }));
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }

  // Broadcast sentiment update to all connected clients (throttled)
  async broadcastSentimentUpdate(ticker, bullishAmount, bearishAmount) {
    if (this.wss.clients.size === 0) {
      return; // No clients connected, skip broadcast
    }

    // Throttle broadcasts - batch updates and send every 2 seconds
    if (!this.pendingUpdates) {
      this.pendingUpdates = new Map();
      this.broadcastTimer = null;
    }

    // Accumulate the update
    const existing = this.pendingUpdates.get(ticker) || { bullish: 0, bearish: 0 };
    this.pendingUpdates.set(ticker, {
      bullish: existing.bullish + parseFloat(bullishAmount),
      bearish: existing.bearish + parseFloat(bearishAmount)
    });

    // Schedule broadcast if not already scheduled
    if (!this.broadcastTimer) {
      this.broadcastTimer = setTimeout(() => {
        this.flushPendingUpdates();
      }, 2000); // Batch updates every 2 seconds
    }
  }

  flushPendingUpdates() {
    if (!this.pendingUpdates || this.pendingUpdates.size === 0) {
      return;
    }

    const updates = [];
    this.pendingUpdates.forEach((amounts, ticker) => {
      updates.push({
        ticker: ticker,
        bullish_amount: amounts.bullish.toFixed(2),
        bearish_amount: amounts.bearish.toFixed(2)
      });
    });

    const message = JSON.stringify({
      type: 'batch_update',
      updates: updates,
      timestamp: new Date().toISOString()
    });

    let broadcastCount = 0;
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        broadcastCount++;
      }
    });

    console.log(`📡 Broadcasted ${updates.length} ticker updates to ${broadcastCount} clients`);

    // Clear pending updates
    this.pendingUpdates.clear();
    this.broadcastTimer = null;
  }

  // Broadcast full sentiment data (for periodic full updates)
  async broadcastFullUpdate() {
    if (this.wss.clients.size === 0) {
      return;
    }

    try {
      const sentiments = await getAllSentiments();
      const message = JSON.stringify({
        type: 'full',
        data: sentiments,
        timestamp: new Date().toISOString()
      });

      let broadcastCount = 0;
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
          broadcastCount++;
        }
      });

      console.log(`📡 Broadcasted full update to ${broadcastCount} clients`);
    } catch (error) {
      console.error('Error broadcasting full update:', error);
    }
  }

  getClientCount() {
    return this.wss.clients.size;
  }

  // Periodically sync all clients with database (every 5 minutes)
  startPeriodicSync() {
    console.log('🔄 Starting periodic full sync (every 5 minutes)');
    
    // Sync every 5 minutes to keep all clients aligned
    this.syncInterval = setInterval(async () => {
      if (this.wss.clients.size > 0) {
        console.log('🔄 Running periodic full sync for all clients...');
        await this.broadcastFullUpdate();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🔄 Stopped periodic full sync');
    }
  }
}

module.exports = BroadcastServer;

