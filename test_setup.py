#!/usr/bin/env python3
"""
Test script to verify the WETH monitor setup
"""

import os
import sys
from dotenv import load_dotenv
import requests

def test_environment():
    """Test environment variables"""
    print("🔍 Testing Environment Variables...")
    load_dotenv()
    
    required_vars = [
        'ALCHEMY_RPC_URL',
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_CHAT_ID'
    ]
    
    missing = []
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Mask sensitive data
            if 'TOKEN' in var or 'URL' in var:
                masked = value[:20] + '...' if len(value) > 20 else value
                print(f"  ✅ {var}: {masked}")
            else:
                print(f"  ✅ {var}: {value}")
        else:
            print(f"  ❌ {var}: Not found")
            missing.append(var)
    
    if missing:
        print(f"\n❌ Missing environment variables: {', '.join(missing)}")
        return False
    
    print("✅ All environment variables configured\n")
    return True


def test_web3_connection():
    """Test Web3 connection to Arbitrum"""
    print("🔍 Testing Arbitrum Connection...")
    try:
        from web3 import Web3
        load_dotenv()
        
        rpc_url = os.getenv('ALCHEMY_RPC_URL')
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        
        if w3.is_connected():
            chain_id = w3.eth.chain_id
            block = w3.eth.block_number
            print(f"  ✅ Connected to Arbitrum")
            print(f"  ✅ Chain ID: {chain_id}")
            print(f"  ✅ Latest Block: {block:,}")
            
            if chain_id != 42161:
                print(f"  ⚠️  Warning: Expected Chain ID 42161 (Arbitrum), got {chain_id}")
                return False
            
            print("✅ Web3 connection successful\n")
            return True
        else:
            print("  ❌ Failed to connect to Arbitrum")
            return False
            
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


def test_telegram():
    """Test Telegram bot connection"""
    print("🔍 Testing Telegram Bot...")
    try:
        load_dotenv()
        
        bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        chat_id = os.getenv('TELEGRAM_CHAT_ID')
        
        # Test bot info
        url = f"https://api.telegram.org/bot{bot_token}/getMe"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                bot_info = data.get('result', {})
                print(f"  ✅ Bot Name: {bot_info.get('first_name')}")
                print(f"  ✅ Bot Username: @{bot_info.get('username')}")
            else:
                print(f"  ❌ Bot API error: {data}")
                return False
        else:
            print(f"  ❌ Failed to get bot info: {response.status_code}")
            return False
        
        # Test sending message
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        test_message = "🧪 Test message from WETH Monitor setup"
        data = {
            "chat_id": chat_id,
            "text": test_message
        }
        
        response = requests.post(url, data=data, timeout=10)
        
        if response.status_code == 200:
            print(f"  ✅ Test message sent to chat {chat_id}")
            print("✅ Telegram connection successful\n")
            return True
        else:
            print(f"  ❌ Failed to send message: {response.text}")
            return False
            
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


def test_dependencies():
    """Test required Python packages"""
    print("🔍 Testing Python Dependencies...")
    
    required_packages = [
        'web3',
        'telegram',
        'requests',
        'dotenv'
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"  ✅ {package}")
        except ImportError:
            print(f"  ❌ {package}")
            missing.append(package)
    
    if missing:
        print(f"\n❌ Missing packages: {', '.join(missing)}")
        print("Run: pip install -r requirements.txt")
        return False
    
    print("✅ All dependencies installed\n")
    return True


def main():
    """Run all tests"""
    print("=" * 60)
    print("WETH Price Monitor - Setup Test")
    print("=" * 60)
    print()
    
    tests = [
        ("Dependencies", test_dependencies),
        ("Environment", test_environment),
        ("Arbitrum RPC", test_web3_connection),
        ("Telegram Bot", test_telegram),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name} test failed with error: {e}\n")
            results.append((name, False))
    
    print("=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    all_passed = all(result for _, result in results)
    
    print()
    if all_passed:
        print("🎉 All tests passed! Your monitor is ready to run.")
        print("\nStart the monitor with:")
        print("  python3 weth_price_monitor.py")
        print("or:")
        print("  ./run_monitor.sh")
        return 0
    else:
        print("⚠️  Some tests failed. Please fix the issues above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
