const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS intraday_sentiment_snapshot (
        id SERIAL PRIMARY KEY,
        snapshot_time TIMESTAMP NOT NULL,
        total_bullish DECIMAL(20, 2) NOT NULL,
        total_bearish DECIMAL(20, 2) NOT NULL,
        net_sentiment DECIMAL(20, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(snapshot_time)
      )
    `);

    // Create index for faster queries by date
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_intraday_snapshot_time 
      ON intraday_sentiment_snapshot(snapshot_time DESC)
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
    await client.query(
      `
      INSERT INTO ticker_sentiment (ticker, bullish_amount, bearish_amount, last_updated)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (ticker)
      DO UPDATE SET
        bullish_amount = ticker_sentiment.bullish_amount + $2,
        bearish_amount = ticker_sentiment.bearish_amount + $3,
        last_updated = CURRENT_TIMESTAMP
    `,
      [ticker, bullishAmount, bearishAmount]
    );
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
    await client.query(
      `
      INSERT INTO eod_sentiment_snapshot (snapshot_date, total_bullish, total_bearish, net_sentiment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (snapshot_date)
      DO UPDATE SET
        total_bullish = $2,
        total_bearish = $3,
        net_sentiment = $4,
        created_at = CURRENT_TIMESTAMP
    `,
      [snapshotDate, totalBullish, totalBearish, netSentiment]
    );

    console.log(
      `✅ EOD snapshot saved for ${snapshotDate}: Bullish=$${totalBullish.toFixed(2)}, Bearish=$${totalBearish.toFixed(2)}, Net=$${netSentiment.toFixed(2)}`
    );

    return {
      snapshot_date: snapshotDate,
      total_bullish: totalBullish,
      total_bearish: totalBearish,
      net_sentiment: netSentiment,
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
    const result = await client.query(
      `
      SELECT snapshot_date, total_bullish, total_bearish, net_sentiment, created_at
      FROM eod_sentiment_snapshot
      ORDER BY snapshot_date DESC
      LIMIT $1
    `,
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting EOD snapshots:', error);
    return [];
  } finally {
    client.release();
  }
}

// Save intraday sentiment snapshot (every 5 minutes)
async function saveIntradaySnapshot() {
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

    // Get current time in UTC and round to nearest 2 minutes
    const now = new Date();
    const minutes = now.getUTCMinutes();
    const roundedMinutes = Math.floor(minutes / 2) * 2;
    now.setUTCMinutes(roundedMinutes, 0, 0); // Set seconds and ms to 0

    const snapshotTime = now.toISOString();

    // Insert snapshot (or update if already exists for this time)
    await client.query(
      `
      INSERT INTO intraday_sentiment_snapshot (snapshot_time, total_bullish, total_bearish, net_sentiment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (snapshot_time)
      DO UPDATE SET
        total_bullish = $2,
        total_bearish = $3,
        net_sentiment = $4,
        created_at = CURRENT_TIMESTAMP
    `,
      [snapshotTime, totalBullish, totalBearish, netSentiment]
    );

    const etTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
    console.log(
      `💾 Intraday snapshot saved: ${etTimeStr} ET - Bullish=$${totalBullish.toFixed(2)}, Bearish=$${totalBearish.toFixed(2)}, Net=$${netSentiment.toFixed(2)}`
    );

    return {
      snapshot_time: snapshotTime,
      total_bullish: totalBullish,
      total_bearish: totalBearish,
      net_sentiment: netSentiment,
    };
  } catch (error) {
    console.error('Error saving intraday snapshot:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Get intraday snapshots for a specific date
async function getIntradaySnapshots(date, limit = 100) {
  const client = await pool.connect();
  try {
    let query;
    let params;

    if (date) {
      // Get snapshots for specific date
      query = `
        SELECT snapshot_time, total_bullish, total_bearish, net_sentiment, created_at
        FROM intraday_sentiment_snapshot
        WHERE DATE(snapshot_time) = $1
        ORDER BY snapshot_time ASC
      `;
      params = [date];
    } else {
      // Get recent snapshots
      query = `
        SELECT snapshot_time, total_bullish, total_bearish, net_sentiment, created_at
        FROM intraday_sentiment_snapshot
        ORDER BY snapshot_time DESC
        LIMIT $1
      `;
      params = [limit];
    }

    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting intraday snapshots:', error);
    return [];
  } finally {
    client.release();
  }
}

// Save holdings cache to database
async function saveHoldingsCache(spy, qqq) {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS holdings_cache (
        id INTEGER PRIMARY KEY DEFAULT 1,
        spy_holdings JSONB NOT NULL,
        qqq_holdings JSONB NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT single_row CHECK (id = 1)
      )
    `);

    await client.query(
      `
      INSERT INTO holdings_cache (id, spy_holdings, qqq_holdings, last_updated)
      VALUES (1, $1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (id)
      DO UPDATE SET
        spy_holdings = $1,
        qqq_holdings = $2,
        last_updated = CURRENT_TIMESTAMP
    `,
      [JSON.stringify(spy), JSON.stringify(qqq)]
    );

    console.log('💾 Saved holdings cache to database');
  } catch (error) {
    console.error('Error saving holdings cache:', error);
  } finally {
    client.release();
  }
}

// Load holdings cache from database
async function loadHoldingsCache() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT spy_holdings, qqq_holdings, last_updated
      FROM holdings_cache
      WHERE id = 1
    `);

    if (result.rows.length > 0) {
      console.log('📂 Loaded holdings cache from database');
      return {
        spy: result.rows[0].spy_holdings,
        qqq: result.rows[0].qqq_holdings,
        lastUpdated: result.rows[0].last_updated,
      };
    }
  } catch (error) {
    // Table doesn't exist yet - that's okay
    console.log('📂 No holdings cache found in database');
  } finally {
    client.release();
  }
  return null;
}

module.exports = {
  pool,
  initDatabase,
  updateSentiment,
  getAllSentiments,
  resetSentiments,
  saveEODSnapshot,
  getEODSnapshots,
  saveIntradaySnapshot,
  getIntradaySnapshots,
  saveHoldingsCache,
  loadHoldingsCache,
};
