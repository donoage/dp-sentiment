const WebSocket = require('ws');
const config = require('./config');
const { updateSentiment } = require('./database');

class PolygonWebSocketClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.reconnectInterval = 5000;
    this.tickers = config.getAllTickers();
    this.currentPrices = {}; // Store current minute bar prices
  }

  connect() {
    const wsUrl = `wss://socket.polygon.io/stocks`;
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('Connected to Polygon WebSocket');
      this.authenticate();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket closed. Reconnecting...');
      setTimeout(() => this.connect(), this.reconnectInterval);
    });
  }

  authenticate() {
    this.ws.send(JSON.stringify({
      action: 'auth',
      params: this.apiKey
    }));
  }

  subscribe() {
    // Subscribe to minute aggregates for all tickers to get current prices
    const tickerList = this.tickers.join(',');
    this.ws.send(JSON.stringify({
      action: 'subscribe',
      params: `AM.${tickerList}`
    }));
    console.log(`Subscribed to minute aggregates for: ${tickerList}`);

    // Subscribe to trades for darkpool detection
    this.ws.send(JSON.stringify({
      action: 'subscribe',
      params: `T.${tickerList}`
    }));
    console.log(`Subscribed to trades for: ${tickerList}`);
  }

  handleMessage(data) {
    try {
      const messages = JSON.parse(data);
      
      if (!Array.isArray(messages)) {
        return;
      }

      messages.forEach(msg => {
        if (msg.ev === 'status' && msg.status === 'auth_success') {
          console.log('Authentication successful');
          this.subscribe();
        } else if (msg.ev === 'AM') {
          // Minute aggregate - update current price
          this.handleMinuteAggregate(msg);
        } else if (msg.ev === 'T') {
          // Trade - check if it's darkpool
          this.handleTrade(msg);
        }
      });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  handleMinuteAggregate(msg) {
    const ticker = msg.sym;
    const closePrice = msg.c;
    
    // Update current price for this ticker
    this.currentPrices[ticker] = closePrice;
    
    console.log(`[${ticker}] Minute bar close: $${closePrice}`);
  }

  handleTrade(msg) {
    const ticker = msg.sym;
    const price = msg.p;
    const size = msg.s;
    const conditions = msg.c || [];
    
    // Darkpool condition codes based on Polygon.io documentation
    // These represent trades executed in dark pools and alternative trading systems
    // Common darkpool conditions include:
    // 12 = Form T (late reporting), 37 = Odd Lot Trade, 38 = Odd Lot Cross Trade
    // 52 = Intermarket Sweep, 53 = Derivatively Priced, 54 = Re-opening Prints
    // 55 = Closing Prints, 56 = Qualified Contingent Trade (QCT)
    const darkpoolConditions = [12, 37, 38, 52, 53, 54, 55, 56];
    const isDarkpool = conditions.some(c => darkpoolConditions.includes(c));
    
    if (!isDarkpool) {
      return;
    }

    // Get current minute bar price
    const currentPrice = this.currentPrices[ticker];
    
    if (!currentPrice) {
      // No current price yet, skip
      return;
    }

    // Calculate trade value
    const tradeValue = price * size;
    
    // Determine sentiment based on trade price vs current market price
    // Trade below current price = bullish (buyers willing to pay market price)
    // Trade above current price = bearish (sellers getting premium)
    let bullishAmount = 0;
    let bearishAmount = 0;
    
    if (price < currentPrice) {
      bullishAmount = tradeValue;
      console.log(`[${ticker}] BULLISH darkpool: $${tradeValue.toFixed(2)} @ $${price} (below $${currentPrice})`);
    } else if (price > currentPrice) {
      bearishAmount = tradeValue;
      console.log(`[${ticker}] BEARISH darkpool: $${tradeValue.toFixed(2)} @ $${price} (above $${currentPrice})`);
    }
    
    // Update database
    if (bullishAmount > 0 || bearishAmount > 0) {
      updateSentiment(ticker, bullishAmount, bearishAmount);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = PolygonWebSocketClient;

