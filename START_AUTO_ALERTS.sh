#!/bin/bash

echo "════════════════════════════════════════════════════════════════"
echo "  🚀 STARTING AUTO-ALERT BOT WITH EXECUTE BUTTONS"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "This bot will:"
echo "  ✅ Scan for opportunities every 3 minutes"
echo "  ✅ Send alerts to your Telegram"
echo "  ✅ Include EXECUTE buttons for each opportunity"
echo "  ✅ Execute trades when you click the button"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  WARNING: .env file not found!"
    echo "Creating from template..."
    cp .env.example .env
    echo ""
    echo "❌ Please edit .env and add your PRIVATE_KEY"
    echo "Then run this script again"
    exit 1
fi

# Start the bot
python3 auto_alert_with_buttons.py
