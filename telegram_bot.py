import asyncio
import logging
from telegram import Bot
from telegram.error import TelegramError
from typing import Dict, List, Optional
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TelegramNotifier:
    def __init__(self):
        self.bot = Bot(token=TELEGRAM_BOT_TOKEN)
        self.chat_id = TELEGRAM_CHAT_ID

    async def send_price_alert(self, prices: Dict[str, Optional[float]], 
                             arbitrage_opportunities: List[Dict] = None) -> bool:
        """Send price alert to Telegram"""
        try:
            # Format price data
            price_text = "🔴 **WETH Price Alert** 🔴\n\n"
            price_text += "📊 **Current WETH Prices on Arbitrum:**\n\n"
            
            valid_prices = {k: v for k, v in prices.items() if v is not None}
            
            if not valid_prices:
                price_text += "❌ No valid prices available at the moment\n"
            else:
                for dex, price in valid_prices.items():
                    price_text += f"• **{dex}**: ${price:.2f}\n"
                
                # Calculate average price
                avg_price = sum(valid_prices.values()) / len(valid_prices)
                price_text += f"\n📈 **Average Price**: ${avg_price:.2f}\n"
                
                # Price range
                min_price = min(valid_prices.values())
                max_price = max(valid_prices.values())
                price_text += f"📊 **Price Range**: ${min_price:.2f} - ${max_price:.2f}\n"
            
            # Add arbitrage opportunities
            if arbitrage_opportunities:
                price_text += "\n🚀 **Arbitrage Opportunities:**\n\n"
                for i, opp in enumerate(arbitrage_opportunities[:3], 1):  # Show top 3
                    price_text += f"**{i}. {opp['dex1']} ↔ {opp['dex2']}**\n"
                    price_text += f"   • Buy from: {opp['buy_from']} (${opp['price1']:.2f})\n"
                    price_text += f"   • Sell to: {opp['sell_to']} (${opp['price2']:.2f})\n"
                    price_text += f"   • Profit: {opp['profit_percent']:.2f}%\n\n"
            
            # Add timestamp
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
            price_text += f"\n⏰ **Last Updated**: {timestamp}"
            
            # Send message
            await self.bot.send_message(
                chat_id=self.chat_id,
                text=price_text,
                parse_mode='Markdown'
            )
            
            logger.info("Price alert sent successfully")
            return True
            
        except TelegramError as e:
            logger.error(f"Telegram error: {e}")
            return False
        except Exception as e:
            logger.error(f"Error sending price alert: {e}")
            return False

    async def send_arbitrage_alert(self, opportunity: Dict) -> bool:
        """Send specific arbitrage opportunity alert"""
        try:
            alert_text = "🚨 **ARBITRAGE ALERT** 🚨\n\n"
            alert_text += f"💰 **High Profit Opportunity Detected!**\n\n"
            alert_text += f"**DEXs**: {opportunity['dex1']} ↔ {opportunity['dex2']}\n"
            alert_text += f"**Price Difference**: {opportunity['difference_percent']:.2f}%\n\n"
            alert_text += f"📈 **Buy from**: {opportunity['buy_from']} (${opportunity['price1']:.2f})\n"
            alert_text += f"📉 **Sell to**: {opportunity['sell_to']} (${opportunity['price2']:.2f})\n"
            alert_text += f"💵 **Potential Profit**: {opportunity['profit_percent']:.2f}%\n\n"
            alert_text += "⚡ **Act Fast!** Prices can change quickly!"
            
            await self.bot.send_message(
                chat_id=self.chat_id,
                text=alert_text,
                parse_mode='Markdown'
            )
            
            logger.info(f"Arbitrage alert sent: {opportunity['dex1']} vs {opportunity['dex2']}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending arbitrage alert: {e}")
            return False

    async def send_error_alert(self, error_message: str) -> bool:
        """Send error alert to Telegram"""
        try:
            error_text = "⚠️ **System Error Alert** ⚠️\n\n"
            error_text += f"❌ **Error**: {error_message}\n\n"
            error_text += "🔧 Please check the system logs for more details."
            
            await self.bot.send_message(
                chat_id=self.chat_id,
                text=error_text,
                parse_mode='Markdown'
            )
            
            logger.info("Error alert sent successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error sending error alert: {e}")
            return False

    async def test_connection(self) -> bool:
        """Test Telegram bot connection"""
        try:
            await self.bot.send_message(
                chat_id=self.chat_id,
                text="🤖 **WETH Price Monitor Started**\n\nSystem is now monitoring WETH prices on Arbitrum mainnet every 3 minutes."
            )
            logger.info("Telegram connection test successful")
            return True
        except Exception as e:
            logger.error(f"Telegram connection test failed: {e}")
            return False