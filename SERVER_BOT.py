"""
🚀 SERVER-BASED ULTRA ARBITRAGE BOT 🚀

Runs 24/7 on server, controlled entirely via Telegram
No mobile dependency - bot runs continuously in cloud
"""

import asyncio
import os
import time
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from ULTRA_PRODUCTION_BOT import UltraProductionBot
import psutil
import sys
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/arbitrage_bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '8305086804')

class ServerBot:
    """Server-based bot with Telegram control"""
    
    def __init__(self):
        self.scanner = None
        self.is_running = False
        self.is_paused = False
        self.opportunities = {}
        
        # Statistics
        self.start_time = None
        self.scans_completed = 0
        self.total_profit_found = 0
        self.opportunities_found = 0
        
        # Monitoring task
        self.monitoring_task = None
        
    async def initialize(self):
        """Initialize scanner"""
        try:
            self.scanner = UltraProductionBot()
            await self.scanner.initialize()
            logger.info("✅ Scanner initialized")
            return True
        except Exception as e:
            logger.error(f"❌ Scanner initialization failed: {e}")
            return False
    
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        keyboard = [
            [InlineKeyboardButton("🚀 START BOT", callback_data='cmd_start_bot')],
            [InlineKeyboardButton("⏸️ PAUSE BOT", callback_data='cmd_pause_bot')],
            [InlineKeyboardButton("📊 STATUS", callback_data='cmd_status')],
            [InlineKeyboardButton("📈 STATS", callback_data='cmd_stats')],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            "🚀 <b>ULTRA SERVER BOT - CONTROL PANEL</b>\n\n"
            "Bot runs 24/7 on server\n"
            "Your mobile can be off\n\n"
            "Use buttons below to control:",
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
    
    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle button callbacks"""
        query = update.callback_query
        await query.answer()
        
        if query.data == 'cmd_start_bot':
            await self._handle_start_bot(query)
        elif query.data == 'cmd_pause_bot':
            await self._handle_pause_bot(query)
        elif query.data == 'cmd_status':
            await self._handle_status(query)
        elif query.data == 'cmd_stats':
            await self._handle_stats(query)
        elif query.data.startswith('exe_'):
            await self._handle_execute(query)
        else:
            # Show control panel again
            keyboard = [
                [InlineKeyboardButton("🚀 START BOT", callback_data='cmd_start_bot')],
                [InlineKeyboardButton("⏸️ PAUSE BOT", callback_data='cmd_pause_bot')],
                [InlineKeyboardButton("📊 STATUS", callback_data='cmd_status')],
                [InlineKeyboardButton("📈 STATS", callback_data='cmd_stats')],
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                "🚀 <b>CONTROL PANEL</b>\n\n"
                "Select action:",
                reply_markup=reply_markup,
                parse_mode='HTML'
            )
    
    async def _handle_start_bot(self, query):
        """Start bot scanning"""
        if self.is_running and not self.is_paused:
            await query.edit_message_text(
                "✅ Bot is already running!\n\n"
                f"Scans completed: {self.scans_completed}\n"
                f"Opportunities found: {self.opportunities_found}\n\n"
                "Use /start to see control panel",
                parse_mode='HTML'
            )
            return
        
        # Start bot
        self.is_running = True
        self.is_paused = False
        
        if self.start_time is None:
            self.start_time = time.time()
        
        # Start monitoring if not already running
        if self.monitoring_task is None or self.monitoring_task.done():
            self.monitoring_task = asyncio.create_task(
                self._monitoring_loop(query.get_bot())
            )
        
        await query.edit_message_text(
            "🚀 <b>BOT STARTED!</b>\n\n"
            "✅ Scanning every 3 minutes\n"
            "✅ Multi-RPC validation\n"
            "✅ Sending alerts with execute buttons\n\n"
            "📱 You can close Telegram now\n"
            "🖥️ Bot runs on server 24/7\n\n"
            "First scan starting...",
            parse_mode='HTML'
        )
    
    async def _handle_pause_bot(self, query):
        """Pause bot scanning"""
        if not self.is_running:
            await query.edit_message_text(
                "⚠️ Bot is not running\n\n"
                "Use 🚀 START BOT to begin",
                parse_mode='HTML'
            )
            return
        
        self.is_paused = True
        
        await query.edit_message_text(
            "⏸️ <b>BOT PAUSED</b>\n\n"
            f"Scans completed: {self.scans_completed}\n"
            f"Total profit found: ${self.total_profit_found:,.2f}\n\n"
            "Use 🚀 START BOT to resume",
            parse_mode='HTML'
        )
    
    async def _handle_status(self, query):
        """Show bot status"""
        if not self.is_running:
            status = "🔴 STOPPED"
        elif self.is_paused:
            status = "⏸️ PAUSED"
        else:
            status = "🟢 RUNNING"
        
        uptime = "Not started"
        if self.start_time:
            uptime_seconds = int(time.time() - self.start_time)
            hours = uptime_seconds // 3600
            minutes = (uptime_seconds % 3600) // 60
            uptime = f"{hours}h {minutes}m"
        
        # System stats
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        
        await query.edit_message_text(
            f"📊 <b>BOT STATUS</b>\n\n"
            f"Status: <b>{status}</b>\n"
            f"Uptime: {uptime}\n\n"
            f"<b>Performance:</b>\n"
            f"Scans: {self.scans_completed}\n"
            f"Opportunities: {self.opportunities_found}\n"
            f"Total profit: ${self.total_profit_found:,.2f}\n\n"
            f"<b>Server:</b>\n"
            f"CPU: {cpu_percent}%\n"
            f"Memory: {memory.percent}%\n\n"
            f"Bot runs independently of mobile ✅",
            parse_mode='HTML'
        )
    
    async def _handle_stats(self, query):
        """Show detailed statistics"""
        uptime = "Not started"
        if self.start_time:
            uptime_seconds = int(time.time() - self.start_time)
            hours = uptime_seconds // 3600
            minutes = (uptime_seconds % 3600) // 60
            uptime = f"{hours}h {minutes}m"
        
        avg_profit = self.total_profit_found / max(1, self.scans_completed)
        opps_per_scan = self.opportunities_found / max(1, self.scans_completed)
        
        await query.edit_message_text(
            f"📈 <b>DETAILED STATISTICS</b>\n\n"
            f"<b>Session:</b>\n"
            f"Uptime: {uptime}\n"
            f"Scans: {self.scans_completed}\n"
            f"Opportunities: {self.opportunities_found}\n\n"
            f"<b>Profitability:</b>\n"
            f"Total profit: ${self.total_profit_found:,.2f}\n"
            f"Avg per scan: ${avg_profit:,.2f}\n"
            f"Avg opps/scan: {opps_per_scan:.1f}\n\n"
            f"<b>Scanner:</b>\n"
            f"RPC endpoints: {len(self.scanner.w3_connections) if self.scanner else 0}\n"
            f"Validation: Multi-source ✅\n\n"
            f"Server-based, mobile-independent ✅",
            parse_mode='HTML'
        )
    
    async def _handle_execute(self, query):
        """Handle execute button"""
        opp_id = query.data.replace('exe_', '')
        
        if opp_id not in self.opportunities:
            await query.edit_message_text("❌ Opportunity expired")
            return
        
        opp = self.opportunities[opp_id]
        
        await query.edit_message_text(
            f"⚡ <b>READY TO EXECUTE</b>\n\n"
            f"{opp['pair']}\n"
            f"NET: ${opp['net_profit']:.2f}\n\n"
            f"<b>To enable execution:</b>\n"
            f"1. Deploy contract\n"
            f"2. Set PRIVATE_KEY in .env\n"
            f"3. Restart bot\n\n"
            f"For now: Monitoring mode",
            parse_mode='HTML'
        )
        
        del self.opportunities[opp_id]
    
    async def _monitoring_loop(self, bot):
        """Main monitoring loop"""
        logger.info("🚀 Monitoring loop started")
        
        while self.is_running:
            try:
                # Check if paused
                if self.is_paused:
                    logger.info("⏸️ Bot paused, waiting...")
                    await asyncio.sleep(10)
                    continue
                
                # Scan for opportunities
                logger.info(f"🔍 Scan #{self.scans_completed + 1} starting...")
                
                opportunities = await self.scanner.scan_ultra_fast(50000)
                self.scans_completed += 1
                
                if opportunities:
                    await self._send_opportunities(bot, opportunities)
                else:
                    logger.info("No opportunities found")
                
                # Wait 3 minutes
                logger.info("⏳ Next scan in 3 minutes...")
                await asyncio.sleep(180)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)
    
    async def _send_opportunities(self, bot, opportunities):
        """Send opportunities to Telegram"""
        total_profit = sum(o['net_profit'] for o in opportunities)
        self.total_profit_found += total_profit
        self.opportunities_found += len(opportunities)
        
        avg_lat = sum(self.scanner.latency_stats[-50:]) / min(50, len(self.scanner.latency_stats)) if self.scanner.latency_stats else 0
        
        # Header
        await bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text=(
                f"🚀 <b>SCAN #{self.scans_completed}</b>\n\n"
                f"⏰ {time.strftime('%H:%M:%S UTC', time.gmtime())}\n"
                f"⚡ Latency: {avg_lat:.0f}ms\n"
                f"📊 Found: <b>{len(opportunities)}</b>\n"
                f"💰 NET: <b>${total_profit:,.2f}</b>"
            ),
            parse_mode='HTML'
        )
        
        # Send top 3 with execute buttons
        for i, opp in enumerate(opportunities[:3], 1):
            opp_id = f"srv{int(time.time())}{i}"
            self.opportunities[opp_id] = opp
            
            msg = (
                f"<b>#{i} - {opp['pair']}</b>\n\n"
                f"📈 {opp['buy_pool']}\n"
                f"📉 {opp['sell_pool']}\n"
                f"📊 Spread: <b>{opp['spread_pct']:.4f}%</b>\n"
                f"✅ {opp['validation']}\n\n"
                f"💰 <b>NET: ${opp['net_profit']:,.2f}</b>\n"
                f"ROI: {opp['roi_pct']:.2f}%"
            )
            
            button = [[InlineKeyboardButton(
                f"⚡ EXECUTE ${opp['net_profit']:.0f} ⚡",
                callback_data=f"exe_{opp_id}"
            )]]
            
            await bot.send_message(
                chat_id=TELEGRAM_CHAT_ID,
                text=msg,
                reply_markup=InlineKeyboardMarkup(button),
                parse_mode='HTML'
            )
            await asyncio.sleep(0.5)
        
        # Control panel reminder
        keyboard = [
            [InlineKeyboardButton("⏸️ PAUSE", callback_data='cmd_pause_bot')],
            [InlineKeyboardButton("📊 STATUS", callback_data='cmd_status')],
        ]
        
        await bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text=(
                f"━━━━━━━━━━━━━━━━━━━\n"
                f"Session: ${self.total_profit_found:,.2f}\n"
                f"Next scan in 3 min"
            ),
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='HTML'
        )
        
        logger.info(f"✅ Sent {len(opportunities)} opportunities")
    
    def run(self):
        """Start Telegram bot"""
        print("\n" + "="*70)
        print("🚀 SERVER-BASED ULTRA BOT")
        print("="*70)
        print("✅ Runs 24/7 on server")
        print("✅ Mobile-independent")
        print("✅ Telegram control panel")
        print("="*70 + "\n")
        
        app = Application.builder().token(TELEGRAM_TOKEN).build()
        
        # Add handlers
        app.add_handler(CommandHandler("start", self.start_command))
        app.add_handler(CallbackQueryHandler(self.handle_callback))
        
        # Initialize scanner
        async def post_init(application):
            success = await self.initialize()
            if success:
                logger.info("✅ Bot ready! Send /start to control")
                # Send startup message
                await application.bot.send_message(
                    chat_id=TELEGRAM_CHAT_ID,
                    text=(
                        "🚀 <b>SERVER BOT ONLINE</b>\n\n"
                        "Bot is running on server\n"
                        "Your mobile can be off\n\n"
                        "Send /start to control bot"
                    ),
                    parse_mode='HTML'
                )
            else:
                logger.error("❌ Initialization failed")
        
        app.post_init = post_init
        
        logger.info("🚀 Starting Telegram bot...")
        app.run_polling()


if __name__ == "__main__":
    bot = ServerBot()
    bot.run()
