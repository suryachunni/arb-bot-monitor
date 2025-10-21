"""
Quick test - send top 3 opportunities to Telegram
"""

from arbitrage_bot import ArbitrageScanner
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scanner = ArbitrageScanner()

# Scan just a few key pairs
logger.info("Scanning key pairs...")

opps = []
opps.extend(scanner.find_direct_arbitrage('WETH', 'USDC'))
opps.extend(scanner.find_direct_arbitrage('ARB', 'USDC'))
opps.extend(scanner.find_direct_arbitrage('LINK', 'WETH'))
opps.extend(scanner.find_direct_arbitrage('MAGIC', 'WETH'))

# Get triangular
opps.extend(scanner.find_triangular_arbitrage('WETH', 'USDC', 'ARB'))

# Filter profitable
profitable = [o for o in opps if o['profit']['net_profit'] > 10]

logger.info(f"Found {len(profitable)} opportunities")

# Format and send
if profitable:
    message = scanner.format_opportunity_message(profitable)
    logger.info(f"\n{message}\n")
    scanner.send_telegram_message(message)
    logger.info("✅ Alert sent to Telegram!")
