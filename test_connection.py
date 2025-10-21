#!/usr/bin/env python3
"""
Test script to verify connections and basic functionality
"""

import asyncio
import os
from dotenv import load_dotenv
from arbitrum_price_monitor import ArbitrumPriceMonitor

async def test_connections():
    """Test all connections and basic functionality"""
    load_dotenv()
    
    print("🔍 Testing Arbitrum WETH Price Monitor...")
    print("=" * 50)
    
    # Test 1: Environment variables
    print("1. Checking environment variables...")
    required_vars = ['ALCHEMY_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"❌ Missing variables: {missing_vars}")
        return False
    else:
        print("✅ All environment variables found")
    
    # Test 2: Web3 connection
    print("\n2. Testing Web3 connection to Arbitrum...")
    try:
        monitor = ArbitrumPriceMonitor()
        latest_block = monitor.w3.eth.block_number
        print(f"✅ Connected to Arbitrum. Latest block: {latest_block}")
    except Exception as e:
        print(f"❌ Web3 connection failed: {e}")
        return False
    
    # Test 3: Telegram bot
    print("\n3. Testing Telegram bot...")
    try:
        await monitor.bot.get_me()
        print("✅ Telegram bot connection successful")
    except Exception as e:
        print(f"❌ Telegram bot connection failed: {e}")
        return False
    
    # Test 4: Price fetching
    print("\n4. Testing price fetching from DEXs...")
    try:
        prices = await monitor.get_weth_prices()
        if prices:
            print("✅ Successfully fetched prices from DEXs:")
            for pair, dex_prices in prices.items():
                print(f"  {pair}: {len(dex_prices)} DEXs")
        else:
            print("⚠️  No prices fetched (this might be normal if pools are empty)")
    except Exception as e:
        print(f"❌ Price fetching failed: {e}")
        return False
    
    # Test 5: Send test message
    print("\n5. Sending test message to Telegram...")
    try:
        test_prices = {
            "WETH/USDC": {
                "Uniswap V3": 2000.50,
                "SushiSwap": 2001.25,
                "Camelot": 2000.75
            }
        }
        test_opportunities = [{
            "pair": "WETH/USDC",
            "buy_dex": "Uniswap V3",
            "sell_dex": "SushiSwap",
            "buy_price": 2000.50,
            "sell_price": 2001.25,
            "spread_percentage": 0.037,
            "profit_per_weth": 0.75
        }]
        
        await monitor.send_telegram_alert(test_prices, test_opportunities)
        print("✅ Test message sent successfully")
    except Exception as e:
        print(f"❌ Failed to send test message: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("🎉 All tests passed! The system is ready to run.")
    print("Run 'python arbitrum_price_monitor.py' to start monitoring.")
    
    return True

if __name__ == "__main__":
    asyncio.run(test_connections())