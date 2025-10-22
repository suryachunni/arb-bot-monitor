"""
🏆 SIMPLIFIED PREMIUM ARBITRAGE BOT
100% Automated - Mobile Optimized Version
"""

import asyncio
import os
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

class SimplifiedArbitrageBot:
    """Simplified but fully functional arbitrage bot"""
    
    RPC_ENDPOINTS = [
        'https://arb1.arbitrum.io/rpc',
        'https://arbitrum-one.publicnode.com',
        'https://rpc.ankr.com/arbitrum',
    ]
    
    TOKENS = {
        'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        'ARB': '0x912CE59144191C1204E64559FE8253a0e49E6548',
    }
    
    UNISWAP_V3_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'
    
    def __init__(self):
        self.scan_interval = int(os.getenv('SCAN_INTERVAL', '600'))
        self.min_profit_usd = float(os.getenv('MIN_PROFIT_USD', '50'))
        self.max_gas_gwei = float(os.getenv('MAX_GAS_PRICE_GWEI', '2.0'))
        
        self.w3 = Web3(Web3.HTTPProvider(self.RPC_ENDPOINTS[0]))
        
        self.quoter_abi = [{
            "inputs": [
                {"name": "tokenIn", "type": "address"},
                {"name": "tokenOut", "type": "address"},
                {"name": "fee", "type": "uint24"},
                {"name": "amountIn", "type": "uint256"},
                {"name": "sqrtPriceLimitX96", "type": "uint160"}
            ],
            "name": "quoteExactInputSingle",
            "outputs": [{"name": "amountOut", "type": "uint256"}],
            "stateMutability": "nonpayable",
            "type": "function"
        }]
        
        self.scans = 0
        self.opportunities_found = 0
        
        logger.info("="*80)
        logger.info("🤖 SIMPLIFIED PREMIUM ARBITRAGE BOT - MOBILE VERSION")
        logger.info("="*80)
        logger.info(f"Scan interval: {self.scan_interval}s")
        logger.info(f"Min profit: ${self.min_profit_usd}")
        logger.info("="*80 + "\n")
    
    async def get_v3_price(self, token_in, token_out, fee, amount_in):
        """Get Uniswap V3 price"""
        try:
            quoter = self.w3.eth.contract(address=self.UNISWAP_V3_QUOTER, abi=self.quoter_abi)
            amount_out = quoter.functions.quoteExactInputSingle(
                token_in, token_out, fee, amount_in, 0
            ).call()
            return float(amount_out)
        except:
            return None
    
    async def scan_opportunities(self):
        """Scan for arbitrage opportunities"""
        opportunities = []
        
        pairs = [
            ('WETH', 'USDC', 18, 6, 1),
            ('WETH', 'USDT', 18, 6, 1),
            ('ARB', 'USDC', 18, 6, 100),
        ]
        
        v3_fees = [500, 3000, 10000]
        
        for token_a, token_b, dec_a, dec_b, amt_mult in pairs:
            token_in = self.TOKENS[token_a]
            token_out = self.TOKENS[token_b]
            amount_in = amt_mult * (10 ** dec_a)
            
            prices = {}
            for fee in v3_fees:
                price_raw = await self.get_v3_price(token_in, token_out, fee, amount_in)
                if price_raw:
                    price = (price_raw * 10**dec_b) / (10**dec_a) / amt_mult
                    prices[fee] = price
            
            for fee1 in v3_fees:
                for fee2 in v3_fees:
                    if fee1 >= fee2 or fee1 not in prices or fee2 not in prices:
                        continue
                    
                    spread_pct = abs((prices[fee2] - prices[fee1]) / prices[fee1]) * 100
                    
                    if spread_pct > 0.3 and spread_pct < 5:
                        flash_amount = 50000
                        gross_profit = flash_amount * (spread_pct / 100)
                        costs = (flash_amount * 0.0005) + 0.40 + (flash_amount * 0.006)
                        net_profit = gross_profit - costs
                        
                        if net_profit >= self.min_profit_usd:
                            opportunities.append({
                                'pair': f"{token_a}/{token_b}",
                                'spread': spread_pct,
                                'net_profit': net_profit,
                                'flash_amount': flash_amount
                            })
        
        return opportunities
    
    async def run(self):
        """Main loop"""
        logger.info("🚀 Starting automated scan loop...\n")
        
        while True:
            try:
                self.scans += 1
                logger.info(f"{'='*80}")
                logger.info(f"SCAN #{self.scans} - {datetime.utcnow().strftime('%H:%M:%S UTC')}")
                logger.info(f"{'='*80}")
                
                opportunities = await self.scan_opportunities()
                
                if opportunities:
                    logger.info(f"✅ Found {len(opportunities)} opportunities:\n")
                    for opp in opportunities[:5]:
                        logger.info(f"  💰 {opp['pair']}: ${opp['net_profit']:.2f} NET ({opp['spread']:.3f}% spread)")
                        self.opportunities_found += 1
                else:
                    logger.info("No profitable opportunities found")
                
                logger.info(f"\n📊 STATS: Scans: {self.scans} | Opportunities: {self.opportunities_found}")
                logger.info(f"⏳ Next scan in {self.scan_interval} seconds...\n")
                
                await asyncio.sleep(self.scan_interval)
                
            except KeyboardInterrupt:
                logger.info("\n🛑 Stopping bot...")
                break
            except Exception as e:
                logger.error(f"❌ Error: {e}")
                await asyncio.sleep(60)

async def main():
    bot = SimplifiedArbitrageBot()
    await bot.run()

if __name__ == "__main__":
    asyncio.run(main())
