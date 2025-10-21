"""
Quick test to verify bot functionality and send a test Telegram alert
"""

from arbitrage_bot import ArbitrageScanner
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    logger.info("Starting quick bot test...")
    
    # Initialize scanner
    scanner = ArbitrageScanner()
    
    # Run one scan
    logger.info("\n" + "="*60)
    logger.info("Running single arbitrage scan...")
    logger.info("="*60)
    
    opportunities = scanner.scan_for_opportunities()
    
    logger.info(f"\n✅ Found {len(opportunities)} total opportunities")
    
    if opportunities:
        # Force send alert (bypass time check)
        scanner.last_alert_time = 0
        scanner.scan_for_opportunities()
        logger.info("✅ Telegram alert sent!")
    else:
        logger.info("ℹ️  No opportunities found this scan")
    
    logger.info("\n" + "="*60)
    logger.info("Quick test completed!")
    logger.info("="*60)

if __name__ == "__main__":
    main()
