import asyncio
import aiohttp
import json
import time
from datetime import datetime
from typing import Dict, List, Optional
from web3 import Web3
from telegram import Bot
from telegram.error import TelegramError
import logging
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class WETHPriceMonitor:
    def __init__(self):
        self.alchemy_key = os.getenv('ALCHEMY_API_KEY')
        self.telegram_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.telegram_chat_id = os.getenv('TELEGRAM_CHAT_ID')
        self.rpc_url = f"https://arb-mainnet.g.alchemy.com/v2/{self.alchemy_key}"
        
        # Initialize Web3
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        
        # Initialize Telegram bot
        self.telegram_bot = Bot(token=self.telegram_token)
        
        # WETH contract address on Arbitrum
        self.WETH_ADDRESS = self.w3.to_checksum_address("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1")
        
        # DEX configurations
        self.dexs = {
            "Uniswap V3": {
                "router": self.w3.to_checksum_address("0xE592427A0AEce92De3Edee1F18E0157C05861564"),
                "factory": self.w3.to_checksum_address("0x1F98431c8aD98523631AE4a59f267346ea31F984"),
                "quoter": self.w3.to_checksum_address("0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6")
            },
            "SushiSwap": {
                "router": self.w3.to_checksum_address("0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"),
                "factory": self.w3.to_checksum_address("0xc35DADB65012eC5796536bD9864eD8773aBc74C4")
            },
            "Camelot": {
                "router": self.w3.to_checksum_address("0xc873fEcbd354f5A56E00E71B7F8B9b8Dcee8f1Ce"),
                "factory": self.w3.to_checksum_address("0x6EcCab422D763aC031210895C81787E87C43a4aC")
            },
            "Arbidex": {
                "router": self.w3.to_checksum_address("0x7E7A0e201FD38d3ADAA9523Da688C79E2c4e0fe0"),
                "factory": self.w3.to_checksum_address("0x6EcCab422D763aC031210895C81787E87C43a4aC")
            }
        }
        
        # USDC address for price reference
        self.USDC_ADDRESS = self.w3.to_checksum_address("0xaf88d065e77c8cC2239327C5EDb3A432268e5831")
        
        # Price storage
        self.prices = {}
        self.last_update = None

    async def get_weth_usdc_price_uniswap_v3(self) -> Optional[float]:
        """Get WETH/USDC price from Uniswap V3"""
        try:
            # Uniswap V3 Quoter contract ABI (simplified)
            quoter_abi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "tokenIn", "type": "address"},
                        {"internalType": "address", "name": "tokenOut", "type": "address"},
                        {"internalType": "uint24", "name": "fee", "type": "uint24"},
                        {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                        {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
                    ],
                    "name": "quoteExactInputSingle",
                    "outputs": [
                        {"internalType": "uint256", "name": "amountOut", "type": "uint256"}
                    ],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            quoter_contract = self.w3.eth.contract(
                address=self.dexs["Uniswap V3"]["quoter"],
                abi=quoter_abi
            )
            
            # Get quote for 1 WETH (10^18 wei)
            amount_in = 10**18  # 1 WETH
            fee = 3000  # 0.3% fee tier
            
            result = quoter_contract.functions.quoteExactInputSingle(
                self.WETH_ADDRESS,
                self.USDC_ADDRESS,
                fee,
                amount_in,
                0
            ).call()
            
            # Convert from 6 decimals (USDC) to get price
            price = result / (10**6)
            return price
            
        except Exception as e:
            logger.error(f"Error fetching Uniswap V3 price: {e}")
            return None

    async def get_weth_usdc_price_sushiswap(self) -> Optional[float]:
        """Get WETH/USDC price from SushiSwap"""
        try:
            # SushiSwap Router ABI (simplified)
            router_abi = [
                {
                    "inputs": [
                        {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                        {"internalType": "address[]", "name": "path", "type": "address[]"}
                    ],
                    "name": "getAmountsOut",
                    "outputs": [
                        {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            router_contract = self.w3.eth.contract(
                address=self.dexs["SushiSwap"]["router"],
                abi=router_abi
            )
            
            # Get quote for 1 WETH
            amount_in = 10**18  # 1 WETH
            path = [self.WETH_ADDRESS, self.USDC_ADDRESS]
            
            result = router_contract.functions.getAmountsOut(amount_in, path).call()
            
            # Convert from 6 decimals (USDC) to get price
            price = result[1] / (10**6)
            return price
            
        except Exception as e:
            logger.error(f"Error fetching SushiSwap price: {e}")
            return None

    async def get_weth_usdc_price_camelot(self) -> Optional[float]:
        """Get WETH/USDC price from Camelot"""
        try:
            # Camelot Router ABI (similar to SushiSwap)
            router_abi = [
                {
                    "inputs": [
                        {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                        {"internalType": "address[]", "name": "path", "type": "address[]"}
                    ],
                    "name": "getAmountsOut",
                    "outputs": [
                        {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            router_contract = self.w3.eth.contract(
                address=self.dexs["Camelot"]["router"],
                abi=router_abi
            )
            
            amount_in = 10**18  # 1 WETH
            path = [self.WETH_ADDRESS, self.USDC_ADDRESS]
            
            result = router_contract.functions.getAmountsOut(amount_in, path).call()
            price = result[1] / (10**6)
            return price
            
        except Exception as e:
            logger.error(f"Error fetching Camelot price: {e}")
            return None

    async def get_weth_usdc_price_arbidex(self) -> Optional[float]:
        """Get WETH/USDC price from Arbidex"""
        try:
            router_abi = [
                {
                    "inputs": [
                        {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                        {"internalType": "address[]", "name": "path", "type": "address[]"}
                    ],
                    "name": "getAmountsOut",
                    "outputs": [
                        {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            router_contract = self.w3.eth.contract(
                address=self.dexs["Arbidex"]["router"],
                abi=router_abi
            )
            
            amount_in = 10**18  # 1 WETH
            path = [self.WETH_ADDRESS, self.USDC_ADDRESS]
            
            result = router_contract.functions.getAmountsOut(amount_in, path).call()
            price = result[1] / (10**6)
            return price
            
        except Exception as e:
            logger.error(f"Error fetching Arbidex price: {e}")
            return None

    async def fetch_all_prices(self) -> Dict[str, float]:
        """Fetch WETH prices from all DEXs"""
        prices = {}
        
        # Create tasks for parallel execution
        tasks = [
            ("Uniswap V3", self.get_weth_usdc_price_uniswap_v3()),
            ("SushiSwap", self.get_weth_usdc_price_sushiswap()),
            ("Camelot", self.get_weth_usdc_price_camelot()),
            ("Arbidex", self.get_weth_usdc_price_arbidex())
        ]
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*[task[1] for task in tasks], return_exceptions=True)
        
        for i, (dex_name, result) in enumerate(zip([task[0] for task in tasks], results)):
            if isinstance(result, Exception):
                logger.error(f"Error fetching {dex_name} price: {result}")
                prices[dex_name] = None
            else:
                prices[dex_name] = result
                
        return prices

    def calculate_arbitrage_opportunities(self, prices: Dict[str, float]) -> List[Dict]:
        """Calculate arbitrage opportunities between DEXs"""
        opportunities = []
        valid_prices = {k: v for k, v in prices.items() if v is not None}
        
        if len(valid_prices) < 2:
            return opportunities
        
        dex_names = list(valid_prices.keys())
        
        for i in range(len(dex_names)):
            for j in range(i + 1, len(dex_names)):
                dex1, dex2 = dex_names[i], dex_names[j]
                price1, price2 = valid_prices[dex1], valid_prices[dex2]
                
                if price1 and price2:
                    spread = abs(price1 - price2)
                    spread_percentage = (spread / min(price1, price2)) * 100
                    
                    if spread_percentage > 0.1:  # Only show spreads > 0.1%
                        opportunities.append({
                            "dex1": dex1,
                            "dex2": dex2,
                            "price1": price1,
                            "price2": price2,
                            "spread": spread,
                            "spread_percentage": spread_percentage,
                            "buy_from": dex1 if price1 < price2 else dex2,
                            "sell_to": dex2 if price1 < price2 else dex1
                        })
        
        return sorted(opportunities, key=lambda x: x["spread_percentage"], reverse=True)

    async def send_telegram_alert(self, prices: Dict[str, float], opportunities: List[Dict]):
        """Send price alert to Telegram"""
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
            
            message = f"🚀 **WETH Price Alert** 🚀\n"
            message += f"⏰ Time: {timestamp}\n\n"
            
            message += "💰 **Current WETH Prices (USDC):**\n"
            for dex, price in prices.items():
                if price is not None:
                    message += f"• {dex}: ${price:.4f}\n"
                else:
                    message += f"• {dex}: ❌ Error\n"
            
            if opportunities:
                message += f"\n🎯 **Arbitrage Opportunities:**\n"
                for opp in opportunities[:5]:  # Show top 5 opportunities
                    message += f"• {opp['buy_from']} → {opp['sell_to']}\n"
                    message += f"  Spread: {opp['spread_percentage']:.2f}% (${opp['spread']:.4f})\n"
                    message += f"  Buy: ${opp['price1']:.4f} → Sell: ${opp['price2']:.4f}\n\n"
            else:
                message += "\n❌ No significant arbitrage opportunities found\n"
            
            await self.telegram_bot.send_message(
                chat_id=self.telegram_chat_id,
                text=message,
                parse_mode='Markdown'
            )
            
            logger.info("Telegram alert sent successfully")
            
        except TelegramError as e:
            logger.error(f"Telegram error: {e}")
        except Exception as e:
            logger.error(f"Error sending Telegram alert: {e}")

    async def run_price_check(self):
        """Run a single price check cycle"""
        logger.info("Starting price check cycle...")
        
        try:
            # Fetch prices from all DEXs
            prices = await self.fetch_all_prices()
            self.prices = prices
            self.last_update = datetime.now()
            
            # Calculate arbitrage opportunities
            opportunities = self.calculate_arbitrage_opportunities(prices)
            
            # Send Telegram alert
            await self.send_telegram_alert(prices, opportunities)
            
            logger.info("Price check cycle completed successfully")
            
        except Exception as e:
            logger.error(f"Error in price check cycle: {e}")

    async def start_monitoring(self):
        """Start the continuous monitoring process"""
        logger.info("Starting WETH price monitoring...")
        logger.info(f"Monitoring every 3 minutes")
        logger.info(f"Telegram alerts will be sent to chat ID: {self.telegram_chat_id}")
        
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
    """Main function to start the monitoring"""
    monitor = WETHPriceMonitor()
    await monitor.start_monitoring()

if __name__ == "__main__":
    asyncio.run(main())