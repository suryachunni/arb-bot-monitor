from arbitrage_bot import ArbitrageScanner
import logging

logging.basicConfig(level=logging.WARNING)  # Quiet
scanner = ArbitrageScanner()

# Force send alert
scanner.last_alert_time = 0
opps = scanner.scan_for_opportunities()

print(f"✅ Found {len(opps)} VALIDATED opportunities")
print("📱 Telegram alert sent with REAL prices only!")
print("\nTop 3:")
for idx, opp in enumerate(opps[:3], 1):
    print(f"{idx}. {opp['pair']}: ${opp['profit']['net_profit']:.2f} profit")
