"""
Simple Telegram test - send a test message
"""

import requests

TELEGRAM_BOT_TOKEN = "7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU"
TELEGRAM_CHAT_ID = "8305086804"

def send_test():
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    message = (
        "🧪 <b>TELEGRAM TEST</b>\n\n"
        "If you see this, Telegram is working!\n\n"
        "✅ Bot Token: Working\n"
        "✅ Chat ID: Correct\n"
        "✅ Connection: Active\n\n"
        "You should receive arbitrage alerts here!"
    )
    
    data = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML"
    }
    
    print("Sending test message to Telegram...")
    response = requests.post(url, data=data, timeout=10)
    
    if response.status_code == 200:
        print("✅ SUCCESS! Message sent!")
        print(f"Response: {response.json()}")
        print("\n📱 Check your Telegram app NOW!")
    else:
        print(f"❌ FAILED! Status: {response.status_code}")
        print(f"Error: {response.text}")
        
        if response.status_code == 400:
            print("\n💡 Possible issues:")
            print("  - Wrong chat ID")
            print("  - You haven't started the bot")
            print("  - Bot was blocked")
        elif response.status_code == 401:
            print("\n💡 Bot token is invalid")
        elif response.status_code == 403:
            print("\n💡 Bot was blocked by user")

if __name__ == "__main__":
    send_test()
