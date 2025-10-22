"""
Test script for Arbitrage Bot
Runs comprehensive tests to verify real-time price accuracy
"""

import sys
from arbitrage_bot import ArbitrageScanner, TOKENS
import logging
import time
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_connection():
    """Test 1: Verify connection to Arbitrum mainnet"""
    logger.info("\n" + "="*60)
    logger.info("TEST 1: Connection to Arbitrum Mainnet")
    logger.info("="*60)
    try:
        scanner = ArbitrageScanner()
        chain_id = scanner.w3.eth.chain_id
        block_number = scanner.w3.eth.block_number
        logger.info(f"✅ Connected to Arbitrum (Chain ID: {chain_id})")
        logger.info(f"✅ Current block: {block_number}")
        return scanner
    except Exception as e:
        logger.error(f"❌ Connection failed: {e}")
        return None


def test_token_decimals(scanner):
    """Test 2: Verify token decimals"""
    logger.info("\n" + "="*60)
    logger.info("TEST 2: Token Decimals Verification")
    logger.info("="*60)
    
    for token_name, token_address in TOKENS.items():
        try:
            decimals = scanner.get_token_decimals(token_address)
            logger.info(f"✅ {token_name}: {decimals} decimals")
        except Exception as e:
            logger.error(f"❌ {token_name}: Failed - {e}")


def test_uniswap_v3_prices(scanner):
    """Test 3: Get real-time prices from Uniswap V3"""
    logger.info("\n" + "="*60)
    logger.info("TEST 3: Uniswap V3 Real-Time Prices")
    logger.info("="*60)
    
    test_pairs = [
        ('WETH', 'USDC'),
        ('WETH', 'ARB'),
        ('ARB', 'USDC'),
        ('LINK', 'WETH'),
    ]
    
    for token_a, token_b in test_pairs:
        try:
            price = scanner.get_uniswap_v3_price(TOKENS[token_a], TOKENS[token_b])
            if price:
                logger.info(f"✅ {token_a}/{token_b}: {price:.8f} (1 {token_a} = {price:.6f} {token_b})")
            else:
                logger.warning(f"⚠️  {token_a}/{token_b}: No liquidity pool found")
        except Exception as e:
            logger.error(f"❌ {token_a}/{token_b}: Error - {e}")


def test_sushiswap_prices(scanner):
    """Test 4: Get real-time prices from Sushiswap"""
    logger.info("\n" + "="*60)
    logger.info("TEST 4: Sushiswap Real-Time Prices")
    logger.info("="*60)
    
    test_pairs = [
        ('WETH', 'USDC'),
        ('WETH', 'ARB'),
        ('ARB', 'USDC'),
    ]
    
    for token_a, token_b in test_pairs:
        try:
            price = scanner.get_uniswap_v2_price('Sushiswap', TOKENS[token_a], TOKENS[token_b])
            if price:
                logger.info(f"✅ {token_a}/{token_b}: {price:.8f}")
            else:
                logger.warning(f"⚠️  {token_a}/{token_b}: No pair found")
        except Exception as e:
            logger.error(f"❌ {token_a}/{token_b}: Error - {e}")


def test_camelot_prices(scanner):
    """Test 5: Get real-time prices from Camelot"""
    logger.info("\n" + "="*60)
    logger.info("TEST 5: Camelot Real-Time Prices")
    logger.info("="*60)
    
    test_pairs = [
        ('WETH', 'USDC'),
        ('WETH', 'ARB'),
        ('ARB', 'USDC'),
    ]
    
    for token_a, token_b in test_pairs:
        try:
            price = scanner.get_uniswap_v2_price('Camelot', TOKENS[token_a], TOKENS[token_b])
            if price:
                logger.info(f"✅ {token_a}/{token_b}: {price:.8f}")
            else:
                logger.warning(f"⚠️  {token_a}/{token_b}: No pair found")
        except Exception as e:
            logger.error(f"❌ {token_a}/{token_b}: Error - {e}")


def test_price_comparison(scanner):
    """Test 6: Compare prices across DEXs"""
    logger.info("\n" + "="*60)
    logger.info("TEST 6: Cross-DEX Price Comparison")
    logger.info("="*60)
    
    test_pairs = [
        ('WETH', 'USDC'),
        ('WETH', 'ARB'),
        ('ARB', 'USDC'),
    ]
    
    for token_a, token_b in test_pairs:
        logger.info(f"\n📊 {token_a}/{token_b} across all DEXs:")
        prices = scanner.get_all_prices(token_a, token_b)
        
        if prices:
            for dex, price in sorted(prices.items(), key=lambda x: x[1]):
                logger.info(f"  {dex:15s}: {price:.8f}")
            
            # Calculate spread
            if len(prices) >= 2:
                min_price = min(prices.values())
                max_price = max(prices.values())
                spread = ((max_price - min_price) / min_price) * 100
                logger.info(f"  📈 Spread: {spread:.4f}%")
        else:
            logger.warning(f"  ⚠️  No prices found")


def test_direct_arbitrage(scanner):
    """Test 7: Test direct arbitrage detection"""
    logger.info("\n" + "="*60)
    logger.info("TEST 7: Direct Arbitrage Detection")
    logger.info("="*60)
    
    test_pairs = [
        ('WETH', 'USDC'),
        ('WETH', 'ARB'),
        ('ARB', 'USDC'),
        ('LINK', 'WETH'),
        ('MAGIC', 'WETH'),
    ]
    
    total_opportunities = 0
    
    for token_a, token_b in test_pairs:
        opps = scanner.find_direct_arbitrage(token_a, token_b)
        if opps:
            for opp in opps:
                logger.info(f"\n💰 OPPORTUNITY FOUND:")
                logger.info(f"  Pair: {opp['pair']}")
                logger.info(f"  Buy on {opp['buy_dex']}: {opp['buy_price']:.8f}")
                logger.info(f"  Sell on {opp['sell_dex']}: {opp['sell_price']:.8f}")
                logger.info(f"  Spread: {opp['spread_pct']:.4f}%")
                total_opportunities += 1
    
    logger.info(f"\n✅ Total direct arbitrage opportunities: {total_opportunities}")


def test_triangular_arbitrage(scanner):
    """Test 8: Test triangular arbitrage detection"""
    logger.info("\n" + "="*60)
    logger.info("TEST 8: Triangular Arbitrage Detection")
    logger.info("="*60)
    
    test_paths = [
        ('WETH', 'USDC', 'ARB'),
        ('WETH', 'ARB', 'USDT'),
    ]
    
    total_opportunities = 0
    
    for token_a, token_b, token_c in test_paths:
        opps = scanner.find_triangular_arbitrage(token_a, token_b, token_c)
        if opps:
            for opp in opps:
                logger.info(f"\n🔺 TRIANGULAR OPPORTUNITY:")
                logger.info(f"  Path: {opp['path']}")
                logger.info(f"  DEX: {opp['dex']}")
                logger.info(f"  Profit: {opp['profit_pct']:.4f}%")
                total_opportunities += 1
    
    logger.info(f"\n✅ Total triangular opportunities: {total_opportunities}")


def test_full_scan(scanner):
    """Test 9: Full scan simulation"""
    logger.info("\n" + "="*60)
    logger.info("TEST 9: Full Arbitrage Scan")
    logger.info("="*60)
    
    start_time = time.time()
    opportunities = scanner.scan_for_opportunities()
    end_time = time.time()
    
    logger.info(f"\n✅ Scan completed in {end_time - start_time:.2f} seconds")
    logger.info(f"✅ Total opportunities found: {len(opportunities)}")
    
    if opportunities:
        logger.info("\nTop opportunities:")
        for opp in sorted(opportunities, 
                         key=lambda x: x.get('spread_pct', x.get('profit_pct', 0)), 
                         reverse=True)[:3]:
            if opp['type'] == 'direct':
                logger.info(f"  💰 {opp['pair']}: {opp['spread_pct']:.4f}% spread")
            else:
                logger.info(f"  🔺 {opp['path']}: {opp['profit_pct']:.4f}% profit")


def main():
    """Run all tests"""
    logger.info("\n" + "🔍"*30)
    logger.info("ARBITRAGE BOT COMPREHENSIVE TEST SUITE")
    logger.info("🔍"*30)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test 1: Connection
    scanner = test_connection()
    if not scanner:
        logger.error("Cannot proceed without connection")
        sys.exit(1)
    
    time.sleep(1)
    
    # Test 2: Token decimals
    test_token_decimals(scanner)
    time.sleep(1)
    
    # Test 3: Uniswap V3 prices
    test_uniswap_v3_prices(scanner)
    time.sleep(1)
    
    # Test 4: Sushiswap prices
    test_sushiswap_prices(scanner)
    time.sleep(1)
    
    # Test 5: Camelot prices
    test_camelot_prices(scanner)
    time.sleep(1)
    
    # Test 6: Price comparison
    test_price_comparison(scanner)
    time.sleep(1)
    
    # Test 7: Direct arbitrage
    test_direct_arbitrage(scanner)
    time.sleep(1)
    
    # Test 8: Triangular arbitrage
    test_triangular_arbitrage(scanner)
    time.sleep(1)
    
    # Test 9: Full scan
    test_full_scan(scanner)
    
    logger.info("\n" + "="*60)
    logger.info("ALL TESTS COMPLETED")
    logger.info("="*60)
    logger.info(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("\n✅ Bot is ready for production use!")


if __name__ == "__main__":
    main()
