const WebSocket = require('ws');
const { getAllSentiments } = require('./database');

class BroadcastServer {
  constructor(httpServer) {
    this.wss = new WebSocket.Server({ 
      server: httpServer,
      path: '/ws'
    });
    this.clients = new Set();
    this.setupServer();
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

  // Broadcast sentiment update to all connected clients
  async broadcastSentimentUpdate(ticker, bullishAmount, bearishAmount) {
    if (this.wss.clients.size === 0) {
      return; // No clients connected, skip broadcast
    }

    const message = JSON.stringify({
      type: 'update',
      ticker: ticker,
      bullish_amount: bullishAmount,
      bearish_amount: bearishAmount,
      timestamp: new Date().toISOString()
    });

    let broadcastCount = 0;
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        broadcastCount++;
      }
    });

    if (broadcastCount > 0) {
      console.log(`📡 Broadcasted ${ticker} update to ${broadcastCount} clients`);
    }
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
}

module.exports = BroadcastServer;

