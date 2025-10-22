#!/bin/bash

echo "════════════════════════════════════════════════════════════════════════════════"
echo "🚀 DEPLOYING YOUR ULTIMATE PREMIUM BOT - TOP 10% VERSION"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pip3 install -q web3 python-dotenv eth-account py-solc-x python-telegram-bot

echo ""
echo "✅ Dependencies installed!"
echo ""

# Check .env
if [ ! -f .env ]; then
    echo "⚠️  Creating .env file..."
    cp .env.example .env
    echo ""
    echo "🔧 Please edit .env and add:"
    echo "   1. Your PRIVATE_KEY"
    echo "   2. Your TELEGRAM_BOT_TOKEN"
    echo "   3. Your TELEGRAM_CHAT_ID"
    echo ""
    echo "Then run this script again!"
    exit 1
fi

echo "✅ Configuration found!"
echo ""

# Deploy contract
echo "📝 Deploying smart contract to Arbitrum..."
echo ""

python3 deploy_production_contract.py

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Deployment failed! Check errors above."
    exit 1
fi

echo ""
echo "✅ Smart contract deployed!"
echo ""

# Start bot
echo "🚀 Starting ULTIMATE PREMIUM BOT..."
echo ""
echo "Bot will:"
echo "  • Scan every 10 minutes"
echo "  • Find 3-5+ opportunities per scan"
echo "  • Execute instantly when profitable"
echo "  • Send Telegram alerts"
echo ""
echo "Press Ctrl+C to stop"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

python3 ULTIMATE_PREMIUM_BOT.py
