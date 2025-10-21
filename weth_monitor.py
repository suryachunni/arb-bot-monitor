#!/usr/bin/env python3
"""
WETH Price Monitor for Arbitrum Mainnet
Monitors WETH prices across multiple DEXs and sends alerts via Telegram
"""

import asyncio
import logging
import signal
import sys
from datetime import datetime
from typing import Dict, List

from dex_fetchers import DEXPriceFetcher
from telegram_bot import TelegramNotifier
from config import MONITORING_INTERVAL, MIN_ARBITRAGE_THRESHOLD

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('weth_monitor.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class WETHMonitor:
    def __init__(self):
        self.dex_fetcher = DEXPriceFetcher()
        self.telegram_notifier = TelegramNotifier()
        self.running = True
        self.last_prices = {}
        self.arbitrage_alerts_sent = set()

    async def fetch_and_analyze_prices(self) -> Dict:
        """Fetch prices from all DEXs and analyze for arbitrage opportunities"""
        try:
            logger.info("Fetching WETH prices from all DEXs...")
            
            # Get prices from all DEXs
            prices = await self.dex_fetcher.get_all_prices()
            
            # Calculate arbitrage opportunities
            arbitrage_opportunities = self.dex_fetcher.calculate_arbitrage_opportunities(prices)
            
            # Filter opportunities above threshold
            significant_opportunities = [
                opp for opp in arbitrage_opportunities 
                if opp['difference_percent'] >= MIN_ARBITRAGE_THRESHOLD
            ]
            
            return {
                'prices': prices,
                'arbitrage_opportunities': significant_opportunities,
                'timestamp': datetime.now()
            }
            
        except Exception as e:
            logger.error(f"Error fetching prices: {e}")
            return {
                'prices': {},
                'arbitrage_opportunities': [],
                'timestamp': datetime.now(),
                'error': str(e)
            }

    async def send_alerts(self, data: Dict):
        """Send appropriate alerts based on the data"""
        try:
            prices = data['prices']
            arbitrage_opportunities = data['arbitrage_opportunities']
            
            # Always send price alert
            await self.telegram_notifier.send_price_alert(prices, arbitrage_opportunities)
            
            # Send arbitrage alerts for new opportunities
            for opportunity in arbitrage_opportunities:
                opportunity_key = f"{opportunity['dex1']}_{opportunity['dex2']}_{opportunity['difference_percent']:.1f}"
                
                if opportunity_key not in self.arbitrage_alerts_sent:
                    await self.telegram_notifier.send_arbitrage_alert(opportunity)
                    self.arbitrage_alerts_sent.add(opportunity_key)
                    
                    # Keep only recent alerts (prevent spam)
                    if len(self.arbitrage_alerts_sent) > 50:
                        self.arbitrage_alerts_sent.clear()
            
            # Send error alert if there was an error
            if 'error' in data:
                await self.telegram_notifier.send_error_alert(data['error'])
                
        except Exception as e:
            logger.error(f"Error sending alerts: {e}")
            await self.telegram_notifier.send_error_alert(f"Alert sending failed: {str(e)}")

    async def monitor_cycle(self):
        """Single monitoring cycle"""
        try:
            logger.info("Starting monitoring cycle...")
            
            # Fetch and analyze prices
            data = await self.fetch_and_analyze_prices()
            
            # Send alerts
            await self.send_alerts(data)
            
            # Update last prices for comparison
            self.last_prices = data['prices']
            
            logger.info("Monitoring cycle completed successfully")
            
        except Exception as e:
            logger.error(f"Error in monitoring cycle: {e}")
            await self.telegram_notifier.send_error_alert(f"Monitoring cycle failed: {str(e)}")

    async def start_monitoring(self):
        """Start the continuous monitoring process"""
        try:
            logger.info("Starting WETH price monitoring...")
            
            # Test Telegram connection
            if not await self.telegram_notifier.test_connection():
                logger.error("Failed to connect to Telegram. Exiting.")
                return
            
            # Initial monitoring cycle
            await self.monitor_cycle()
            
            # Start continuous monitoring
            while self.running:
                logger.info(f"Waiting {MONITORING_INTERVAL} seconds until next check...")
                await asyncio.sleep(MONITORING_INTERVAL)
                
                if self.running:
                    await self.monitor_cycle()
                    
        except KeyboardInterrupt:
            logger.info("Received interrupt signal. Shutting down...")
            self.running = False
        except Exception as e:
            logger.error(f"Fatal error in monitoring: {e}")
            await self.telegram_notifier.send_error_alert(f"Fatal monitoring error: {str(e)}")
        finally:
            logger.info("WETH monitoring stopped")

    def stop(self):
        """Stop the monitoring process"""
        logger.info("Stopping WETH monitoring...")
        self.running = False

async def main():
    """Main entry point"""
    monitor = WETHMonitor()
    
    # Set up signal handlers for graceful shutdown
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}")
        monitor.stop()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        await monitor.start_monitoring()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("🚀 Starting WETH Price Monitor for Arbitrum Mainnet")
    print("📊 Monitoring WETH prices every 3 minutes")
    print("📱 Sending alerts to Telegram")
    print("🔍 Looking for arbitrage opportunities")
    print("=" * 50)
    
    asyncio.run(main())