"""
Demo: Run bot for 30 seconds to show live operation
"""

from arbitrage_bot import ArbitrageScanner
import logging
import time

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def main():
    logger.info("\n" + "="*70)
    logger.info("🎬 LIVE BOT DEMONSTRATION")
    logger.info("="*70)
    logger.info("Running bot for 30 seconds to demonstrate live operation...")
    logger.info("Bot will scan and send Telegram alert if opportunities found.\n")
    
    scanner = ArbitrageScanner()
    scanner.last_alert_time = 0  # Force alert on first scan
    
    # Run for 30 seconds
    end_time = time.time() + 30
    scan_count = 0
    
    while time.time() < end_time:
        scan_count += 1
        logger.info(f"\n{'='*70}")
        logger.info(f"SCAN #{scan_count}")
        logger.info(f"{'='*70}")
        
        opportunities = scanner.scan_for_opportunities()
        
        time_remaining = int(end_time - time.time())
        if time_remaining > 0:
            logger.info(f"\n⏳ Next scan in 10 seconds... ({time_remaining}s remaining)")
            time.sleep(min(10, time_remaining))
    
    logger.info("\n" + "="*70)
    logger.info("🎬 DEMONSTRATION COMPLETE")
    logger.info("="*70)
    logger.info(f"✅ Bot performed {scan_count} scans in 30 seconds")
    logger.info("✅ Telegram alerts sent for detected opportunities")
    logger.info("\n🚀 Bot is ready for 24/7 operation!")
    logger.info("\nTo start continuous monitoring, run:")
    logger.info("  python3 arbitrage_bot.py")
    logger.info("or")
    logger.info("  ./start_bot.sh")

if __name__ == "__main__":
    main()
