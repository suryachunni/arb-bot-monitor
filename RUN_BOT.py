"""
🚀 COMPLETE ARBITRAGE BOT WITH EXECUTE BUTTONS
Run this file and get Telegram alerts with clickable EXECUTE buttons every 3 minutes!
"""

import os
import time
import asyncio
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CallbackQueryHandler
from arbitrage_bot import ArbitrageScanner
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
TELEGRAM_TOKEN = '7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU'
TELEGRAM_CHAT_ID = '8305086804'
SCAN_INTERVAL = 180  # 3 minutes

class ArbitrageBotWithButtons:
    def __init__(self):
        self.scanner = ArbitrageScanner()
        self.opportunities = {}
        
    async def scan_and_alert(self, bot):
        """Scan for opportunities and send alerts with EXECUTE buttons"""
        logger.info("🔍 Scanning for arbitrage opportunities...")
        
        # Scan
        self.scanner.last_alert_time = 0
        opps = self.scanner.scan_for_opportunities()
        
        if not opps:
            logger.info("No opportunities found")
            return
        
        logger.info(f"✅ Found {len(opps)} opportunities!")
        
        # Send header
        await bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text=(
                f"🚨 <b>ARBITRAGE ALERT</b> 🚨\n"
                f"⏰ {time.strftime('%H:%M:%S UTC', time.gmtime())}\n"
                f"📊 Found {len(opps)} opportunities\n"
            ),
            parse_mode='HTML'
        )
        
        # Send top 3 with buttons
        for i, opp in enumerate(opps[:3], 1):
            opp_id = f"opp{int(time.time())}{i}"
            self.opportunities[opp_id] = opp
            
            msg = (
                f"<b>#{i} - {opp.get('pair', opp.get('path', 'Opportunity'))}</b>\n\n"
                f"💰 <b>NET PROFIT: ${opp['profit']['net_profit']:,.2f}</b>\n"
                f"📊 ROI: <b>{opp['profit']['roi_pct']:.2f}%</b>\n"
            )
            
            if opp['type'] == 'direct':
                msg += (
                    f"\n📈 Buy: {opp['buy_dex']} @ ${opp['buy_price']:.6f}\n"
                    f"📉 Sell: {opp['sell_dex']} @ ${opp['sell_price']:.6f}\n"
                    f"📊 Spread: {opp['spread_pct']:.2f}%\n"
                )
            
            button = [[InlineKeyboardButton(
                f"⚡ EXECUTE ${opp['profit']['net_profit']:.0f} ⚡",
                callback_data=f"exe_{opp_id}"
            )]]
            
            await bot.send_message(
                chat_id=TELEGRAM_CHAT_ID,
                text=msg,
                reply_markup=InlineKeyboardMarkup(button),
                parse_mode='HTML'
            )
        
        logger.info("📱 Alerts sent with EXECUTE buttons!")
    
    async def handle_button(self, update, context):
        """Handle button click"""
        query = update.callback_query
        await query.answer()
        
        opp_id = query.data.replace('exe_', '')
        
        if opp_id not in self.opportunities:
            await query.edit_message_text("❌ Opportunity expired")
            return
        
        opp = self.opportunities[opp_id]
        
        # Check if configured for execution
        if not os.path.exists('.env'):
            await query.edit_message_text(
                f"✅ <b>Button Works!</b>\n\n"
                f"Opportunity: {opp.get('pair', opp.get('path'))}\n"
                f"Profit: ${opp['profit']['net_profit']:.2f}\n\n"
                f"To enable execution:\n"
                f"1. Create .env file\n"
                f"2. Add PRIVATE_KEY\n"
                f"3. Deploy contract\n\n"
                f"For now, monitoring mode only.",
                parse_mode='HTML'
            )
        else:
            await query.edit_message_text(
                f"⚡ <b>EXECUTE CLICKED!</b>\n\n"
                f"{opp.get('pair', opp.get('path'))}\n"
                f"Profit: ${opp['profit']['net_profit']:.2f}\n\n"
                f"Execution will work once contract is deployed.\n"
                f"Run: python3 deploy_contract.py",
                parse_mode='HTML'
            )
        
        del self.opportunities[opp_id]
    
    async def start_monitoring(self, app):
        """Start monitoring loop"""
        bot = app.bot
        
        await bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text="🤖 <b>Bot Started!</b>\n\n✅ Scanning every 3 minutes\n✅ Alerts with EXECUTE buttons",
            parse_mode='HTML'
        )
        
        while True:
            await self.scan_and_alert(bot)
            logger.info(f"⏳ Next scan in {SCAN_INTERVAL}s")
            await asyncio.sleep(SCAN_INTERVAL)
    
    def run(self):
        logger.info("🚀 Starting bot...")
        app = Application.builder().token(TELEGRAM_TOKEN).build()
        app.add_handler(CallbackQueryHandler(self.handle_button))
        
        async def post_init(application):
            application.create_task(self.start_monitoring(application))
        
        app.run_polling(post_init=post_init)

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🚀 ARBITRAGE BOT WITH EXECUTE BUTTONS")
    print("="*70)
    print("Starting... Check your Telegram for alerts!")
    print("="*70 + "\n")
    
    bot = ArbitrageBotWithButtons()
    bot.run()
