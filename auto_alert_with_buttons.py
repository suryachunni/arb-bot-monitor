"""
Automated Alert System with EXECUTE BUTTONS
Scans every 3 minutes and sends alerts with clickable execute buttons
"""

import os
import time
import asyncio
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CallbackQueryHandler, ContextTypes
from dotenv import load_dotenv
from arbitrage_bot import ArbitrageScanner
from executor import ArbitrageExecutor
import logging
import json

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

class AutoAlertBot:
    def __init__(self):
        self.scanner = ArbitrageScanner()
        self.executor = ArbitrageExecutor()
        self.token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.chat_id = os.getenv('TELEGRAM_CHAT_ID')
        self.pending_opportunities = {}
        self.running = True
        
    async def send_alert_with_buttons(self, context, opportunities):
        """Send alert with execute buttons for each opportunity"""
        
        if not opportunities:
            return
        
        # Sort by profit
        opportunities = sorted(opportunities, key=lambda x: x['profit']['net_profit'], reverse=True)
        
        # Send top 3 opportunities with execute buttons
        for idx, opp in enumerate(opportunities[:3], 1):
            # Generate unique ID for this opportunity
            opp_id = f"opp_{int(time.time())}_{idx}"
            self.pending_opportunities[opp_id] = opp
            
            # Format message
            if opp['type'] == 'direct':
                message = (
                    f"🚨 <b>OPPORTUNITY #{idx}</b> 🚨\n\n"
                    f"<b>{opp['pair']}</b>\n"
                    f"📈 Buy:  {opp['buy_dex']} @ ${opp['buy_price']:.6f}\n"
                    f"📉 Sell: {opp['sell_dex']} @ ${opp['sell_price']:.6f}\n"
                    f"📊 Spread: <b>{opp['spread_pct']:.3f}%</b>\n\n"
                    f"💰 <b>PROFIT ($50k flash loan):</b>\n"
                    f"  Gross:     ${opp['profit']['gross_profit']:>8,.2f}\n"
                    f"  Costs:     -${opp['profit']['total_costs']:>7,.2f}\n"
                    f"  <b>NET:       ${opp['profit']['net_profit']:>8,.2f}</b>\n"
                    f"  <b>ROI:       {opp['profit']['roi_pct']:>7.2f}%</b>\n"
                )
            else:
                message = (
                    f"🔺 <b>TRIANGULAR #{idx}</b> 🔺\n\n"
                    f"<b>{opp['path']}</b>\n"
                    f"🏦 DEX: {opp['dex']}\n"
                    f"📊 Profit: <b>{opp['profit_pct']:.3f}%</b>\n\n"
                    f"💰 <b>PROFIT ($50k flash loan):</b>\n"
                    f"  Gross:     ${opp['profit']['gross_profit']:>8,.2f}\n"
                    f"  Costs:     -${opp['profit']['total_costs']:>7,.2f}\n"
                    f"  <b>NET:       ${opp['profit']['net_profit']:>8,.2f}</b>\n"
                    f"  <b>ROI:       {opp['profit']['roi_pct']:>7.2f}%</b>\n"
                )
            
            # Create execute button
            keyboard = [[
                InlineKeyboardButton(
                    f"⚡ EXECUTE - ${opp['profit']['net_profit']:.0f} PROFIT",
                    callback_data=f"execute_{opp_id}"
                )
            ]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            # Send message with button
            await context.bot.send_message(
                chat_id=self.chat_id,
                text=message,
                reply_markup=reply_markup,
                parse_mode='HTML'
            )
            
            await asyncio.sleep(1)  # Small delay between messages
        
        # Send summary
        total_profit = sum(o['profit']['net_profit'] for o in opportunities)
        summary = (
            f"\n━━━━━━━━━━━━━━━━━━━\n"
            f"📊 Total Found: <b>{len(opportunities)}</b>\n"
            f"💰 Combined Profit: <b>${total_profit:,.2f}</b>\n"
            f"⚡ Click EXECUTE button above to trade!\n"
        )
        
        await context.bot.send_message(
            chat_id=self.chat_id,
            text=summary,
            parse_mode='HTML'
        )
    
    async def execute_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle execute button press"""
        query = update.callback_query
        await query.answer()
        
        # Get opportunity ID
        opp_id = query.data.replace('execute_', '')
        
        if opp_id not in self.pending_opportunities:
            await query.edit_message_text(
                "❌ Opportunity expired or already executed",
                parse_mode='HTML'
            )
            return
        
        opportunity = self.pending_opportunities[opp_id]
        
        # Check if executor is ready
        if not self.executor.account or not self.executor.contract:
            await query.edit_message_text(
                "❌ <b>Executor not configured</b>\n\n"
                "Please:\n"
                "1. Set PRIVATE_KEY in .env\n"
                "2. Deploy contract: python3 deploy_contract.py\n\n"
                "Then restart this bot.",
                parse_mode='HTML'
            )
            return
        
        # Update message
        await query.edit_message_text(
            f"⚡ <b>EXECUTING TRADE...</b>\n\n"
            f"Pair: {opportunity.get('pair', opportunity.get('path'))}\n"
            f"Expected Profit: ${opportunity['profit']['net_profit']:.2f}\n\n"
            f"Please wait...",
            parse_mode='HTML'
        )
        
        # Prepare transaction
        tx_data = self.executor.prepare_transaction(opportunity)
        
        if not tx_data:
            await query.edit_message_text(
                "❌ <b>Failed to prepare transaction</b>\n\n"
                "Opportunity may no longer be available.",
                parse_mode='HTML'
            )
            return
        
        # Execute trade
        success = self.executor.execute_trade(tx_data)
        
        if success:
            await query.edit_message_text(
                f"✅ <b>TRADE EXECUTED SUCCESSFULLY!</b>\n\n"
                f"Pair: {opportunity.get('pair', opportunity.get('path'))}\n"
                f"Profit: ${opportunity['profit']['net_profit']:.2f}\n\n"
                f"Total Trades: {self.executor.trades_executed}\n"
                f"Total Profit: ${self.executor.total_profit:.2f}",
                parse_mode='HTML'
            )
        else:
            await query.edit_message_text(
                f"❌ <b>TRADE FAILED</b>\n\n"
                f"Check logs for details.\n"
                f"Price may have moved or gas too high.",
                parse_mode='HTML'
            )
        
        # Remove from pending
        del self.pending_opportunities[opp_id]
    
    async def monitoring_loop(self, context):
        """Continuous monitoring and alerting"""
        logger.info("🔄 Starting monitoring loop...")
        
        # Send startup message
        await context.bot.send_message(
            chat_id=self.chat_id,
            text=(
                "🤖 <b>Auto-Alert Bot Started!</b>\n\n"
                "✅ Scanning every 3 minutes\n"
                "✅ Alerts with EXECUTE buttons\n"
                "✅ Click button to trade instantly\n\n"
                "Monitoring for opportunities..."
            ),
            parse_mode='HTML'
        )
        
        while self.running:
            try:
                logger.info("\n🔍 Scanning for opportunities...")
                
                # Scan
                opportunities = self.scanner.scan_for_opportunities()
                
                if opportunities:
                    logger.info(f"✅ Found {len(opportunities)} opportunities")
                    
                    # Send alerts with execute buttons
                    await self.send_alert_with_buttons(context, opportunities)
                    
                    logger.info("📱 Alerts sent with EXECUTE buttons!")
                else:
                    logger.info("No opportunities found this scan")
                
                # Wait 3 minutes
                logger.info("⏳ Next scan in 3 minutes...")
                await asyncio.sleep(180)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)
    
    def run(self):
        """Start the bot"""
        logger.info("="*70)
        logger.info("AUTO-ALERT BOT WITH EXECUTE BUTTONS")
        logger.info("="*70)
        logger.info(f"Telegram Chat: {self.chat_id}")
        logger.info(f"Executor: {'Ready' if self.executor.account else 'Not configured'}")
        logger.info("="*70)
        
        # Create application
        app = Application.builder().token(self.token).build()
        
        # Add callback handler for execute buttons
        app.add_handler(CallbackQueryHandler(self.execute_callback))
        
        # Start monitoring in background
        async def post_init(application):
            application.create_task(
                self.monitoring_loop(application.bot_data['context'])
            )
        
        # Store context
        app.bot_data['context'] = app
        
        # Run bot
        logger.info("✅ Bot started! Sending alerts with EXECUTE buttons every 3 minutes...")
        
        app.run_polling(post_init=post_init)


def main():
    bot = AutoAlertBot()
    bot.run()


if __name__ == "__main__":
    main()
