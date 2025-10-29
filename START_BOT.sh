#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# PRODUCTION BOT STARTUP SCRIPT
# Automated deployment with safety checks
# ═══════════════════════════════════════════════════════════════════

set -e  # Exit on error

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "   FLASH LOAN ARBITRAGE BOT - PRODUCTION STARTUP"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ ERROR: .env.production not found${NC}"
    echo "Please create .env.production with your configuration"
    exit 1
fi

# Check if private key is set
if grep -q "YOUR_PRIVATE_KEY_HERE" .env.production; then
    echo -e "${RED}❌ ERROR: Private key not configured${NC}"
    echo "Please set your PRIVATE_KEY in .env.production"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ ERROR: Node.js 18+ required (found v$NODE_VERSION)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pre-flight checks passed${NC}"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Check if contract is deployed
if grep -q "FLASH_LOAN_CONTRACT_ADDRESS=$" .env.production || grep -q "FLASH_LOAN_CONTRACT_ADDRESS=\"\"" .env.production; then
    echo -e "${YELLOW}⚠️  WARNING: Flash loan contract not deployed${NC}"
    echo ""
    read -p "Do you want to deploy the contract now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Deploying contract to Arbitrum mainnet..."
        npm run deploy
        echo ""
    else
        echo -e "${YELLOW}⚠️  Continuing without contract deployment${NC}"
        echo "   Note: You won't be able to execute trades until contract is deployed"
        echo ""
    fi
fi

# Create logs directory
mkdir -p logs

# Ask deployment mode
echo "Select deployment mode:"
echo "1) Development (terminal output, Ctrl+C to stop)"
echo "2) Production (PM2, 24/7 background)"
echo ""
read -p "Enter choice (1 or 2): " -n 1 -r
echo ""

if [[ $REPLY == "1" ]]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo "   STARTING IN DEVELOPMENT MODE"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "Press Ctrl+C to stop"
    echo ""
    sleep 2
    npm start

elif [[ $REPLY == "2" ]]; then
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}⚠️  PM2 not found. Installing...${NC}"
        npm install -g pm2
    fi

    # Stop existing instance if running
    pm2 delete flash-loan-bot 2>/dev/null || true

    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo "   STARTING IN PRODUCTION MODE"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""

    # Start with PM2
    pm2 start ecosystem.config.js

    # Save PM2 configuration
    pm2 save

    # Setup PM2 startup (auto-start on reboot)
    pm2 startup | tail -n 1 > /tmp/pm2_startup.sh
    if [ -s /tmp/pm2_startup.sh ]; then
        echo ""
        echo -e "${YELLOW}To enable auto-start on reboot, run:${NC}"
        cat /tmp/pm2_startup.sh
        echo ""
    fi

    echo ""
    echo -e "${GREEN}✅ Bot started successfully!${NC}"
    echo ""
    echo "Management commands:"
    echo "  pm2 status              - Check status"
    echo "  pm2 logs flash-loan-bot - View logs"
    echo "  pm2 restart flash-loan-bot - Restart bot"
    echo "  pm2 stop flash-loan-bot - Stop bot"
    echo ""
    echo "Viewing logs in 3 seconds..."
    sleep 3
    pm2 logs flash-loan-bot

else
    echo -e "${RED}❌ Invalid choice${NC}"
    exit 1
fi
