const WebSocket = require('ws');
const config = require('./config');
const { updateSentiment } = require('./database');

class PolygonWebSocketClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.reconnectInterval = 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectInterval = 60000; // Max 1 minute
    this.tickers = config.getAllTickers();
    this.currentPrices = {}; // Store current minute bar prices
    this.marketCheckInterval = null;
    this.shouldBeConnected = false;
  }

  // Check if market is open (9:30 AM - 4:30 PM ET, Monday-Friday)
  isMarketHours() {
    const now = new Date();
    
    // Convert to ET (UTC-5 or UTC-4 depending on DST)
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // Check if weekday (0 = Sunday, 6 = Saturday)
    const day = etTime.getDay();
    if (day === 0 || day === 6) {
      return false; // Weekend
    }
    
    // Check time (9:30 AM - 4:30 PM ET)
    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    const marketOpen = 9 * 60 + 30;  // 9:30 AM
    const marketClose = 16 * 60 + 30; // 4:30 PM
    
    return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
  }

  connect() {
    // Check if we should be connected based on market hours
    if (!this.isMarketHours()) {
      console.log('Market is closed. Not connecting to WebSocket.');
      this.shouldBeConnected = false;
      this.scheduleMarketHoursCheck();
      return;
    }

    // Prevent multiple connections
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    this.shouldBeConnected = true;
    const wsUrl = `wss://socket.polygon.io/stocks`;
    console.log(`Connecting to Polygon WebSocket (attempt ${this.reconnectAttempts + 1})...`);
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('Connected to Polygon WebSocket');
      this.reconnectAttempts = 0; // Reset on successful connection
      this.authenticate();
      this.scheduleMarketHoursCheck();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket closed.');
      this.ws = null; // Clear the reference
      
      // Only reconnect if we should be connected (market hours)
      if (this.shouldBeConnected && this.isMarketHours()) {
        // Exponential backoff with jitter
        this.reconnectAttempts++;
        const backoff = Math.min(
          this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
          this.maxReconnectInterval
        );
        const jitter = Math.random() * 1000; // Add up to 1 second jitter
        const delay = backoff + jitter;
        
        console.log(`Reconnecting in ${(delay / 1000).toFixed(1)}s...`);
        setTimeout(() => this.connect(), delay);
      } else {
        console.log('Not reconnecting - market is closed');
        this.scheduleMarketHoursCheck();
      }
    });
  }

  scheduleMarketHoursCheck() {
    // Clear existing interval
    if (this.marketCheckInterval) {
      clearInterval(this.marketCheckInterval);
    }

    // Check market hours every minute
    this.marketCheckInterval = setInterval(() => {
      const isMarketOpen = this.isMarketHours();
      const isConnected = this.ws && this.ws.readyState === WebSocket.OPEN;

      if (isMarketOpen && !isConnected) {
        console.log('Market opened - connecting WebSocket...');
        this.connect();
      } else if (!isMarketOpen && isConnected) {
        console.log('Market closed - disconnecting WebSocket...');
        this.shouldBeConnected = false;
        this.disconnect();
      }
    }, 60000); // Check every minute
  }

  authenticate() {
    this.ws.send(JSON.stringify({
      action: 'auth',
      params: this.apiKey
    }));
  }

  subscribe() {
    // Subscribe to specific tickers only to reduce data usage
    // Format: AM.TICKER for minute aggregates, T.TICKER for trades
    const amParams = this.tickers.map(t => `AM.${t}`).join(',');
    const tParams = this.tickers.map(t => `T.${t}`).join(',');
    
    this.ws.send(JSON.stringify({
      action: 'subscribe',
      params: amParams
    }));
    console.log(`Subscribed to minute aggregates for ${this.tickers.length} tickers`);

    this.ws.send(JSON.stringify({
      action: 'subscribe',
      params: tParams
    }));
    console.log(`Subscribed to trades for ${this.tickers.length} tickers`);
    console.log(`Tracking: ${this.tickers.join(', ')}`);
  }

  handleMessage(data) {
    try {
      const messages = JSON.parse(data);
      
      if (!Array.isArray(messages)) {
        return;
      }

      // Track message counts for monitoring
      let amCount = 0;
      let tradeCount = 0;
      let darkpoolCount = 0;
      let exchange4Count = 0;
      let trfIdCount = 0;

      messages.forEach(msg => {
        if (msg.ev === 'status' && msg.status === 'auth_success') {
          console.log('✅ Authentication successful');
          this.subscribe();
        } else if (msg.ev === 'status' && msg.status === 'success') {
          console.log(`✅ ${msg.message}`);
        } else if (msg.ev === 'AM') {
          amCount++;
          this.handleMinuteAggregate(msg);
        } else if (msg.ev === 'T') {
          tradeCount++;
          // Track exchange 4 and trfi separately for debugging
          if (msg.x === 4) exchange4Count++;
          if (msg.trfi !== undefined) trfIdCount++;
          const isDarkpool = this.handleTrade(msg);
          if (isDarkpool) darkpoolCount++;
        }
      });

      // Log batch statistics (only if there were messages)
      if (amCount > 0 || tradeCount > 0) {
        console.log(`📊 Batch: ${amCount} minute bars, ${tradeCount} trades (${darkpoolCount} darkpool, ${exchange4Count} exch=4, ${trfIdCount} with trf_id)`);
      }
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
    const volume = msg.v;
    
    // Update current price for this ticker
    this.currentPrices[ticker] = closePrice;
    
    console.log(`[${ticker}] Minute bar: $${closePrice} (vol: ${volume})`);
  }

  handleTrade(msg) {
    const ticker = msg.sym;
    
    // Only process tickers we're tracking
    if (!this.tickers.includes(ticker)) {
      return false;
    }
    
    // Only process trades during market hours
    if (!this.isMarketHours()) {
      return false;
    }

    const price = msg.p;
    const size = msg.s;
    const exchange = msg.x;
    const trfId = msg.trfi; // TRF ID field (trfi per WebSocket API docs)
    
    // DEBUG: Log first few trades to see what data we're getting
    if (Math.random() < 0.01) { // Log ~1% of trades to avoid spam
      console.log(`[DEBUG] Trade sample for ${ticker}:`, {
        exchange: exchange,
        trfi: trfId,
        price: price,
        size: size,
        conditions: msg.c
      });
    }
    
    // Dark pool trades are identified by:
    // 1. exchange ID of 4 (exchange: 4)
    // 2. presence of a trfi field (Trade Reporting Facility ID)
    // Source: https://polygon.io/knowledge-base/article/does-polygon-offer-dark-pool-data
    // WebSocket field reference: https://polygon.io/docs/websocket/stocks/trades
    const isDarkpool = exchange === 4 && trfId !== undefined;
    
    if (!isDarkpool) {
      return false;
    }

    // Get current minute bar price
    const currentPrice = this.currentPrices[ticker];
    
    if (!currentPrice) {
      // No current price yet, skip
      return false;
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
      console.log(`[${ticker}] 🟢 BULLISH darkpool: $${tradeValue.toFixed(2)} @ $${price} (below $${currentPrice})`);
    } else if (price > currentPrice) {
      bearishAmount = tradeValue;
      console.log(`[${ticker}] 🔴 BEARISH darkpool: $${tradeValue.toFixed(2)} @ $${price} (above $${currentPrice})`);
    }
    
    // Update database
    if (bullishAmount > 0 || bearishAmount > 0) {
      updateSentiment(ticker, bullishAmount, bearishAmount);
      return true;
    }
    
    return false;
  }

  disconnect() {
    if (this.marketCheckInterval) {
      clearInterval(this.marketCheckInterval);
      this.marketCheckInterval = null;
    }
    
    if (this.ws) {
      this.shouldBeConnected = false;
      this.ws.close();
    }
  }
}

module.exports = PolygonWebSocketClient;

