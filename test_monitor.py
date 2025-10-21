#!/usr/bin/env python3
"""
Test script for WETH price monitor
Run this to test the system before starting continuous monitoring
"""

import asyncio
import sys
from weth_price_monitor import WETHPriceMonitor

async def test_single_check():
    """Test a single price check"""
    print("🧪 Testing WETH Price Monitor...")
    print("=" * 50)
    
    monitor = WETHPriceMonitor()
    
    try:
        # Test connection to Arbitrum
        if not monitor.w3.is_connected():
            print("❌ Failed to connect to Arbitrum network")
            return False
        else:
            print("✅ Connected to Arbitrum network")
        
        # Test Telegram bot
        try:
            await monitor.telegram_bot.get_me()
            print("✅ Telegram bot connection successful")
        except Exception as e:
            print(f"❌ Telegram bot error: {e}")
            return False
        
        # Run a single price check
        print("\n📊 Fetching WETH prices from all DEXs...")
        await monitor.run_price_check()
        
        print("✅ Test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

async def main():
    """Main test function"""
    success = await test_single_check()
    
    if success:
        print("\n🎉 All tests passed! You can now run the main monitor.")
        print("To start monitoring, run: python weth_price_monitor.py")
    else:
        print("\n💥 Tests failed. Please check your configuration.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())