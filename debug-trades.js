const WebSocket = require('ws');
const config = require('./config');
require('dotenv').config();

// Track what we're seeing
const tradeStats = {};
const conditionCodes = new Set();

class DebugWebSocketClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.tickers = config.getAllTickers();
    this.currentPrices = {};
    this.tradeCount = 0;
    this.darkpoolCount = 0;
  }

  connect() {
    const wsUrl = `wss://socket.polygon.io/stocks`;
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('✅ Connected to Polygon WebSocket');
      this.authenticate();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket closed');
    });
  }

  authenticate() {
    this.ws.send(JSON.stringify({
      action: 'auth',
      params: this.apiKey
    }));
  }

  subscribe() {
    // Subscribe to all tickers using * wildcard, then filter client-side
    this.ws.send(JSON.stringify({
      action: 'subscribe',
      params: 'AM.*'
    }));
    console.log('✅ Subscribed to minute aggregates for all tickers');

    this.ws.send(JSON.stringify({
      action: 'subscribe',
      params: 'T.*'
    }));
    console.log('✅ Subscribed to trades for all tickers');
    console.log(`📊 Filtering for ${this.tickers.length} tickers: ${this.tickers.join(', ')}\n`);
  }

  handleMessage(data) {
    try {
      const messages = JSON.parse(data);
      
      if (!Array.isArray(messages)) {
        return;
      }

      messages.forEach(msg => {
        if (msg.ev === 'status' && msg.status === 'auth_success') {
          console.log('✅ Authentication successful\n');
          this.subscribe();
        } else if (msg.ev === 'AM') {
          this.handleMinuteAggregate(msg);
        } else if (msg.ev === 'T') {
          this.handleTrade(msg);
        }
      });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  handleMinuteAggregate(msg) {
    const ticker = msg.sym;
    
    // Only process tickers we're tracking
    if (!this.tickers.includes(ticker)) {
      return;
    }
    
    const closePrice = msg.c;
    this.currentPrices[ticker] = closePrice;
    console.log(`📈 [${ticker}] Minute bar: $${closePrice}`);
  }

  handleTrade(msg) {
    const ticker = msg.sym;
    
    // Only process tickers we're tracking
    if (!this.tickers.includes(ticker)) {
      return;
    }
    
    const price = msg.p;
    const size = msg.s;
    const conditions = msg.c || [];
    
    // Track stats
    if (!tradeStats[ticker]) {
      tradeStats[ticker] = { total: 0, darkpool: 0 };
    }
    tradeStats[ticker].total++;
    this.tradeCount++;
    
    // Track all condition codes we see
    conditions.forEach(c => conditionCodes.add(c));
    
    // Check darkpool conditions
    const darkpoolConditions = [12, 37, 38, 52, 53, 54, 55, 56];
    const isDarkpool = conditions.some(c => darkpoolConditions.includes(c));
    
    if (isDarkpool) {
      tradeStats[ticker].darkpool++;
      this.darkpoolCount++;
      const tradeValue = price * size;
      console.log(`🔴 [${ticker}] DARKPOOL: $${tradeValue.toFixed(2)} @ $${price} (size: ${size}) [conditions: ${conditions.join(',')}]`);
    } else {
      // Show regular trades too (first 5 per ticker)
      if (tradeStats[ticker].total <= 5) {
        console.log(`⚪ [${ticker}] Regular trade: $${(price * size).toFixed(2)} @ $${price} (size: ${size}) [conditions: ${conditions.join(',')}]`);
      }
    }
  }

  printStats() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 TRADE STATISTICS');
    console.log('='.repeat(70));
    console.log(`Total trades received: ${this.tradeCount}`);
    console.log(`Darkpool trades: ${this.darkpoolCount}`);
    console.log(`\nPer Ticker:`);
    Object.keys(tradeStats).sort().forEach(ticker => {
      const stats = tradeStats[ticker];
      console.log(`  ${ticker}: ${stats.total} total, ${stats.darkpool} darkpool`);
    });
    console.log(`\nCondition codes seen: ${Array.from(conditionCodes).sort((a,b) => a-b).join(', ')}`);
    console.log('='.repeat(70) + '\n');
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Run debug
const apiKey = process.env.POLYGON_API_KEY;
if (!apiKey) {
  console.error('❌ POLYGON_API_KEY not found');
  process.exit(1);
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              DARKPOOL TRADE DEBUG MONITOR                      ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const client = new DebugWebSocketClient(apiKey);
client.connect();

// Print stats every 30 seconds
setInterval(() => {
  client.printStats();
}, 30000);

// Handle exit
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  client.printStats();
  client.disconnect();
  process.exit(0);
});

