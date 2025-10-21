#!/usr/bin/env python3
"""
Setup script for WETH Price Monitor
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required packages"""
    print("Installing required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Requirements installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install requirements: {e}")
        return False

def check_env_file():
    """Check if .env file exists and has required variables"""
    if not os.path.exists('.env'):
        print("❌ .env file not found")
        return False
    
    required_vars = ['ALCHEMY_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
    missing_vars = []
    
    with open('.env', 'r') as f:
        content = f.read()
        for var in required_vars:
            if f"{var}=" not in content:
                missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        return False
    
    print("✅ Environment variables configured")
    return True

def main():
    """Main setup function"""
    print("🔧 Setting up WETH Price Monitor...")
    print("=" * 40)
    
    # Check environment file
    if not check_env_file():
        print("\nPlease ensure your .env file contains:")
        print("ALCHEMY_URL=your_alchemy_url")
        print("TELEGRAM_BOT_TOKEN=your_bot_token")
        print("TELEGRAM_CHAT_ID=your_chat_id")
        return False
    
    # Install requirements
    if not install_requirements():
        return False
    
    print("\n✅ Setup completed successfully!")
    print("\nTo start monitoring, run:")
    print("python weth_monitor.py")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)