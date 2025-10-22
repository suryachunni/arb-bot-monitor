"""
Telegram Bot with Execute Buttons
Shows opportunities and lets you execute with one click
"""

import os
import asyncio
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from dotenv import load_dotenv
from arbitrage_bot import ArbitrageScanner
from executor import ArbitrageExecutor
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

class TelegramExecutorBot:
    def __init__(self):
        self.scanner = ArbitrageScanner()
        self.executor = ArbitrageExecutor()
        self.token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.pending_opportunities = {}
        self.monitoring = False
        
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Start command"""
        await update.message.reply_text(
            "🤖 <b>Arbitrage Executor Bot</b>\n\n"
            "Commands:\n"
            "/scan - Scan for opportunities\n"
            "/monitor - Start continuous monitoring\n"
            "/stop - Stop monitoring\n"
            "/stats - View statistics\n"
            "/help - Show this message\n\n"
            f"Wallet: {self.executor.account.address if self.executor.account else 'Not configured'}\n"
            f"Contract: {self.executor.contract_address if self.executor.contract_address else 'Not deployed'}",
            parse_mode='HTML'
        )
    
    async def scan(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Scan for opportunities and show with execute buttons"""
        await update.message.reply_text("🔍 Scanning for opportunities...")
        
        # Scan
        opportunities = self.scanner.scan_for_opportunities()
        
        if not opportunities:
            await update.message.reply_text("No profitable opportunities found right now.")
            return
        
        # Show top 3
        for idx, opp in enumerate(opportunities[:3], 1):
            # Store opportunity
            opp_id = f"opp_{idx}_{int(asyncio.get_event_loop().time())}"
            self.pending_opportunities[opp_id] = opp
            
            # Format message
            if opp['type'] == 'direct':
                message = (
                    f"💰 <b>Opportunity #{idx}</b>\n\n"
                    f"<b>Pair:</b> {opp['pair']}\n"
                    f"📈 Buy: {opp['buy_dex']} @ ${opp['buy_price']:.6f}\n"
                    f"📉 Sell: {opp['sell_dex']} @ ${opp['sell_price']:.6f}\n"
                    f"📊 Spread: <b>{opp['spread_pct']:.3f}%</b>\n\n"
                    f"💵 <b>PROFIT ($50k flash loan):</b>\n"
                    f"  Gross: ${opp['profit']['gross_profit']:,.2f}\n"
                    f"  Costs: -${opp['profit']['total_costs']:,.2f}\n"
                    f"  <b>NET: ${opp['profit']['net_profit']:,.2f}</b>\n"
                    f"  <b>ROI: {opp['profit']['roi_pct']:.2f}%</b>\n"
                )
            else:
                message = (
                    f"🔺 <b>Triangular #{idx}</b>\n\n"
                    f"<b>Path:</b> {opp['path']}\n"
                    f"DEX: {opp['dex']}\n"
                    f"Profit: <b>{opp['profit_pct']:.3f}%</b>\n\n"
                    f"💵 <b>NET Profit: ${opp['profit']['net_profit']:,.2f}</b>\n"
                    f"<b>ROI: {opp['profit']['roi_pct']:.2f}%</b>\n"
                )
            
            # Create execute button
            keyboard = [[
                InlineKeyboardButton(
                    f"⚡ EXECUTE - ${opp['profit']['net_profit']:.0f} profit",
                    callback_data=f"execute_{opp_id}"
                )
            ]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await update.message.reply_text(
                message,
                reply_markup=reply_markup,
                parse_mode='HTML'
            )
    
    async def execute_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle execute button press"""
        query = update.callback_query
        await query.answer()
        
        # Get opportunity ID
        opp_id = query.data.replace('execute_', '')
        
        if opp_id not in self.pending_opportunities:
            await query.edit_message_text("❌ Opportunity expired or already executed")
            return
        
        opportunity = self.pending_opportunities[opp_id]
        
        # Check if executor is ready
        if not self.executor.account or not self.executor.contract:
            await query.edit_message_text(
                "❌ <b>Executor not configured</b>\n\n"
                "Please set PRIVATE_KEY and deploy contract first.",
                parse_mode='HTML'
            )
            return
        
        # Update message
        await query.edit_message_text(
            f"⚡ <b>EXECUTING TRADE...</b>\n\n"
            f"Pair: {opportunity['pair']}\n"
            f"Expected Profit: ${opportunity['profit']['net_profit']:.2f}\n\n"
            f"Please wait...",
            parse_mode='HTML'
        )
        
        # Prepare and execute
        tx_data = self.executor.prepare_transaction(opportunity)
        
        if not tx_data:
            await query.edit_message_text(
                "❌ <b>Failed to prepare transaction</b>\n\n"
                "Check logs for details.",
                parse_mode='HTML'
            )
            return
        
        # Execute
        success = self.executor.execute_trade(tx_data)
        
        if success:
            await query.edit_message_text(
                f"✅ <b>TRADE EXECUTED SUCCESSFULLY!</b>\n\n"
                f"Pair: {opportunity['pair']}\n"
                f"Profit: ${opportunity['profit']['net_profit']:.2f}\n\n"
                f"Total Trades: {self.executor.trades_executed}\n"
                f"Total Profit: ${self.executor.total_profit:.2f}",
                parse_mode='HTML'
            )
        else:
            await query.edit_message_text(
                f"❌ <b>TRADE FAILED</b>\n\n"
                f"Check logs for details.",
                parse_mode='HTML'
            )
        
        # Remove from pending
        del self.pending_opportunities[opp_id]
    
    async def monitor(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Start continuous monitoring"""
        if self.monitoring:
            await update.message.reply_text("Already monitoring!")
            return
        
        self.monitoring = True
        await update.message.reply_text(
            "🔄 <b>Continuous monitoring started</b>\n\n"
            "I'll send alerts with execute buttons when opportunities are found.\n"
            "Use /stop to stop monitoring.",
            parse_mode='HTML'
        )
        
        # Start background monitoring
        context.application.create_task(self.monitoring_loop(update.effective_chat.id, context))
    
    async def stop_monitoring(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Stop monitoring"""
        self.monitoring = False
        await update.message.reply_text("🛑 Monitoring stopped")
    
    async def monitoring_loop(self, chat_id, context):
        """Background monitoring loop"""
        while self.monitoring:
            try:
                opportunities = self.scanner.scan_for_opportunities()
                
                if opportunities:
                    # Send top opportunity with execute button
                    opp = opportunities[0]
                    opp_id = f"opp_{int(asyncio.get_event_loop().time())}"
                    self.pending_opportunities[opp_id] = opp
                    
                    message = (
                        f"🚨 <b>OPPORTUNITY ALERT!</b>\n\n"
                        f"<b>{opp['pair']}</b>\n"
                        f"Profit: <b>${opp['profit']['net_profit']:.2f}</b>\n"
                        f"ROI: {opp['profit']['roi_pct']:.2f}%\n"
                    )
                    
                    keyboard = [[
                        InlineKeyboardButton(
                            f"⚡ EXECUTE NOW",
                            callback_data=f"execute_{opp_id}"
                        )
                    ]]
                    
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=message,
                        reply_markup=InlineKeyboardMarkup(keyboard),
                        parse_mode='HTML'
                    )
                
                await asyncio.sleep(180)  # Check every 3 minutes
                
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
                await asyncio.sleep(60)
    
    async def stats(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show statistics"""
        await update.message.reply_text(
            f"📊 <b>Statistics</b>\n\n"
            f"Trades Executed: {self.executor.trades_executed}\n"
            f"Total Profit: ${self.executor.total_profit:.2f}\n"
            f"Wallet: {self.executor.account.address if self.executor.account else 'Not configured'}\n"
            f"Contract: {self.executor.contract_address if self.executor.contract_address else 'Not deployed'}",
            parse_mode='HTML'
        )
    
    def run(self):
        """Start the bot"""
        logger.info("Starting Telegram Executor Bot...")
        
        app = Application.builder().token(self.token).build()
        
        app.add_handler(CommandHandler("start", self.start))
        app.add_handler(CommandHandler("help", self.start))
        app.add_handler(CommandHandler("scan", self.scan))
        app.add_handler(CommandHandler("monitor", self.monitor))
        app.add_handler(CommandHandler("stop", self.stop_monitoring))
        app.add_handler(CommandHandler("stats", self.stats))
        app.add_handler(CallbackQueryHandler(self.execute_callback))
        
        logger.info("✅ Telegram bot started!")
        logger.info("Send /start to begin")
        
        app.run_polling()


def main():
    bot = TelegramExecutorBot()
    bot.run()


if __name__ == "__main__":
    main()
