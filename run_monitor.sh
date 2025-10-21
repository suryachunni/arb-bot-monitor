#!/bin/bash

# Arbitrum WETH Price Monitor Startup Script

echo "🚀 Starting Arbitrum WETH Price Monitor..."
echo "=========================================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip3."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pip3 install -r requirements.txt

# Test connections first
echo "🔍 Testing connections..."
python3 test_connection.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed! Starting price monitoring..."
    echo "📱 You will receive alerts on Telegram every 3 minutes"
    echo "⏹️  Press Ctrl+C to stop monitoring"
    echo ""
    
    # Start the main monitoring script
    python3 arbitrum_price_monitor.py
else
    echo "❌ Tests failed. Please check your configuration and try again."
    exit 1
fi