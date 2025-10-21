"""
Send a test alert with EXECUTE button to Telegram
"""

import asyncio
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
import os
from dotenv import load_dotenv
from arbitrage_bot import ArbitrageScanner

load_dotenv()

async def send_test_alert():
    token = os.getenv('TELEGRAM_BOT_TOKEN', '7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU')
    chat_id = os.getenv('TELEGRAM_CHAT_ID', '8305086804')
    
    bot = Bot(token=token)
    
    # Get real opportunity
    scanner = ArbitrageScanner()
    scanner.last_alert_time = 0
    
    print("Scanning for opportunities...")
    opportunities = scanner.scan_for_opportunities()
    
    if opportunities:
        opp = opportunities[0]
        
        # Format message
        if opp['type'] == 'direct':
            message = (
                f"🚨 <b>TEST - OPPORTUNITY WITH EXECUTE BUTTON</b> 🚨\n\n"
                f"<b>{opp['pair']}</b>\n"
                f"📈 Buy:  {opp['buy_dex']} @ ${opp['buy_price']:.6f}\n"
                f"📉 Sell: {opp['sell_dex']} @ ${opp['sell_price']:.6f}\n"
                f"📊 Spread: <b>{opp['spread_pct']:.3f}%</b>\n\n"
                f"💰 <b>PROFIT ($50k flash loan):</b>\n"
                f"  Gross:     ${opp['profit']['gross_profit']:>8,.2f}\n"
                f"  Costs:     -${opp['profit']['total_costs']:>7,.2f}\n"
                f"  <b>NET:       ${opp['profit']['net_profit']:>8,.2f}</b>\n"
                f"  <b>ROI:       {opp['profit']['roi_pct']:>7.2f}%</b>\n\n"
                f"👇 <b>CLICK THE BUTTON BELOW TO EXECUTE!</b> 👇"
            )
        else:
            message = (
                f"🔺 <b>TEST - TRIANGULAR OPPORTUNITY</b> 🔺\n\n"
                f"<b>{opp['path']}</b>\n"
                f"🏦 DEX: {opp['dex']}\n"
                f"📊 Profit: <b>{opp['profit_pct']:.3f}%</b>\n\n"
                f"💰 <b>NET PROFIT: ${opp['profit']['net_profit']:,.2f}</b>\n"
                f"<b>ROI: {opp['profit']['roi_pct']:.2f}%</b>\n\n"
                f"👇 <b>CLICK THE BUTTON BELOW TO EXECUTE!</b> 👇"
            )
        
        # Create execute button
        keyboard = [[
            InlineKeyboardButton(
                f"⚡ EXECUTE - ${opp['profit']['net_profit']:.0f} PROFIT",
                callback_data=f"execute_test"
            )
        ]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        # Send message
        print("Sending test alert with EXECUTE button...")
        await bot.send_message(
            chat_id=chat_id,
            text=message,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
        
        print("✅ TEST ALERT SENT!")
        print("📱 Check your Telegram - you should see an EXECUTE button!")
        print(f"\nOpportunity: {opp.get('pair', opp.get('path'))}")
        print(f"NET Profit: ${opp['profit']['net_profit']:.2f}")
    else:
        print("No opportunities found")

if __name__ == "__main__":
    asyncio.run(send_test_alert())
