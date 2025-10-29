// Top 15 holdings of SPY and QQQ (as of October 29, 2025)
// Source: StockAnalysis.com and Invesco QQQ Trust
// Note: These should be updated periodically to reflect current holdings
module.exports = {
  SPY_TOP_15: [
    'NVDA',  // 1. NVIDIA - 7.63%
    'MSFT',  // 2. Microsoft - 6.70%
    'AAPL',  // 3. Apple - 6.61%
    'AMZN',  // 4. Amazon - 3.77%
    'META',  // 5. Meta - 2.91%
    'AVGO',  // 6. Broadcom - 2.82%
    'GOOGL', // 7. Alphabet A - 1.95%
    'GOOG',  // 8. Alphabet C - 1.89%
    'TSLA',  // 9. Tesla - 1.49%
    'BRK.B', // 10. Berkshire Hathaway - 1.45%
    'JPM',   // 11. JPMorgan Chase - 1.36%
    'JNJ',   // 12. Johnson & Johnson - 1.21%
    'UNH',   // 13. UnitedHealth - 1.20%
    'XOM',   // 14. Exxon Mobil - 1.10%
    'PG'     // 15. Procter & Gamble - 1.00%
  ],
  QQQ_TOP_15: [
    'AAPL',  // 1. Apple - 12.79%
    'MSFT',  // 2. Microsoft - 10.50%
    'AMZN',  // 3. Amazon - 6.99%
    'NVDA',  // 4. NVIDIA - 5.12%
    'META',  // 5. Meta - 4.47%
    'GOOGL', // 6. Alphabet A - 3.92%
    'GOOG',  // 7. Alphabet C - 3.85%
    'TSLA',  // 8. Tesla - 3.12%
    'AVGO',  // 9. Broadcom - 2.15%
    'PEP',   // 10. PepsiCo - 2.10%
    'COST',  // 11. Costco - 2.00%
    'ADBE',  // 12. Adobe - 1.90%
    'CSCO',  // 13. Cisco - 1.80%
    'CMCSA', // 14. Comcast - 1.70%
    'INTC'   // 15. Intel - 1.60%
  ],
  
  // Get unique tickers from both ETFs
  getAllTickers() {
    return [...new Set([...this.SPY_TOP_15, ...this.QQQ_TOP_15])];
  }
};

