#!/bin/bash

clear

cat << 'EOF'

╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║              🚀 ARBITRAGE BOT - STARTING WITH EXECUTE BUTTONS! 🚀             ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

EOF

echo "📦 Installing dependencies..."
pip install -q web3 requests python-telegram-bot python-dotenv 2>&1 | grep -v "WARNING: The script"

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "🚀 Starting bot..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📱 CHECK YOUR TELEGRAM!"
echo ""
echo "  You will receive alerts every 3 minutes with:"
echo "  ✅ Real arbitrage opportunities"
echo "  ✅ NET profit calculations"
echo "  ✅ EXECUTE buttons"
echo ""
echo "  Click [⚡ EXECUTE] to trade instantly!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Bot is running... Press Ctrl+C to stop"
echo ""

python3 RUN_BOT.py
