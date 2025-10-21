"""
Test the new validation to ensure it filters out bad prices
"""

from arbitrage_bot import ArbitrageScanner
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    logger.info("="*70)
    logger.info("TESTING PRICE VALIDATION")
    logger.info("="*70)
    
    scanner = ArbitrageScanner()
    
    # Test safe pairs
    test_pairs = [
        ('WETH', 'USDC'),
        ('WETH', 'ARB'),
        ('ARB', 'USDC'),
        ('USDC', 'USDT'),
    ]
    
    logger.info("\n🔍 Testing price fetching with validation:\n")
    
    for token_a, token_b in test_pairs:
        prices = scanner.get_all_prices(token_a, token_b)
        
        logger.info(f"{token_a}/{token_b}:")
        if prices:
            for dex, price in sorted(prices.items()):
                logger.info(f"  {dex:15s}: {price:.6f}")
            
            # Check price consistency
            if len(prices) >= 2:
                price_vals = list(prices.values())
                max_price = max(price_vals)
                min_price = min(price_vals)
                ratio = max_price / min_price
                logger.info(f"  Price ratio: {ratio:.2f}x")
                
                if ratio > 1.2:
                    logger.warning(f"  ⚠️  Large price difference detected")
                else:
                    logger.info(f"  ✅ Prices consistent")
        else:
            logger.warning(f"  No valid prices found")
        logger.info("")
    
    # Test arbitrage detection
    logger.info("\n" + "="*70)
    logger.info("TESTING ARBITRAGE DETECTION")
    logger.info("="*70 + "\n")
    
    all_opps = []
    
    for token_a, token_b in test_pairs:
        opps = scanner.find_direct_arbitrage(token_a, token_b)
        if opps:
            logger.info(f"✅ {token_a}/{token_b}: {len(opps)} opportunities")
            for opp in opps:
                logger.info(f"   {opp['buy_dex']} → {opp['sell_dex']}: {opp['spread_pct']:.3f}% (${opp['profit']['net_profit']:.2f})")
                all_opps.append(opp)
        else:
            logger.info(f"   {token_a}/{token_b}: No opportunities")
    
    logger.info("\n" + "="*70)
    logger.info("SUMMARY")
    logger.info("="*70)
    logger.info(f"Total valid opportunities: {len(all_opps)}")
    
    if all_opps:
        profitable = [o for o in all_opps if o['profit']['net_profit'] > 50]
        logger.info(f"Profitable (>$50): {len(profitable)}")
        
        if profitable:
            logger.info("\n🏆 TOP 3 OPPORTUNITIES:\n")
            for idx, opp in enumerate(sorted(profitable, key=lambda x: x['profit']['net_profit'], reverse=True)[:3], 1):
                logger.info(f"{idx}. {opp['pair']}")
                logger.info(f"   Buy: {opp['buy_dex']} @ {opp['buy_price']:.6f}")
                logger.info(f"   Sell: {opp['sell_dex']} @ {opp['sell_price']:.6f}")
                logger.info(f"   Spread: {opp['spread_pct']:.3f}%")
                logger.info(f"   NET Profit: ${opp['profit']['net_profit']:.2f}")
                logger.info("")
    
    logger.info("="*70)
    logger.info("✅ VALIDATION TEST COMPLETE")
    logger.info("="*70)
    logger.info("\nAll fake opportunities should be filtered out!")
    logger.info("Only real, tradeable spreads should be shown above.")

if __name__ == "__main__":
    main()
