# Railway Deployment Steps

## Quick Deploy Guide

### Step 1: Push to GitHub (if you want to use GitHub deployment)

```bash
# Create a new repository on GitHub first, then:
cd ~/Projects/dp-sentiment
git remote add origin https://github.com/YOUR_USERNAME/dp-sentiment.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy via Railway CLI (Recommended - Faster)

```bash
cd ~/Projects/dp-sentiment

# Login to Railway (opens browser)
railway login

# Create new project
railway init

# Add PostgreSQL database
railway add --database postgresql

# Set environment variable
railway variables --set POLYGON_API_KEY=S08ktzv3Ip5XAMeu6FewW37BJ_2YOIsn

# Deploy
railway up

# Open in browser
railway open
```

### Step 3: Alternative - Deploy via Railway Dashboard

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your `dp-sentiment` repository
4. Railway will auto-detect the configuration from `railway.json`
5. Add PostgreSQL:
   - Click "+ New" 
   - Select "Database" → "PostgreSQL"
   - Railway automatically sets `DATABASE_URL`
6. Add environment variable:
   - Go to project settings
   - Variables tab
   - Add: `POLYGON_API_KEY=S08ktzv3Ip5XAMeu6FewW37BJ_2YOIsn`
7. Deploy!

## Environment Variables Needed

```
POLYGON_API_KEY=S08ktzv3Ip5XAMeu6FewW37BJ_2YOIsn
DATABASE_URL=<automatically set by Railway PostgreSQL>
PORT=<automatically set by Railway>
```

## What Gets Deployed

✅ **Lightweight Database Schema:**
- Only stores: `ticker`, `bullish_amount`, `bearish_amount`, `last_updated`
- No historical data
- Just cumulative totals for each ticker
- Minimal storage footprint

✅ **Services:**
- Express web server
- Polygon WebSocket client
- PostgreSQL database
- Real-time dashboard

## Post-Deployment

After deployment, Railway will provide a URL like:
`https://dp-sentiment-production.up.railway.app`

Visit that URL to see your live dashboard!

## Monitoring

```bash
# View logs
railway logs

# Check status
railway status

# Connect to database
railway run psql $DATABASE_URL
```

## Cost Estimate

- Railway Free Tier: $5 credit/month (enough for 24/7 operation)
- PostgreSQL: Included in free tier
- Bandwidth: Minimal (only API calls and WebSocket)
- Storage: < 1MB (only 23 ticker records)

## Troubleshooting

If WebSocket doesn't connect:
1. Check Railway logs: `railway logs`
2. Verify `POLYGON_API_KEY` is set correctly
3. Ensure PostgreSQL is running

If no data appears:
1. Market must be open for live trades
2. Check logs for "Connected to Polygon WebSocket"
3. Verify darkpool trades are being detected

