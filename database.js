const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database schema
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ticker_sentiment (
        ticker VARCHAR(10) PRIMARY KEY,
        bullish_amount DECIMAL(20, 2) DEFAULT 0,
        bearish_amount DECIMAL(20, 2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database schema initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Update sentiment for a ticker
async function updateSentiment(ticker, bullishAmount, bearishAmount) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO ticker_sentiment (ticker, bullish_amount, bearish_amount, last_updated)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (ticker)
      DO UPDATE SET
        bullish_amount = ticker_sentiment.bullish_amount + $2,
        bearish_amount = ticker_sentiment.bearish_amount + $3,
        last_updated = CURRENT_TIMESTAMP
    `, [ticker, bullishAmount, bearishAmount]);
  } catch (error) {
    console.error(`Error updating sentiment for ${ticker}:`, error);
  } finally {
    client.release();
  }
}

// Get all ticker sentiments
async function getAllSentiments() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT ticker, bullish_amount, bearish_amount, last_updated
      FROM ticker_sentiment
      ORDER BY ticker
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting sentiments:', error);
    return [];
  } finally {
    client.release();
  }
}

// Reset sentiments (optional, for daily reset if needed)
async function resetSentiments() {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE ticker_sentiment
      SET bullish_amount = 0, bearish_amount = 0, last_updated = CURRENT_TIMESTAMP
    `);
    console.log('Sentiments reset');
  } catch (error) {
    console.error('Error resetting sentiments:', error);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDatabase,
  updateSentiment,
  getAllSentiments,
  resetSentiments
};

