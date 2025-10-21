import asyncio
import aiohttp
from web3 import Web3
from typing import Dict, List, Optional, Tuple
import json
import logging
from config import ALCHEMY_URL, WETH_ADDRESS, USDC_ADDRESS, DEXS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DEXPriceFetcher:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(ALCHEMY_URL))
        if not self.w3.is_connected():
            raise Exception("Failed to connect to Arbitrum network")
        
        # ABI for common functions
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
        
        self.uniswap_v3_quoter_abi = [
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

    async def get_uniswap_v3_price(self, amount_in: int = 10**18) -> Optional[float]:
        """Get WETH price from Uniswap V3"""
        try:
            quoter_address = DEXS["Uniswap V3"]["quoter"]
            quoter_contract = self.w3.eth.contract(
                address=quoter_address,
                abi=self.uniswap_v3_quoter_abi
            )
            
            # Try different fee tiers (0.05%, 0.3%, 1%)
            fee_tiers = [500, 3000, 10000]
            
            for fee in fee_tiers:
                try:
                    result = quoter_contract.functions.quoteExactInputSingle(
                        WETH_ADDRESS,
                        USDC_ADDRESS,
                        fee,
                        amount_in,
                        0
                    ).call()
                    
                    if result > 0:
                        price = result / (10**6)  # USDC has 6 decimals
                        return price
                except Exception as e:
                    logger.debug(f"Uniswap V3 fee {fee} failed: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Uniswap V3 error: {e}")
        
        return None

    async def get_sushiswap_price(self, amount_in: int = 10**18) -> Optional[float]:
        """Get WETH price from SushiSwap"""
        try:
            # SushiSwap uses Uniswap V2 style router
            router_address = DEXS["SushiSwap"]["router"]
            
            # Get pair address
            factory_address = DEXS["SushiSwap"]["factory"]
            factory_abi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "tokenA", "type": "address"},
                        {"internalType": "address", "name": "tokenB", "type": "address"}
                    ],
                    "name": "getPair",
                    "outputs": [{"internalType": "address", "name": "pair", "type": "address"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            factory_contract = self.w3.eth.contract(
                address=factory_address,
                abi=factory_abi
            )
            
            pair_address = factory_contract.functions.getPair(
                WETH_ADDRESS, USDC_ADDRESS
            ).call()
            
            if pair_address == "0x0000000000000000000000000000000000000000":
                return None
            
            # Get reserves
            pair_abi = [
                {
                    "inputs": [],
                    "name": "getReserves",
                    "outputs": [
                        {"internalType": "uint112", "name": "_reserve0", "type": "uint112"},
                        {"internalType": "uint112", "name": "_reserve1", "type": "uint112"},
                        {"internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "token0",
                    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            pair_contract = self.w3.eth.contract(
                address=pair_address,
                abi=pair_abi
            )
            
            reserves = pair_contract.functions.getReserves().call()
            token0 = pair_contract.functions.token0().call()
            
            if token0.lower() == WETH_ADDRESS.lower():
                weth_reserve = reserves[0]
                usdc_reserve = reserves[1]
            else:
                weth_reserve = reserves[1]
                usdc_reserve = reserves[0]
            
            if weth_reserve > 0:
                price = (usdc_reserve * 10**18) / (weth_reserve * 10**6)
                return price / (10**18)
                
        except Exception as e:
            logger.error(f"SushiSwap error: {e}")
        
        return None

    async def get_camelot_price(self, amount_in: int = 10**18) -> Optional[float]:
        """Get WETH price from Camelot"""
        try:
            # Camelot uses similar approach to SushiSwap
            router_address = DEXS["Camelot"]["router"]
            factory_address = DEXS["Camelot"]["factory"]
            
            factory_abi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "tokenA", "type": "address"},
                        {"internalType": "address", "name": "tokenB", "type": "address"}
                    ],
                    "name": "getPair",
                    "outputs": [{"internalType": "address", "name": "pair", "type": "address"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            factory_contract = self.w3.eth.contract(
                address=factory_address,
                abi=factory_abi
            )
            
            pair_address = factory_contract.functions.getPair(
                WETH_ADDRESS, USDC_ADDRESS
            ).call()
            
            if pair_address == "0x0000000000000000000000000000000000000000":
                return None
            
            # Get reserves using same approach as SushiSwap
            pair_abi = [
                {
                    "inputs": [],
                    "name": "getReserves",
                    "outputs": [
                        {"internalType": "uint112", "name": "_reserve0", "type": "uint112"},
                        {"internalType": "uint112", "name": "_reserve1", "type": "uint112"},
                        {"internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "token0",
                    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            pair_contract = self.w3.eth.contract(
                address=pair_address,
                abi=pair_abi
            )
            
            reserves = pair_contract.functions.getReserves().call()
            token0 = pair_contract.functions.token0().call()
            
            if token0.lower() == WETH_ADDRESS.lower():
                weth_reserve = reserves[0]
                usdc_reserve = reserves[1]
            else:
                weth_reserve = reserves[1]
                usdc_reserve = reserves[0]
            
            if weth_reserve > 0:
                price = (usdc_reserve * 10**18) / (weth_reserve * 10**6)
                return price / (10**18)
                
        except Exception as e:
            logger.error(f"Camelot error: {e}")
        
        return None

    async def get_kyberswap_price(self, amount_in: int = 10**18) -> Optional[float]:
        """Get WETH price from KyberSwap"""
        try:
            # KyberSwap uses similar approach
            factory_address = DEXS["KyberSwap"]["factory"]
            
            factory_abi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "tokenA", "type": "address"},
                        {"internalType": "address", "name": "tokenB", "type": "address"}
                    ],
                    "name": "getPool",
                    "outputs": [{"internalType": "address", "name": "pool", "type": "address"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            factory_contract = self.w3.eth.contract(
                address=factory_address,
                abi=factory_abi
            )
            
            pool_address = factory_contract.functions.getPool(
                WETH_ADDRESS, USDC_ADDRESS
            ).call()
            
            if pool_address == "0x0000000000000000000000000000000000000000":
                return None
            
            # Get pool reserves
            pool_abi = [
                {
                    "inputs": [],
                    "name": "getReserves",
                    "outputs": [
                        {"internalType": "uint112", "name": "_reserve0", "type": "uint112"},
                        {"internalType": "uint112", "name": "_reserve1", "type": "uint112"},
                        {"internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "token0",
                    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            pool_contract = self.w3.eth.contract(
                address=pool_address,
                abi=pool_abi
            )
            
            reserves = pool_contract.functions.getReserves().call()
            token0 = pool_contract.functions.token0().call()
            
            if token0.lower() == WETH_ADDRESS.lower():
                weth_reserve = reserves[0]
                usdc_reserve = reserves[1]
            else:
                weth_reserve = reserves[1]
                usdc_reserve = reserves[0]
            
            if weth_reserve > 0:
                price = (usdc_reserve * 10**18) / (weth_reserve * 10**6)
                return price / (10**18)
                
        except Exception as e:
            logger.error(f"KyberSwap error: {e}")
        
        return None

    async def get_all_prices(self) -> Dict[str, Optional[float]]:
        """Get WETH prices from all DEXs"""
        tasks = [
            ("Uniswap V3", self.get_uniswap_v3_price()),
            ("SushiSwap", self.get_sushiswap_price()),
            ("Camelot", self.get_camelot_price()),
            ("KyberSwap", self.get_kyberswap_price())
        ]
        
        results = {}
        for dex_name, task in tasks:
            try:
                price = await task
                results[dex_name] = price
                if price:
                    logger.info(f"{dex_name}: ${price:.2f}")
                else:
                    logger.warning(f"{dex_name}: No price available")
            except Exception as e:
                logger.error(f"Error fetching {dex_name} price: {e}")
                results[dex_name] = None
        
        return results

    def calculate_arbitrage_opportunities(self, prices: Dict[str, Optional[float]]) -> List[Dict]:
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
                    diff_percent = abs(price1 - price2) / min(price1, price2) * 100
                    
                    if diff_percent >= 0.5:  # 0.5% minimum threshold
                        opportunity = {
                            "dex1": dex1,
                            "dex2": dex2,
                            "price1": price1,
                            "price2": price2,
                            "difference_percent": diff_percent,
                            "buy_from": dex1 if price1 < price2 else dex2,
                            "sell_to": dex2 if price1 < price2 else dex1,
                            "profit_percent": diff_percent
                        }
                        opportunities.append(opportunity)
        
        return sorted(opportunities, key=lambda x: x["difference_percent"], reverse=True)