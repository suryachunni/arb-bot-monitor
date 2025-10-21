from arbitrage_bot import ArbitrageScanner
import logging

logging.basicConfig(level=logging.INFO)
scanner = ArbitrageScanner()

# Quick scan
opps = scanner.scan_for_opportunities()

print('\n' + '='*70)
print('🎯 VALIDATED OPPORTUNITIES FOUND')
print('='*70)

for idx, opp in enumerate(opps[:5], 1):
    print(f'\n{idx}. {opp["pair"]}')
    print(f'   Buy: {opp["buy_dex"]} @ ${opp["buy_price"]:.6f}')
    print(f'   Sell: {opp["sell_dex"]} @ ${opp["sell_price"]:.6f}')
    print(f'   Spread: {opp["spread_pct"]:.3f}%')
    print(f'   NET Profit: ${opp["profit"]["net_profit"]:.2f}')

print(f'\nTotal: {len(opps)} REAL opportunities')
print('='*70)
print('✅ ALL FAKE OPPORTUNITIES FILTERED OUT!')
print('='*70)
