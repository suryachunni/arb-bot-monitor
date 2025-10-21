#!/usr/bin/env python3
"""
Arbitrum WETH Price Monitor
Fetches real-time WETH prices from all major DEXs on Arbitrum mainnet
and sends arbitrage alerts to Telegram every 3 minutes.
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

import aiohttp
import pandas as pd
from web3 import Web3
from telegram import Bot
from telegram.error import TelegramError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('price_monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ArbitrumPriceMonitor:
    def __init__(self):
        self.alchemy_key = os.getenv('ALCHEMY_API_KEY')
        self.telegram_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.telegram_chat_id = os.getenv('TELEGRAM_CHAT_ID')
        self.rpc_url = f"https://arb-mainnet.g.alchemy.com/v2/{self.alchemy_key}"
        
        # Initialize Web3
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        
        # Initialize Telegram bot
        self.bot = Bot(token=self.telegram_token)
        
        # WETH contract address on Arbitrum
        self.WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
        
        # DEX configurations
        self.dexs = {
            "Uniswap V3": {
                "router": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
                "factory": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
                "quoter": "0xb273084fBBF8186cE6e9812e2233C2Db27542C44"
            },
            "SushiSwap": {
                "router": "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
                "factory": "0xc35DADB65012eC5796536bD9864eD8773aBc74C4"
            },
            "Camelot": {
                "router": "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
                "factory": "0x6EcCab422D763aC031210F53dB0bb1b5f6e8c4C4"
            },
            "Balancer V2": {
                "vault": "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
            },
            "Curve": {
                "registry": "0x445FE580eF8d70FF569aB36e80c647af338db351"
            }
        }
        
        # Common token addresses
        self.tokens = {
            "WETH": self.WETH_ADDRESS,
            "USDC": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
            "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
            "ARB": "0x912CE59144191C1204E64559FE8253a0e49E6548"
        }
        
        # ABI for ERC20 tokens
        self.erc20_abi = [
            {
                "constant": True,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function"
            },
            {
                "constant": True,
                "inputs": [],
                "name": "decimals",
                "outputs": [{"name": "", "type": "uint8"}],
                "type": "function"
            }
        ]
        
        # Uniswap V3 Quoter ABI
        self.quoter_abi = [
            {
                "inputs": [
                    {"internalType": "address", "name": "tokenIn", "type": "address"},
                    {"internalType": "address", "name": "tokenOut", "type": "address"},
                    {"internalType": "uint24", "name": "fee", "type": "uint24"},
                    {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                    {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
                ],
                "name": "quoteExactInputSingle",
                "outputs": [{"internalType": "uint256", "name": "amountOut", "type": "uint256"}],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]

    async def get_token_price_from_uniswap_v3(self, token_in: str, token_out: str, amount_in: int) -> Optional[float]:
        """Get price from Uniswap V3 using Quoter contract"""
        try:
            quoter_contract = self.w3.eth.contract(
                address=self.dexs["Uniswap V3"]["quoter"],
                abi=self.quoter_abi
            )
            
            # Try different fee tiers (0.05%, 0.3%, 1%)
            fees = [500, 3000, 10000]
            
            for fee in fees:
                try:
                    result = quoter_contract.functions.quoteExactInputSingle(
                        token_in,
                        token_out,
                        fee,
                        amount_in,
                        0
                    ).call()
                    
                    if result > 0:
                        return float(result) / 1e18  # Convert from wei
                except Exception as e:
                    logger.debug(f"Uniswap V3 fee {fee} failed: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Uniswap V3 price fetch error: {e}")
            
        return None

    async def get_token_price_from_sushiswap(self, token_in: str, token_out: str, amount_in: int) -> Optional[float]:
        """Get price from SushiSwap using router contract"""
        try:
            # SushiSwap router ABI for getAmountsOut
            router_abi = [
                {
                    "inputs": [
                        {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                        {"internalType": "address[]", "name": "path", "type": "address[]"}
                    ],
                    "name": "getAmountsOut",
                    "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            router_contract = self.w3.eth.contract(
                address=self.dexs["SushiSwap"]["router"],
                abi=router_abi
            )
            
            path = [token_in, token_out]
            amounts = router_contract.functions.getAmountsOut(amount_in, path).call()
            
            if len(amounts) >= 2 and amounts[1] > 0:
                return float(amounts[1]) / 1e18
                
        except Exception as e:
            logger.error(f"SushiSwap price fetch error: {e}")
            
        return None

    async def get_token_price_from_camelot(self, token_in: str, token_out: str, amount_in: int) -> Optional[float]:
        """Get price from Camelot DEX"""
        try:
            # Camelot router ABI
            router_abi = [
                {
                    "inputs": [
                        {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                        {"internalType": "address[]", "name": "path", "type": "address[]"}
                    ],
                    "name": "getAmountsOut",
                    "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            router_contract = self.w3.eth.contract(
                address=self.dexs["Camelot"]["router"],
                abi=router_abi
            )
            
            path = [token_in, token_out]
            amounts = router_contract.functions.getAmountsOut(amount_in, path).call()
            
            if len(amounts) >= 2 and amounts[1] > 0:
                return float(amounts[1]) / 1e18
                
        except Exception as e:
            logger.error(f"Camelot price fetch error: {e}")
            
        return None

    async def get_weth_prices(self) -> Dict[str, Dict[str, float]]:
        """Fetch WETH prices from all DEXs"""
        prices = {}
        amount_in = 1 * 10**18  # 1 WETH in wei
        
        # Price pairs to check
        pairs = [
            ("WETH", "USDC"),
            ("WETH", "USDT"),
            ("WETH", "ARB")
        ]
        
        for token_in, token_out in pairs:
            token_in_addr = self.tokens[token_in]
            token_out_addr = self.tokens[token_out]
            
            pair_prices = {}
            
            # Fetch from Uniswap V3
            uniswap_price = await self.get_token_price_from_uniswap_v3(
                token_in_addr, token_out_addr, amount_in
            )
            if uniswap_price:
                pair_prices["Uniswap V3"] = uniswap_price
            
            # Fetch from SushiSwap
            sushiswap_price = await self.get_token_price_from_sushiswap(
                token_in_addr, token_out_addr, amount_in
            )
            if sushiswap_price:
                pair_prices["SushiSwap"] = sushiswap_price
            
            # Fetch from Camelot
            camelot_price = await self.get_token_price_from_camelot(
                token_in_addr, token_out_addr, amount_in
            )
            if camelot_price:
                pair_prices["Camelot"] = camelot_price
            
            if pair_prices:
                prices[f"{token_in}/{token_out}"] = pair_prices
        
        return prices

    def calculate_arbitrage_opportunities(self, prices: Dict[str, Dict[str, float]]) -> List[Dict]:
        """Calculate arbitrage opportunities between DEXs"""
        opportunities = []
        
        for pair, dex_prices in prices.items():
            if len(dex_prices) < 2:
                continue
                
            # Find min and max prices
            min_dex = min(dex_prices.items(), key=lambda x: x[1])
            max_dex = max(dex_prices.items(), key=lambda x: x[1])
            
            min_price = min_dex[1]
            max_price = max_dex[1]
            
            # Calculate spread percentage
            spread_percentage = ((max_price - min_price) / min_price) * 100
            
            if spread_percentage > 0.1:  # Only show spreads > 0.1%
                opportunities.append({
                    "pair": pair,
                    "buy_dex": min_dex[0],
                    "sell_dex": max_dex[0],
                    "buy_price": min_price,
                    "sell_price": max_price,
                    "spread_percentage": spread_percentage,
                    "profit_per_weth": max_price - min_price
                })
        
        return sorted(opportunities, key=lambda x: x["spread_percentage"], reverse=True)

    async def send_telegram_alert(self, prices: Dict[str, Dict[str, float]], opportunities: List[Dict]):
        """Send price alert to Telegram"""
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
            
            message = f"🚀 <b>Arbitrum WETH Price Alert</b> 🚀\n"
            message += f"⏰ <b>Time:</b> {timestamp}\n\n"
            
            # Add current prices
            message += "💰 <b>Current WETH Prices:</b>\n"
            for pair, dex_prices in prices.items():
                message += f"\n📊 <b>{pair}</b>\n"
                for dex, price in dex_prices.items():
                    message += f"  • {dex}: ${price:.4f}\n"
            
            # Add arbitrage opportunities
            if opportunities:
                message += f"\n🎯 <b>Arbitrage Opportunities:</b>\n"
                for opp in opportunities[:5]:  # Show top 5
                    message += f"\n💡 <b>{opp['pair']}</b>\n"
                    message += f"  • Buy on: {opp['buy_dex']} (${opp['buy_price']:.4f})\n"
                    message += f"  • Sell on: {opp['sell_dex']} (${opp['sell_price']:.4f})\n"
                    message += f"  • Spread: {opp['spread_percentage']:.2f}%\n"
                    message += f"  • Profit per WETH: ${opp['profit_per_weth']:.4f}\n"
            else:
                message += "\n❌ No significant arbitrage opportunities found\n"
            
            message += f"\n🔗 <b>Network:</b> Arbitrum Mainnet"
            
            await self.bot.send_message(
                chat_id=self.telegram_chat_id,
                text=message,
                parse_mode='HTML'
            )
            
            logger.info("Telegram alert sent successfully")
            
        except TelegramError as e:
            logger.error(f"Telegram error: {e}")
        except Exception as e:
            logger.error(f"Error sending Telegram alert: {e}")

    async def run_price_check(self):
        """Run a single price check cycle"""
        try:
            logger.info("Starting price check cycle...")
            
            # Fetch prices from all DEXs
            prices = await self.get_weth_prices()
            
            if not prices:
                logger.warning("No prices fetched from any DEX")
                return
            
            # Calculate arbitrage opportunities
            opportunities = self.calculate_arbitrage_opportunities(prices)
            
            # Send Telegram alert
            await self.send_telegram_alert(prices, opportunities)
            
            logger.info(f"Price check completed. Found {len(opportunities)} arbitrage opportunities")
            
        except Exception as e:
            logger.error(f"Error in price check cycle: {e}")

    async def start_monitoring(self):
        """Start the price monitoring loop"""
        logger.info("Starting Arbitrum WETH price monitoring...")
        logger.info(f"Monitoring every 3 minutes")
        logger.info(f"Telegram chat ID: {self.telegram_chat_id}")
        
        while True:
            try:
                await self.run_price_check()
                await asyncio.sleep(180)  # Wait 3 minutes (180 seconds)
            except KeyboardInterrupt:
                logger.info("Monitoring stopped by user")
                break
            except Exception as e:
                logger.error(f"Unexpected error in monitoring loop: {e}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying

async def main():
    """Main function"""
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Validate required environment variables
    required_vars = ['ALCHEMY_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {missing_vars}")
        return
    
    # Initialize and start monitoring
    monitor = ArbitrumPriceMonitor()
    await monitor.start_monitoring()

if __name__ == "__main__":
    asyncio.run(main())