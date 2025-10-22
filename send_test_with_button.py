import asyncio
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup

async def send():
    bot = Bot(token='7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU')
    
    # Message with button
    message = (
        "🚨 <b>TEST - THIS HAS A BUTTON!</b> 🚨\n\n"
        "<b>#1 - ARB/USDT</b>\n\n"
        "💰 <b>NET PROFIT: $1,918.57</b>\n"
        "📊 ROI: <b>3.84%</b>\n\n"
        "📈 Buy: Camelot @ $0.317904\n"
        "📉 Sell: Sushiswap @ $0.330716\n"
        "📊 Spread: 4.03%\n\n"
        "👇 <b>SEE THE BUTTON BELOW</b> 👇"
    )
    
    # Create EXECUTE button
    keyboard = [[
        InlineKeyboardButton(
            "⚡ EXECUTE - $1,918 PROFIT ⚡",
            callback_data="test_execute"
        )
    ]]
    
    await bot.send_message(
        chat_id='8305086804',
        text=message,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )
    
    print("✅ SENT MESSAGE WITH EXECUTE BUTTON!")

asyncio.run(send())
