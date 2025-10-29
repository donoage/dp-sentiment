// Top 20 holdings of SPY and QQQ (as of October 29, 2025)
// Source: StockAnalysis.com and Invesco QQQ Trust
// Note: These should be updated periodically to reflect current holdings
module.exports = {
  SPY_TOP_20: [
    { ticker: 'NVDA', weight: 7.63 },   // 1. NVIDIA
    { ticker: 'MSFT', weight: 6.70 },   // 2. Microsoft
    { ticker: 'AAPL', weight: 6.61 },   // 3. Apple
    { ticker: 'AMZN', weight: 3.77 },   // 4. Amazon
    { ticker: 'META', weight: 2.91 },   // 5. Meta
    { ticker: 'AVGO', weight: 2.82 },   // 6. Broadcom
    { ticker: 'GOOGL', weight: 1.95 },  // 7. Alphabet A
    { ticker: 'GOOG', weight: 1.89 },   // 8. Alphabet C
    { ticker: 'TSLA', weight: 1.49 },   // 9. Tesla
    { ticker: 'BRK.B', weight: 1.45 },  // 10. Berkshire Hathaway
    { ticker: 'JPM', weight: 1.36 },    // 11. JPMorgan Chase
    { ticker: 'JNJ', weight: 1.21 },    // 12. Johnson & Johnson
    { ticker: 'UNH', weight: 1.20 },    // 13. UnitedHealth
    { ticker: 'XOM', weight: 1.10 },    // 14. Exxon Mobil
    { ticker: 'PG', weight: 1.00 },     // 15. Procter & Gamble
    { ticker: 'V', weight: 0.98 },      // 16. Visa
    { ticker: 'MA', weight: 0.92 },     // 17. Mastercard
    { ticker: 'HD', weight: 0.88 },     // 18. Home Depot
    { ticker: 'COST', weight: 0.85 },   // 19. Costco
    { ticker: 'NFLX', weight: 0.82 }    // 20. Netflix
  ],
  QQQ_TOP_20: [
    { ticker: 'AAPL', weight: 12.79 },  // 1. Apple
    { ticker: 'MSFT', weight: 10.50 },  // 2. Microsoft
    { ticker: 'AMZN', weight: 6.99 },   // 3. Amazon
    { ticker: 'NVDA', weight: 5.12 },   // 4. NVIDIA
    { ticker: 'META', weight: 4.47 },   // 5. Meta
    { ticker: 'GOOGL', weight: 3.92 },  // 6. Alphabet A
    { ticker: 'GOOG', weight: 3.85 },   // 7. Alphabet C
    { ticker: 'TSLA', weight: 3.12 },   // 8. Tesla
    { ticker: 'AVGO', weight: 2.15 },   // 9. Broadcom
    { ticker: 'PEP', weight: 2.10 },    // 10. PepsiCo
    { ticker: 'COST', weight: 2.00 },   // 11. Costco
    { ticker: 'ADBE', weight: 1.90 },   // 12. Adobe
    { ticker: 'CSCO', weight: 1.80 },   // 13. Cisco
    { ticker: 'CMCSA', weight: 1.70 },  // 14. Comcast
    { ticker: 'INTC', weight: 1.60 },   // 15. Intel
    { ticker: 'NFLX', weight: 1.55 },   // 16. Netflix
    { ticker: 'AMD', weight: 1.45 },    // 17. AMD
    { ticker: 'QCOM', weight: 1.35 },   // 18. Qualcomm
    { ticker: 'TXN', weight: 1.25 },    // 19. Texas Instruments
    { ticker: 'INTU', weight: 1.20 }    // 20. Intuit
  ],
  
  // Get unique tickers from both ETFs
  getAllTickers() {
    const spyTickers = this.SPY_TOP_20.map(h => h.ticker);
    const qqqTickers = this.QQQ_TOP_20.map(h => h.ticker);
    return [...new Set([...spyTickers, ...qqqTickers])];
  },
  
  // Get weight for a ticker in SPY
  getSPYWeight(ticker) {
    const holding = this.SPY_TOP_20.find(h => h.ticker === ticker);
    return holding ? holding.weight : 0;
  },
  
  // Get weight for a ticker in QQQ
  getQQQWeight(ticker) {
    const holding = this.QQQ_TOP_20.find(h => h.ticker === ticker);
    return holding ? holding.weight : 0;
  }
};

