const { Pool } = require('pg');

const productionUrl = 'postgresql://postgres:ELdoIXBDGmkSOvaPiwonroosntniXrpO@tramway.proxy.rlwy.net:10954/railway';

async function resetProduction() {
  const pool = new Pool({
    connectionString: productionUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  
  try {
    console.log('🔄 Resetting production sentiment data...');
    console.log(`Database: ${productionUrl}`);
    
    await client.query(`
      UPDATE ticker_sentiment
      SET bullish_amount = 0, bearish_amount = 0, last_updated = CURRENT_TIMESTAMP
    `);
    
    console.log('✅ Production data reset successfully!');
    console.log('All sentiment amounts have been cleared to 0.');
    console.log('New tickers will be tracked with the updated holdings.');
  } catch (error) {
    console.error('❌ Error resetting production data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

resetProduction();

