"""
Send execute button test immediately
"""

import asyncio
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup

async def send():
    bot = Bot(token='7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU')
    
    message = (
        "🚨 <b>EXECUTE BUTTON TEST</b> 🚨\n\n"
        "<b>ARB/USDT</b>\n"
        "📈 Buy:  Camelot @ $0.317904\n"
        "📉 Sell: Sushiswap @ $0.330716\n"
        "📊 Spread: <b>4.030%</b>\n\n"
        "💰 <b>PROFIT ($50k flash loan):</b>\n"
        "  Gross:     $2,015.07\n"
        "  Costs:     -$  96.50\n"
        "  <b>NET:       $1,918.57</b>\n"
        "  <b>ROI:          3.84%</b>\n\n"
        "👇 <b>CLICK THE BUTTON BELOW!</b> 👇"
    )
    
    # Create execute button
    keyboard = [[
        InlineKeyboardButton(
            "⚡ EXECUTE - $1,918 PROFIT",
            callback_data="execute_test"
        )
    ]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # Send
    await bot.send_message(
        chat_id='8305086804',
        text=message,
        reply_markup=reply_markup,
        parse_mode='HTML'
    )
    
    print("✅ EXECUTE BUTTON SENT TO TELEGRAM!")
    print("📱 Check your Telegram - you should see a clickable button!")

asyncio.run(send())
