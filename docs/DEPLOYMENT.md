# Railway Deployment Guide

## Quick Deploy to Railway

### Step 1: Prepare Repository

```bash
cd ~/Projects/dp-sentiment
git init
git add .
git commit -m "Initial commit: Dark pool sentiment tracker"
```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo" (or "Empty Project" if deploying via CLI)

### Step 3: Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically create a PostgreSQL instance and set `DATABASE_URL`

### Step 4: Configure Environment Variables

In your Railway project settings, add:

```
POLYGON_API_KEY=S08ktzv3Ip5XAMeu6FewW37BJ_2YOIsn
```

Note: `DATABASE_URL` and `PORT` are automatically set by Railway.

### Step 5: Deploy

#### Option A: GitHub (Recommended)

1. Push your code to GitHub:
```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

2. In Railway, connect your GitHub repository
3. Railway will automatically deploy

#### Option B: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up
```

### Step 6: Verify Deployment

1. Check the Railway logs for successful connection messages:
   - "Connected to Polygon WebSocket"
   - "Authentication successful"
   - "Subscribed to minute aggregates for: ..."
   - "Subscribed to trades for: ..."

2. Open your Railway-provided URL to view the dashboard

## Post-Deployment

### Monitor Logs

```bash
railway logs
```

### Check Database

```bash
railway run psql $DATABASE_URL
```

Then run:
```sql
SELECT * FROM ticker_sentiment ORDER BY ticker;
```

### Update Holdings

To update the ticker list, edit `config.js` and redeploy:

```bash
git add config.js
git commit -m "Update holdings"
git push
```

## Troubleshooting

### WebSocket Not Connecting

- Verify `POLYGON_API_KEY` is set correctly
- Check Polygon.io API key permissions (needs WebSocket access)
- Review Railway logs for authentication errors

### Database Connection Issues

- Ensure PostgreSQL service is running in Railway
- Verify `DATABASE_URL` is set (should be automatic)
- Check database logs in Railway

### No Data Showing

- Verify market hours (WebSocket data only flows during market hours)
- Check that tickers are correctly subscribed
- Review logs for trade filtering messages

## Scaling Considerations

- Current setup handles ~23 tickers efficiently
- PostgreSQL on Railway's free tier is sufficient for this use case
- WebSocket connection is persistent and auto-reconnects
- Consider adding Redis for caching if expanding to more tickers

## Cost Estimate

- **Railway**: Free tier includes 500 hours/month (sufficient for 24/7 operation)
- **Polygon.io**: Requires Stocks Developer plan or higher for WebSocket access
- **Database**: Included in Railway free tier (1GB storage)

## Maintenance

- Update holdings quarterly to match ETF rebalancing
- Monitor disk usage if running long-term
- Consider adding a daily reset job if needed

