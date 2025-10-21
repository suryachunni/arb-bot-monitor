#!/bin/bash

echo "🚀 Starting WETH Price Monitor for Arbitrum"
echo "=========================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Run the monitor
echo "▶️  Starting monitor..."
echo ""
python3 weth_price_monitor.py
