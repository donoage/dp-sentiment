// Dynamic ETF holdings configuration
// Holdings are automatically fetched from StockAnalysis.com on server startup
// and refreshed every 6 hours
const HoldingsScraper = require('./holdingsScraper');

class DynamicConfig {
  constructor() {
    this.scraper = new HoldingsScraper();
    this.SPY_TOP_20 = [];
    this.QQQ_TOP_20 = [];
    this.initialized = false;
  }

  // Initialize holdings (called on server startup)
  async initialize() {
    try {
      console.log('🔄 Initializing ETF holdings...');
      const { spy, qqq } = await this.scraper.refreshHoldings();
      this.SPY_TOP_20 = spy;
      this.QQQ_TOP_20 = qqq;
      this.initialized = true;
      console.log(`✅ Holdings initialized: ${spy.length} SPY, ${qqq.length} QQQ`);
    } catch (error) {
      console.error('❌ CRITICAL: Failed to initialize holdings');
      console.error('This likely means:');
      console.error('1. StockAnalysis.com is down');
      console.error('2. No cached holdings exist in database');
      console.error('Please check the scraper or manually seed the holdings_cache table');
      throw error; // Don't start server without holdings
    }
  }

  // Refresh holdings (called periodically)
  async refresh() {
    try {
      console.log('🔄 Refreshing ETF holdings...');
      const { spy, qqq } = await this.scraper.refreshHoldings();
      this.SPY_TOP_20 = spy;
      this.QQQ_TOP_20 = qqq;
      console.log(`✅ Holdings refreshed: ${spy.length} SPY, ${qqq.length} QQQ`);
    } catch (error) {
      console.error('⚠️ Failed to refresh holdings:', error);
    }
  }

  // Get unique tickers from both ETFs
  getAllTickers() {
    const spyTickers = this.SPY_TOP_20.map(h => h.ticker);
    const qqqTickers = this.QQQ_TOP_20.map(h => h.ticker);
    return [...new Set([...spyTickers, ...qqqTickers])];
  }

  // Get weight for a ticker in SPY
  getSPYWeight(ticker) {
    const holding = this.SPY_TOP_20.find(h => h.ticker === ticker);
    return holding ? holding.weight : 0;
  }

  // Get weight for a ticker in QQQ
  getQQQWeight(ticker) {
    const holding = this.QQQ_TOP_20.find(h => h.ticker === ticker);
    return holding ? holding.weight : 0;
  }
}

// Export singleton instance
module.exports = new DynamicConfig();

