#!/bin/bash

echo "════════════════════════════════════════════════════════════════"
echo "  🚀 SERVER BOT SETUP - ONE-TIME INSTALLATION"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Please run as root: sudo bash setup_server.sh"
    exit 1
fi

echo "📦 Installing system dependencies..."
apt-get update -qq
apt-get install -y python3 python3-pip screen htop -qq

echo ""
echo "📦 Installing Python packages..."
pip3 install web3 python-telegram-bot python-dotenv psutil --quiet

echo ""
echo "📁 Creating bot directory..."
mkdir -p /opt/arbitrage_bot
cp *.py /opt/arbitrage_bot/
cp .env /opt/arbitrage_bot/ 2>/dev/null || echo "Note: .env not found, will create"

echo ""
echo "📝 Setting up environment..."
if [ ! -f /opt/arbitrage_bot/.env ]; then
    cat > /opt/arbitrage_bot/.env << 'EOF'
# Telegram
TELEGRAM_BOT_TOKEN=7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU
TELEGRAM_CHAT_ID=8305086804

# Arbitrum RPC
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Optional: For execution
PRIVATE_KEY=
ARBITRAGE_CONTRACT_ADDRESS=

# Safety limits
MAX_GAS_PRICE_GWEI=2.0
MIN_PROFIT_USD=50
EOF
fi

echo ""
echo "🔧 Creating systemd service..."
cat > /etc/systemd/system/arbitrage-bot.service << 'EOF'
[Unit]
Description=Ultra Arbitrage Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/arbitrage_bot
ExecStart=/usr/bin/python3 /opt/arbitrage_bot/SERVER_BOT.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/arbitrage-bot.log
StandardError=append:/var/log/arbitrage-bot-error.log

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "🔄 Enabling service..."
systemctl daemon-reload
systemctl enable arbitrage-bot.service

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ SETUP COMPLETE!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📋 Available commands:"
echo ""
echo "  Start bot:    sudo systemctl start arbitrage-bot"
echo "  Stop bot:     sudo systemctl stop arbitrage-bot"
echo "  Restart bot:  sudo systemctl restart arbitrage-bot"
echo "  View logs:    sudo journalctl -u arbitrage-bot -f"
echo "  Bot status:   sudo systemctl status arbitrage-bot"
echo ""
echo "🎯 Next steps:"
echo ""
echo "  1. Start the bot:"
echo "     sudo systemctl start arbitrage-bot"
echo ""
echo "  2. Open Telegram and send: /start"
echo ""
echo "  3. Click 🚀 START BOT button"
echo ""
echo "  4. Bot runs 24/7, your mobile can be off!"
echo ""
echo "════════════════════════════════════════════════════════════════"
