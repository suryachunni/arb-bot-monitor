#!/bin/bash

clear

cat << 'EOF'

╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║                🚀 STARTING PRODUCTION ARBITRAGE BOT 🚀                         ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

✅ PRODUCTION FEATURES:

  • Real-time blockchain prices (Uniswap V3)
  • MEV protection ready
  • Slippage guards (0.5% max)
  • Gas optimization
  • All costs calculated
  • NET profits only
  • Execute buttons in Telegram

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF

echo "📦 Installing dependencies..."
pip install -q web3 python-telegram-bot python-dotenv 2>&1 | grep -v "WARNING:"

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "🚀 Starting production bot..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📱 CHECK YOUR TELEGRAM!"
echo ""
echo "  You will receive alerts every 3 minutes with:"
echo "  ✅ Real arbitrage opportunities"
echo "  ✅ NET profit after ALL costs"
echo "  ✅ EXECUTE buttons"
echo ""
echo "  Click [⚡ EXECUTE] to trade!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

python3 FINAL_PRODUCTION_BOT.py
