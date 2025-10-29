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
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS eod_sentiment_snapshot (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL,
        total_bullish DECIMAL(20, 2) NOT NULL,
        total_bearish DECIMAL(20, 2) NOT NULL,
        net_sentiment DECIMAL(20, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(snapshot_date)
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

// Save EOD sentiment snapshot
async function saveEODSnapshot() {
  const client = await pool.connect();
  try {
    // Get current totals
    const result = await client.query(`
      SELECT 
        COALESCE(SUM(bullish_amount), 0) as total_bullish,
        COALESCE(SUM(bearish_amount), 0) as total_bearish
      FROM ticker_sentiment
    `);
    
    if (result.rows.length === 0) {
      console.log('No sentiment data to snapshot');
      return null;
    }
    
    const totalBullish = parseFloat(result.rows[0].total_bullish);
    const totalBearish = parseFloat(result.rows[0].total_bearish);
    const netSentiment = totalBullish - totalBearish;
    
    // Get current date in ET timezone
    const now = new Date();
    const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const snapshotDate = etDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Insert snapshot (or update if already exists for today)
    await client.query(`
      INSERT INTO eod_sentiment_snapshot (snapshot_date, total_bullish, total_bearish, net_sentiment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (snapshot_date)
      DO UPDATE SET
        total_bullish = $2,
        total_bearish = $3,
        net_sentiment = $4,
        created_at = CURRENT_TIMESTAMP
    `, [snapshotDate, totalBullish, totalBearish, netSentiment]);
    
    console.log(`✅ EOD snapshot saved for ${snapshotDate}: Bullish=$${totalBullish.toFixed(2)}, Bearish=$${totalBearish.toFixed(2)}, Net=$${netSentiment.toFixed(2)}`);
    
    return {
      snapshot_date: snapshotDate,
      total_bullish: totalBullish,
      total_bearish: totalBearish,
      net_sentiment: netSentiment
    };
  } catch (error) {
    console.error('Error saving EOD snapshot:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Get EOD snapshots (optional limit for recent history)
async function getEODSnapshots(limit = 30) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT snapshot_date, total_bullish, total_bearish, net_sentiment, created_at
      FROM eod_sentiment_snapshot
      ORDER BY snapshot_date DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Error getting EOD snapshots:', error);
    return [];
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDatabase,
  updateSentiment,
  getAllSentiments,
  resetSentiments,
  saveEODSnapshot,
  getEODSnapshots
};

