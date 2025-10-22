"""
Send enhanced Telegram alert with profit breakdown
"""

from arbitrage_bot import ArbitrageScanner
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    logger.info("Scanning for opportunities and sending enhanced Telegram alert...")
    
    scanner = ArbitrageScanner()
    scanner.last_alert_time = 0  # Force send alert
    
    # Run scan
    opportunities = scanner.scan_for_opportunities()
    
    logger.info(f"\n✅ Found {len(opportunities)} profitable opportunities")
    logger.info(f"💰 Alert sent to Telegram with detailed profit breakdown!")

if __name__ == "__main__":
    main()
