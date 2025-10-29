# Dark Pool Sentiment Tracker

Real-time dark pool sentiment analysis for the top 15 holdings of SPY and QQQ ETFs.

## Overview

This application tracks dark pool trades for the top 15 holdings of SPY and QQQ using Polygon.io's WebSocket API. It analyzes sentiment by comparing dark pool trade prices against current minute bar prices:

- **Bullish**: Dark pool trades executed below current market price
- **Bearish**: Dark pool trades executed above current market price

## Features

- Real-time WebSocket connection to Polygon.io
- Tracks 23 unique tickers (top 15 from SPY and QQQ combined)
- Filters trades for dark pool condition codes
- Stores cumulative bullish/bearish dollar amounts in PostgreSQL
- Beautiful real-time dashboard with auto-refresh
- Railway-ready deployment configuration

## Tracked Tickers

### SPY Top 15 (as of Oct 29, 2025)
NVDA, MSFT, AAPL, AMZN, META, AVGO, GOOGL, GOOG, TSLA, BRK.B, JPM, JNJ, UNH, XOM, PG

### QQQ Top 15 (as of Oct 29, 2025)
AAPL, MSFT, AMZN, NVDA, META, GOOGL, GOOG, TSLA, AVGO, PEP, COST, ADBE, CSCO, CMCSA, INTC

## Tech Stack

- **Backend**: Node.js, Express
- **WebSocket**: Polygon.io Stocks WebSocket API
- **Database**: PostgreSQL
- **Frontend**: Vanilla JavaScript, CSS3
- **Deployment**: Railway

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Polygon.io API key

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
POLYGON_API_KEY=your_polygon_api_key
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/dp_sentiment
```

4. Start the server:
```bash
npm start
```

5. Open browser to `http://localhost:3000`

## Railway Deployment

### Setup

1. Create a new project on Railway
2. Add PostgreSQL database service
3. Add environment variables:
   - `POLYGON_API_KEY`: Your Polygon.io API key
   - `DATABASE_URL`: (automatically set by Railway PostgreSQL)
   - `PORT`: (automatically set by Railway)

4. Deploy from GitHub or CLI:
```bash
railway up
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| POLYGON_API_KEY | Polygon.io API key | Yes |
| DATABASE_URL | PostgreSQL connection string | Yes |
| PORT | Server port (auto-set by Railway) | No |

## API Endpoints

- `GET /` - Dashboard UI
- `GET /api/sentiments` - Get all ticker sentiments (JSON)
- `GET /health` - Health check endpoint

## Dark Pool Detection

The application identifies dark pool trades using Polygon.io trade condition codes:

- **12**: Form T (late reporting)
- **37**: Odd Lot Trade
- **38**: Odd Lot Cross Trade
- **52**: Intermarket Sweep
- **53**: Derivatively Priced
- **54**: Re-opening Prints
- **55**: Closing Prints
- **56**: Qualified Contingent Trade (QCT)

## Database Schema

```sql
CREATE TABLE ticker_sentiment (
  ticker VARCHAR(10) PRIMARY KEY,
  bullish_amount DECIMAL(20, 2) DEFAULT 0,
  bearish_amount DECIMAL(20, 2) DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Architecture

1. **WebSocket Client** (`polygonWebSocket.js`):
   - Connects to Polygon.io WebSocket
   - Subscribes to minute aggregates (AM) for current prices
   - Subscribes to trades (T) for dark pool detection
   - Filters trades by condition codes
   - Calculates sentiment and updates database

2. **Database Layer** (`database.js`):
   - PostgreSQL connection pool
   - Schema initialization
   - Sentiment update operations
   - Query operations

3. **API Server** (`server.js`):
   - Express server
   - REST API endpoints
   - Static file serving

4. **Dashboard** (`public/`):
   - Real-time data visualization
   - Auto-refresh every 5 seconds
   - Responsive design

## Notes

- All trades are pass-through; only cumulative $ amounts are stored
- Dashboard updates every 5 seconds
- WebSocket automatically reconnects on disconnection
- Holdings list should be updated periodically to reflect ETF rebalancing

## License

ISC

