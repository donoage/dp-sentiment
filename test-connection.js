const PolygonWebSocketClient = require('./polygonWebSocket');
const { initDatabase } = require('./database');
require('dotenv').config();

async function test() {
  console.log('='.repeat(60));
  console.log('Dark Pool Sentiment Tracker - Connection Test');
  console.log('='.repeat(60));

  // Initialize database
  console.log('\n[1/3] Initializing database...');
  try {
    await initDatabase();
    console.log('✓ Database initialized successfully');
  } catch (error) {
    console.error('✗ Database initialization failed:', error.message);
    process.exit(1);
  }

  // Check API key
  console.log('\n[2/3] Checking Polygon API key...');
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.error('✗ POLYGON_API_KEY not found in .env');
    process.exit(1);
  }
  console.log(`✓ API key found: ${apiKey.substring(0, 10)}...`);

  // Connect to WebSocket
  console.log('\n[3/3] Connecting to Polygon WebSocket...');
  const wsClient = new PolygonWebSocketClient(apiKey);
  wsClient.connect();

  console.log('\n' + '='.repeat(60));
  console.log('Listening for dark pool trades...');
  console.log('Press Ctrl+C to stop');
  console.log('='.repeat(60) + '\n');

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    wsClient.disconnect();
    process.exit(0);
  });
}

test();
