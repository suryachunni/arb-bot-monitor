#!/bin/bash

# WETH Price Monitor - Arbitrum Mainnet
# This script runs the WETH price monitor continuously

echo "🚀 WETH Price Monitor - Arbitrum DEX Scanner"
echo "=============================================="
echo ""

# Install dependencies if needed
if ! python3 -c "import web3" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    python3 -m pip install -q -r requirements.txt
    echo "✅ Dependencies installed"
    echo ""
fi

# Run the monitor with unbuffered output
echo "▶️  Starting monitor (Press Ctrl+C to stop)..."
echo ""
python3 -u weth_price_monitor.py
