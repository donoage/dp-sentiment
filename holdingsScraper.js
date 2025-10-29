const axios = require('axios');
const cheerio = require('cheerio');
const { saveHoldingsCache, loadHoldingsCache } = require('./database');

class HoldingsScraper {
  constructor() {
    this.cache = {
      spy: { data: null, lastUpdated: null },
      qqq: { data: null, lastUpdated: null }
    };
    this.cacheValidityHours = 6; // Refresh every 6 hours
  }

  // Helper delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Load cached holdings from database
  async loadPersistedCache() {
    try {
      const cached = await loadHoldingsCache();
      
      if (cached && cached.spy && cached.qqq) {
        this.cache = {
          spy: { data: cached.spy, lastUpdated: new Date(cached.lastUpdated).getTime() },
          qqq: { data: cached.qqq, lastUpdated: new Date(cached.lastUpdated).getTime() }
        };
        return true;
      }
    } catch (error) {
      console.log('📂 No persisted cache found in database');
    }
    return false;
  }

  // Save holdings cache to database
  async savePersistedCache() {
    try {
      if (this.cache.spy.data && this.cache.qqq.data) {
        await saveHoldingsCache(this.cache.spy.data, this.cache.qqq.data);
      }
    } catch (error) {
      console.error('⚠️ Failed to save holdings cache:', error);
    }
  }

  // Check if cache is still valid
  isCacheValid(etf) {
    const cached = this.cache[etf];
    if (!cached.data || !cached.lastUpdated) {
      return false;
    }
    const hoursSinceUpdate = (Date.now() - cached.lastUpdated) / (1000 * 60 * 60);
    return hoursSinceUpdate < this.cacheValidityHours;
  }

  // Scrape holdings from StockAnalysis.com
  async scrapeStockAnalysis(ticker) {
    try {
      console.log(`🔍 Scraping ${ticker} holdings from StockAnalysis.com...`);
      
      const url = `https://stockanalysis.com/etf/${ticker.toLowerCase()}/holdings/`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const holdings = [];

      // StockAnalysis uses a clean table structure
      $('table tbody tr').each((i, row) => {
        if (i >= 20) return false; // Stop after 20

        const cells = $(row).find('td');
        if (cells.length < 3) return;

        // Cell 0: Row number
        // Cell 1: Ticker symbol (sometimes with link)
        // Cell 2: Company name
        // Cell 3: Weight percentage
        
        // Get ticker from cell 1 - look for link or text
        let ticker = null;
        const tickerCell = $(cells[1]);
        const linkText = tickerCell.find('a').text().trim();
        const cellText = tickerCell.text().trim();
        
        ticker = linkText || cellText;
        
        // Clean up ticker - should be 1-5 uppercase letters
        const tickerMatch = ticker.match(/^([A-Z]{1,5}(?:\.[A-Z])?)/);
        ticker = tickerMatch ? tickerMatch[1] : null;
        
        // Get weight from cell 3 (or search all cells for percentage)
        let weight = null;
        cells.each((j, cell) => {
          const text = $(cell).text().trim();
          const percentMatch = text.match(/^(\d+\.?\d+)%$/);
          if (percentMatch) {
            weight = parseFloat(percentMatch[1]);
          }
        });

        if (ticker && weight && weight >= 0.01 && weight <= 25) {
          holdings.push({
            ticker: ticker,
            weight: weight
          });
        }
      });

      console.log(`✅ Scraped ${holdings.length} holdings for ${ticker}`);
      
      if (holdings.length < 15) {
        throw new Error(`Only found ${holdings.length} holdings, expected at least 15`);
      }
      
      return holdings;

    } catch (error) {
      console.error(`❌ Error scraping ${ticker}:`, error.message);
      throw error;
    }
  }

  // Get SPY holdings (with caching)
  async getSPYHoldings() {
    // Check if we have fresh data (less than 6 hours old)
    if (this.isCacheValid('spy')) {
      console.log('📦 Using cached SPY holdings (still valid)');
      return this.cache.spy.data;
    }

    try {
      // Try to scrape fresh data
      console.log('🔍 Fetching fresh SPY holdings from StockAnalysis.com...');
      await this.delay(1000);
      const holdings = await this.scrapeStockAnalysis('SPY');
      
      if (holdings.length >= 15) {
        this.cache.spy = {
          data: holdings.slice(0, 20),
          lastUpdated: Date.now()
        };
        // Save to database after successful fetch
        await this.savePersistedCache();
        console.log('✅ Fetched fresh SPY holdings');
        return this.cache.spy.data;
      } else {
        throw new Error(`Only scraped ${holdings.length} holdings, expected at least 15`);
      }
    } catch (error) {
      console.error('❌ Failed to scrape SPY from StockAnalysis.com');
      
      // Fallback: Use yesterday's data from database (if available)
      if (this.cache.spy.data && this.cache.spy.data.length > 0) {
        console.log('📦 Using yesterday\'s SPY holdings from database');
        return this.cache.spy.data;
      }
      
      // No cache available - this is a critical error
      throw new Error('No SPY holdings available - scraping failed and no cache exists');
    }
  }

  // Get QQQ holdings (with caching)
  async getQQQHoldings() {
    // Check if we have fresh data (less than 6 hours old)
    if (this.isCacheValid('qqq')) {
      console.log('📦 Using cached QQQ holdings (still valid)');
      return this.cache.qqq.data;
    }

    try {
      // Try to scrape fresh data
      console.log('🔍 Fetching fresh QQQ holdings from StockAnalysis.com...');
      await this.delay(2000);
      const holdings = await this.scrapeStockAnalysis('QQQ');
      
      if (holdings.length >= 15) {
        this.cache.qqq = {
          data: holdings.slice(0, 20),
          lastUpdated: Date.now()
        };
        // Save to database after successful fetch
        await this.savePersistedCache();
        console.log('✅ Fetched fresh QQQ holdings');
        return this.cache.qqq.data;
      } else {
        throw new Error(`Only scraped ${holdings.length} holdings, expected at least 15`);
      }
    } catch (error) {
      console.error('❌ Failed to scrape QQQ from StockAnalysis.com');
      
      // Fallback: Use yesterday's data from database (if available)
      if (this.cache.qqq.data && this.cache.qqq.data.length > 0) {
        console.log('📦 Using yesterday\'s QQQ holdings from database');
        return this.cache.qqq.data;
      }
      
      // No cache available - this is a critical error
      throw new Error('No QQQ holdings available - scraping failed and no cache exists');
    }
  }


  // Get all unique tickers
  getAllTickers(spyHoldings, qqqHoldings) {
    const spyTickers = spyHoldings.map(h => h.ticker);
    const qqqTickers = qqqHoldings.map(h => h.ticker);
    return [...new Set([...spyTickers, ...qqqTickers])];
  }

  // Refresh holdings (call this daily)
  async refreshHoldings() {
    console.log('🔄 Refreshing ETF holdings...');
    
    // Load yesterday's cache ONLY as a fallback (don't use it unless scraping fails)
    await this.loadPersistedCache();
    
    try {
      const spy = await this.getSPYHoldings();
      const qqq = await this.getQQQHoldings();
      console.log(`✅ Holdings refreshed: ${spy.length} SPY, ${qqq.length} QQQ`);
      return { spy, qqq };
    } catch (error) {
      console.error('Error refreshing holdings:', error);
      throw error;
    }
  }
}

module.exports = HoldingsScraper;

