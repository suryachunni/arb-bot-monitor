#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  ARBITRUM ARBITRAGE BOT LAUNCHER      ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🚀 Starting Arbitrage Bot..."
echo ""
echo "Press Ctrl+C to stop the bot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm start
