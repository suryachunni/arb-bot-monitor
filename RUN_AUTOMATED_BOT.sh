#!/bin/bash

cat << 'EOF'

╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║               🤖 STARTING FULLY AUTOMATED BOT - NO MANUAL INTERVENTION! 🤖    ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

FEATURES:
  ✅ Scans automatically every 10 minutes
  ✅ Finds 3-5+ opportunities per scan
  ✅ INSTANTLY executes when profitable
  ✅ Sends profit to your wallet automatically
  ✅ Runs 24/7 non-stop
  
NO BUTTONS | NO CLICKS | 100% AUTOMATIC! 🚀

════════════════════════════════════════════════════════════════════════════════

EOF

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  ERROR: .env file not found!"
    echo ""
    echo "Please run this first:"
    echo "  cp .env.example .env"
    echo "  nano .env  # Add your PRIVATE_KEY"
    echo ""
    exit 1
fi

# Check if contract is deployed
if ! grep -q "ARBITRAGE_CONTRACT_ADDRESS=0x" .env 2>/dev/null; then
    echo "⚠️  ERROR: Contract not deployed yet!"
    echo ""
    echo "Please deploy first:"
    echo "  python3 deploy_production_contract.py"
    echo ""
    exit 1
fi

echo "✅ Configuration found!"
echo "✅ Contract deployed!"
echo ""
echo "🚀 Starting FULLY AUTOMATED BOT..."
echo ""
echo "The bot will now:"
echo "  • Scan every 10 minutes"
echo "  • Find profitable opportunities"
echo "  • Execute trades INSTANTLY (no manual action!)"
echo "  • Send profit to your wallet automatically"
echo ""
echo "Press Ctrl+C to stop"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Start the bot
python3 ULTIMATE_PREMIUM_BOT.py
