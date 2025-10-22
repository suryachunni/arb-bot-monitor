"""
ULTRA HIGH-END TELEGRAM BOT
Automated scanning with execute buttons
"""

import asyncio
import os
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CallbackQueryHandler
from ULTRA_PRODUCTION_BOT import UltraProductionBot
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '8305086804')
SCAN_INTERVAL = 180  # 3 minutes

class UltraTelegramBot:
    """Ultra high-end bot with Telegram interface"""
    
    def __init__(self):
        self.scanner = None
        self.opportunities = {}
        self.total_profit_found = 0
        self.scans_completed = 0
        
    async def initialize(self):
        """Initialize scanner"""
        self.scanner = UltraProductionBot()
        await self.scanner.initialize()
        
    async def scan_and_alert(self, bot):
        """Scan and send alerts"""
        logger.info("🔍 Starting ultra-fast scan...")
        
        start_time = time.time()
        opportunities = await self.scanner.scan_ultra_fast(50000)
        scan_time = (time.time() - start_time) * 1000
        
        self.scans_completed += 1
        
        if not opportunities:
            logger.info("No opportunities found")
            return
        
        total_profit = sum(o['net_profit'] for o in opportunities)
        self.total_profit_found += total_profit
        
        # Performance metrics
        avg_lat = sum(self.scanner.latency_stats[-50:]) / min(50, len(self.scanner.latency_stats)) if self.scanner.latency_stats else 0
        
        # Header
        await bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text=(
                f"🚀 <b>ULTRA HIGH-END SCAN #{self.scans_completed}</b>\n\n"
                f"⏰ {time.strftime('%H:%M:%S UTC', time.gmtime())}\n"
                f"⚡ Performance:\n"
                f"  • Scan time: {scan_time:.0f}ms\n"
                f"  • Avg latency: {avg_lat:.1f}ms\n"
                f"  • RPC endpoints: {len(self.scanner.w3_connections)}\n"
                f"  • Validation: MULTI-SOURCE ✅\n\n"
                f"📊 Found: <b>{len(opportunities)}</b>\n"
                f"💰 Total NET: <b>${total_profit:,.2f}</b>\n\n"
                f"<i>Cross-validated, sub-second latency</i>"
            ),
            parse_mode='HTML'
        )
        
        # Send top 5 with buttons
        for i, opp in enumerate(opportunities[:5], 1):
            opp_id = f"ultra{int(time.time())}{i}"
            self.opportunities[opp_id] = opp
            
            msg = (
                f"<b>#{i} - {opp['pair']}</b>\n\n"
                f"📈 Buy:  {opp['buy_pool']}\n"
                f"📉 Sell: {opp['sell_pool']}\n"
                f"📊 Spread: <b>{opp['spread_pct']:.4f}%</b>\n"
                f"✅ {opp['validation']}\n\n"
                f"💰 <b>NET PROFIT (${opp['flash_amount']:,.0f}):</b>\n"
                f"  <b>${opp['net_profit']:,.2f}</b> ({opp['roi_pct']:.2f}% ROI)\n\n"
                f"<i>Costs: ${opp['total_costs']:.2f}</i>"
            )
            
            button = [[InlineKeyboardButton(
                f"⚡ EXECUTE ${opp['net_profit']:.0f} NET ⚡",
                callback_data=f"exe_{opp_id}"
            )]]
            
            await bot.send_message(
                chat_id=TELEGRAM_CHAT_ID,
                text=msg,
                reply_markup=InlineKeyboardMarkup(button),
                parse_mode='HTML'
            )
            await asyncio.sleep(0.5)
        
        # Footer
        await bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text=(
                f"━━━━━━━━━━━━━━━━━━━\n"
                f"🚀 <b>ULTRA FEATURES:</b>\n"
                f"• Multi-RPC ({len(self.scanner.w3_connections)} endpoints)\n"
                f"• Cross-validation\n"
                f"• {avg_lat:.0f}ms avg latency\n"
                f"• NET profits only\n\n"
                f"📊 Session: ${self.total_profit_found:,.2f}\n"
                f"⏰ Next scan in 3 min"
            ),
            parse_mode='HTML'
        )
        
        logger.info(f"✅ Sent {len(opportunities)} opportunities (${total_profit:,.2f})")
    
    async def handle_button(self, update, context):
        """Handle execute button"""
        query = update.callback_query
        await query.answer()
        
        opp_id = query.data.replace('exe_', '')
        
        if opp_id not in self.opportunities:
            await query.edit_message_text("❌ Expired")
            return
        
        opp = self.opportunities[opp_id]
        
        await query.edit_message_text(
            f"✅ <b>READY TO EXECUTE</b>\n\n"
            f"{opp['pair']}\n"
            f"NET: ${opp['net_profit']:.2f}\n\n"
            f"Deploy contract:\n"
            f"python3 deploy_production_contract.py\n\n"
            f"See ULTRA_PRODUCTION_GUIDE.md",
            parse_mode='HTML'
        )
        
        del self.opportunities[opp_id]
    
    async def monitoring_loop(self, app):
        """Main loop"""
        bot = app.bot
        
        await bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text=(
                "🚀 <b>ULTRA HIGH-END BOT STARTED</b>\n\n"
                "✅ Multi-RPC parallel queries\n"
                "✅ Cross-source validation\n"
                "✅ Sub-second latency\n"
                "✅ All costs included\n"
                "✅ NET profits only\n\n"
                "First scan starting..."
            ),
            parse_mode='HTML'
        )
        
        while True:
            try:
                await self.scan_and_alert(bot)
                logger.info(f"⏳ Next scan in {SCAN_INTERVAL}s")
                await asyncio.sleep(SCAN_INTERVAL)
            except Exception as e:
                logger.error(f"Error: {e}")
                await asyncio.sleep(60)
    
    def run(self):
        """Start bot"""
        print("\n" + "="*70)
        print("🚀 ULTRA HIGH-END TELEGRAM BOT")
        print("="*70)
        print("Starting...")
        
        app = Application.builder().token(TELEGRAM_TOKEN).build()
        app.add_handler(CallbackQueryHandler(self.handle_button))
        
        async def post_init(application):
            await self.initialize()
            asyncio.create_task(self.monitoring_loop(application))
        
        app.post_init = post_init
        app.run_polling()


if __name__ == "__main__":
    bot = UltraTelegramBot()
    bot.run()
