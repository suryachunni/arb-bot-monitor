#!/bin/bash

echo "🚀 Starting Arbitrum Arbitrage Scanner Bot..."
echo "=============================================="
echo ""
echo "📡 Network: Arbitrum Mainnet"
echo "💎 Tokens: WETH, ARB, USDC, LINK, MAGIC, USDT, DAI"
echo "🏦 DEXs: Uniswap V3, Sushiswap, Camelot"
echo "📱 Telegram Alerts: Every 3 minutes"
echo "🔍 Scan Interval: Every 10 seconds"
echo ""
echo "=============================================="
echo ""

# Install dependencies if needed
if ! python3 -c "import web3" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -q web3 requests
fi

# Start the bot
python3 arbitrage_bot.py
