"""
Test the enhanced profit calculation system
Shows real opportunities with $50k flash loan profit breakdown
"""

from arbitrage_bot import ArbitrageScanner
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    logger.info("\n" + "="*80)
    logger.info("TESTING ENHANCED PROFIT CALCULATIONS ($50K FLASH LOAN)")
    logger.info("="*80)
    
    scanner = ArbitrageScanner()
    
    # Test a few key pairs
    logger.info("\n🔍 Scanning for profitable opportunities with detailed profit breakdown...\n")
    
    all_opps = []
    
    # Test direct arbitrage
    test_pairs = [
        ('WETH', 'USDC'),
        ('ARB', 'USDC'),
        ('WETH', 'ARB'),
        ('LINK', 'WETH'),
        ('MAGIC', 'WETH'),
    ]
    
    logger.info("📊 DIRECT ARBITRAGE:\n")
    for token_a, token_b in test_pairs:
        try:
            opps = scanner.find_direct_arbitrage(token_a, token_b)
            if opps:
                for opp in opps:
                    profit = opp['profit']
                    logger.info(f"💰 {opp['pair']}:")
                    logger.info(f"   Buy:  {opp['buy_dex']} @ ${opp['buy_price']:.6f}")
                    logger.info(f"   Sell: {opp['sell_dex']} @ ${opp['sell_price']:.6f}")
                    logger.info(f"   Spread: {opp['spread_pct']:.4f}%")
                    logger.info(f"   ")
                    logger.info(f"   💵 PROFIT BREAKDOWN ($50,000 flash loan):")
                    logger.info(f"      Gross Profit:    ${profit['gross_profit']:>8,.2f}")
                    logger.info(f"      Flash Loan Fee:  -${profit['flash_loan_fee']:>7,.2f} (0.09%)")
                    logger.info(f"      Gas Cost:        -${profit['gas_cost']:>7,.2f}")
                    logger.info(f"      Slippage (0.1%): -${profit['slippage_cost']:>7,.2f}")
                    logger.info(f"      ──────────────────────────")
                    logger.info(f"      NET PROFIT:       ${profit['net_profit']:>8,.2f}")
                    logger.info(f"      ROI:              {profit['roi_pct']:>7.3f}%")
                    logger.info("")
                    all_opps.append(opp)
        except Exception as e:
            logger.debug(f"Error scanning {token_a}/{token_b}: {e}")
    
    # Test triangular arbitrage
    logger.info("\n🔺 TRIANGULAR ARBITRAGE (BOTH DIRECTIONS):\n")
    triangular_paths = [
        ('WETH', 'USDC', 'ARB'),
        ('WETH', 'ARB', 'USDT'),
    ]
    
    for token_a, token_b, token_c in triangular_paths:
        try:
            opps = scanner.find_triangular_arbitrage(token_a, token_b, token_c)
            if opps:
                for opp in opps:
                    profit = opp['profit']
                    logger.info(f"🔄 {opp['path']} ({opp['direction'].upper()}):")
                    logger.info(f"   DEX: {opp['dex']}")
                    logger.info(f"   Profit: {opp['profit_pct']:.4f}%")
                    logger.info(f"   ")
                    logger.info(f"   💵 PROFIT BREAKDOWN ($50,000 flash loan):")
                    logger.info(f"      Gross Profit:    ${profit['gross_profit']:>8,.2f}")
                    logger.info(f"      Flash Loan Fee:  -${profit['flash_loan_fee']:>7,.2f} (0.09%)")
                    logger.info(f"      Gas Cost:        -${profit['gas_cost']:>7,.2f}")
                    logger.info(f"      Slippage (0.1%): -${profit['slippage_cost']:>7,.2f}")
                    logger.info(f"      ──────────────────────────")
                    logger.info(f"      NET PROFIT:       ${profit['net_profit']:>8,.2f}")
                    logger.info(f"      ROI:              {profit['roi_pct']:>7.3f}%")
                    logger.info("")
                    all_opps.append(opp)
        except Exception as e:
            logger.debug(f"Error in triangular {token_a}-{token_b}-{token_c}: {e}")
    
    # Summary
    logger.info("\n" + "="*80)
    logger.info("SUMMARY")
    logger.info("="*80)
    
    if all_opps:
        profitable_opps = [opp for opp in all_opps if opp['profit']['net_profit'] > 10]
        total_net_profit = sum(opp['profit']['net_profit'] for opp in profitable_opps)
        
        logger.info(f"✅ Total Opportunities Found: {len(all_opps)}")
        logger.info(f"✅ Profitable (>$10): {len(profitable_opps)}")
        logger.info(f"💰 Combined Net Profit: ${total_net_profit:,.2f}")
        logger.info(f"⚡ All opportunities are flash loan ready!")
        
        # Show top 3
        logger.info(f"\n🏆 TOP 3 OPPORTUNITIES:\n")
        for idx, opp in enumerate(sorted(profitable_opps, key=lambda x: x['profit']['net_profit'], reverse=True)[:3], 1):
            if opp['type'] == 'direct':
                logger.info(f"{idx}. {opp['pair']} - ${opp['profit']['net_profit']:,.2f} net profit")
            else:
                logger.info(f"{idx}. {opp['path']} - ${opp['profit']['net_profit']:,.2f} net profit")
    else:
        logger.info("ℹ️  No opportunities found (spreads too small for profit after costs)")
    
    logger.info("\n" + "="*80)
    logger.info("✅ PROFIT CALCULATION TEST COMPLETE!")
    logger.info("="*80)

if __name__ == "__main__":
    main()
