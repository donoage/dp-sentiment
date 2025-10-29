const axios = require('axios');
const cheerio = require('cheerio');

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
    if (this.isCacheValid('spy')) {
      console.log('📦 Using cached SPY holdings');
      return this.cache.spy.data;
    }

    try {
      // Add delay to avoid rate limiting
      await this.delay(1000);
      const holdings = await this.scrapeStockAnalysis('SPY');
      if (holdings.length >= 15) {
        this.cache.spy = {
          data: holdings.slice(0, 20),
          lastUpdated: Date.now()
        };
        return this.cache.spy.data;
      } else {
        throw new Error(`Only scraped ${holdings.length} holdings, expected at least 15`);
      }
    } catch (error) {
      console.error('Failed to scrape SPY, using fallback static data');
      return this.getFallbackSPY();
    }
  }

  // Get QQQ holdings (with caching)
  async getQQQHoldings() {
    if (this.isCacheValid('qqq')) {
      console.log('📦 Using cached QQQ holdings');
      return this.cache.qqq.data;
    }

    try {
      // Add delay to avoid rate limiting
      await this.delay(2000);
      const holdings = await this.scrapeStockAnalysis('QQQ');
      if (holdings.length >= 15) {
        this.cache.qqq = {
          data: holdings.slice(0, 20),
          lastUpdated: Date.now()
        };
        return this.cache.qqq.data;
      } else {
        throw new Error(`Only scraped ${holdings.length} holdings, expected at least 15`);
      }
    } catch (error) {
      console.error('Failed to scrape QQQ, using fallback static data');
      return this.getFallbackQQQ();
    }
  }

  // Fallback static data (current config.js data)
  getFallbackSPY() {
    return [
      { ticker: 'NVDA', weight: 7.63 },
      { ticker: 'MSFT', weight: 6.70 },
      { ticker: 'AAPL', weight: 6.61 },
      { ticker: 'AMZN', weight: 3.77 },
      { ticker: 'META', weight: 2.91 },
      { ticker: 'AVGO', weight: 2.82 },
      { ticker: 'GOOGL', weight: 1.95 },
      { ticker: 'GOOG', weight: 1.89 },
      { ticker: 'TSLA', weight: 1.49 },
      { ticker: 'BRK.B', weight: 1.45 },
      { ticker: 'JPM', weight: 1.36 },
      { ticker: 'JNJ', weight: 1.21 },
      { ticker: 'UNH', weight: 1.20 },
      { ticker: 'XOM', weight: 1.10 },
      { ticker: 'PG', weight: 1.00 },
      { ticker: 'V', weight: 0.98 },
      { ticker: 'MA', weight: 0.92 },
      { ticker: 'HD', weight: 0.88 },
      { ticker: 'COST', weight: 0.85 },
      { ticker: 'NFLX', weight: 0.82 }
    ];
  }

  getFallbackQQQ() {
    return [
      { ticker: 'AAPL', weight: 12.79 },
      { ticker: 'MSFT', weight: 10.50 },
      { ticker: 'AMZN', weight: 6.99 },
      { ticker: 'NVDA', weight: 5.12 },
      { ticker: 'META', weight: 4.47 },
      { ticker: 'GOOGL', weight: 3.92 },
      { ticker: 'GOOG', weight: 3.85 },
      { ticker: 'TSLA', weight: 3.12 },
      { ticker: 'AVGO', weight: 2.15 },
      { ticker: 'PEP', weight: 2.10 },
      { ticker: 'COST', weight: 2.00 },
      { ticker: 'ADBE', weight: 1.90 },
      { ticker: 'CSCO', weight: 1.80 },
      { ticker: 'CMCSA', weight: 1.70 },
      { ticker: 'INTC', weight: 1.60 },
      { ticker: 'NFLX', weight: 1.55 },
      { ticker: 'AMD', weight: 1.45 },
      { ticker: 'QCOM', weight: 1.35 },
      { ticker: 'TXN', weight: 1.25 },
      { ticker: 'INTU', weight: 1.20 }
    ];
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

