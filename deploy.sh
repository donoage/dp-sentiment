#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         DP-SENTIMENT Railway Deployment Script                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in dp-sentiment directory"
    exit 1
fi

echo "📦 Step 1: Checking Railway CLI..."
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
else
    echo "✅ Railway CLI found"
fi

echo ""
echo "🔐 Step 2: Login to Railway..."
echo "   (This will open your browser)"
railway login

echo ""
echo "🚀 Step 3: Initialize Railway project..."
railway init

echo ""
echo "🗄️  Step 4: Add PostgreSQL database..."
railway add --database postgresql

echo ""
echo "🔑 Step 5: Setting environment variables..."
railway variables --set POLYGON_API_KEY=S08ktzv3Ip5XAMeu6FewW37BJ_2YOIsn

echo ""
echo "📤 Step 6: Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Opening your app in browser..."
railway open

echo ""
echo "📊 View logs with: railway logs"
echo "🔧 Manage project: https://railway.app/dashboard"

