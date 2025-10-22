"""
Send Telegram alert immediately - no waiting
"""

from arbitrage_bot import ArbitrageScanner
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("Initializing scanner...")
scanner = ArbitrageScanner()

logger.info("Forcing immediate alert (bypassing 3-minute wait)...")
scanner.last_alert_time = 0  # Force alert to send

logger.info("Scanning for opportunities...")
opportunities = scanner.scan_for_opportunities()

logger.info(f"\n✅ Scan complete!")
logger.info(f"Found {len(opportunities)} opportunities")
logger.info(f"Telegram alert should be sent!")

if opportunities:
    logger.info("\nTop 3 opportunities:")
    for idx, opp in enumerate(opportunities[:3], 1):
        logger.info(f"{idx}. {opp['pair']}: ${opp['profit']['net_profit']:.2f} profit")
else:
    logger.info("No profitable opportunities found")

logger.info("\n📱 Check your Telegram now!")
