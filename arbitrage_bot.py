"""
Arbitrum Arbitrage Scanner Bot
Scans for real-time arbitrage opportunities on Arbitrum mainnet DEXs
Supports direct and triangular arbitrage in both directions
Sends Telegram alerts with accurate price data
"""

import asyncio
import time
from web3 import Web3
import requests
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Arbitrum RPC endpoints (using multiple for redundancy)
ARBITRUM_RPC_URLS = [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum-one.publicnode.com",
    "https://arbitrum.llamarpc.com"
]

# Telegram configuration
TELEGRAM_BOT_TOKEN = "7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU"
TELEGRAM_CHAT_ID = "8305086804"

# Token addresses on Arbitrum
TOKENS = {
    'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    'ARB': '0x912CE59144191C1204E64559FE8253a0e49E6548',
    'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'LINK': '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    'MAGIC': '0x539bdE0d7Dbd336b79148AA742883198BBF60342',
    'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    'DAI': '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
}

# DEX information on Arbitrum
DEXS = {
    'Uniswap_V3': {
        'factory': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        'router': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        'type': 'v3'
    },
    'Sushiswap': {
        'factory': '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
        'router': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        'type': 'v2'
    },
    'Camelot': {
        'factory': '0x6EcCab422D763aC031210895C81787E87B43A652',
        'router': '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
        'type': 'v2'
    },
    'Balancer': {
        'vault': '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        'type': 'balancer'
    }
}

# ERC20 ABI (minimal for balance and decimals)
ERC20_ABI = json.loads('''[
    {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"},
    {"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"type":"function"},
    {"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"}
]''')

# Uniswap V2 Pair ABI
UNISWAP_V2_PAIR_ABI = json.loads('''[
    {"constant":true,"inputs":[],"name":"getReserves","outputs":[{"name":"reserve0","type":"uint112"},{"name":"reserve1","type":"uint112"},{"name":"blockTimestampLast","type":"uint32"}],"type":"function"},
    {"constant":true,"inputs":[],"name":"token0","outputs":[{"name":"","type":"address"}],"type":"function"},
    {"constant":true,"inputs":[],"name":"token1","outputs":[{"name":"","type":"address"}],"type":"function"}
]''')

# Uniswap V2 Factory ABI
UNISWAP_V2_FACTORY_ABI = json.loads('''[
    {"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"getPair","outputs":[{"name":"","type":"address"}],"type":"function"}
]''')

# Uniswap V3 Factory ABI
UNISWAP_V3_FACTORY_ABI = json.loads('''[
    {"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint24","name":"","type":"uint24"}],"name":"getPool","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}
]''')

# Uniswap V3 Pool ABI
UNISWAP_V3_POOL_ABI = json.loads('''[
    {"inputs":[],"name":"slot0","outputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"internalType":"int24","name":"tick","type":"int24"},{"internalType":"uint16","name":"observationIndex","type":"uint16"},{"internalType":"uint16","name":"observationCardinality","type":"uint16"},{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"},{"internalType":"uint8","name":"feeProtocol","type":"uint8"},{"internalType":"bool","name":"unlocked","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"liquidity","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"}
]''')


class ArbitrageScanner:
    def __init__(self):
        self.w3 = self._connect_web3()
        self.token_decimals = {}
        self.last_alert_time = 0
        self.alert_interval = 180  # 3 minutes in seconds
        
    def _connect_web3(self) -> Web3:
        """Connect to Arbitrum mainnet with fallback RPC endpoints"""
        for rpc_url in ARBITRUM_RPC_URLS:
            try:
                w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 10}))
                if w3.is_connected():
                    logger.info(f"Connected to Arbitrum via {rpc_url}")
                    # Verify we're on Arbitrum (chain ID 42161)
                    chain_id = w3.eth.chain_id
                    if chain_id == 42161:
                        logger.info(f"Confirmed Arbitrum mainnet (Chain ID: {chain_id})")
                        return w3
                    else:
                        logger.warning(f"Wrong chain ID: {chain_id}, expected 42161")
            except Exception as e:
                logger.warning(f"Failed to connect to {rpc_url}: {e}")
                continue
        
        raise Exception("Could not connect to any Arbitrum RPC endpoint")
    
    def get_token_decimals(self, token_address: str) -> int:
        """Get token decimals with caching"""
        if token_address in self.token_decimals:
            return self.token_decimals[token_address]
        
        try:
            token_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(token_address),
                abi=ERC20_ABI
            )
            decimals = token_contract.functions.decimals().call()
            self.token_decimals[token_address] = decimals
            return decimals
        except Exception as e:
            logger.error(f"Error getting decimals for {token_address}: {e}")
            return 18  # Default to 18
    
    def get_uniswap_v2_price(self, dex_name: str, token_a: str, token_b: str) -> Optional[float]:
        """Get price from Uniswap V2 style DEX (Sushiswap, Camelot)"""
        try:
            dex_info = DEXS[dex_name]
            factory_address = Web3.to_checksum_address(dex_info['factory'])
            
            factory_contract = self.w3.eth.contract(
                address=factory_address,
                abi=UNISWAP_V2_FACTORY_ABI
            )
            
            token_a_addr = Web3.to_checksum_address(token_a)
            token_b_addr = Web3.to_checksum_address(token_b)
            
            pair_address = factory_contract.functions.getPair(token_a_addr, token_b_addr).call()
            
            if pair_address == '0x0000000000000000000000000000000000000000':
                return None
            
            pair_contract = self.w3.eth.contract(
                address=pair_address,
                abi=UNISWAP_V2_PAIR_ABI
            )
            
            reserves = pair_contract.functions.getReserves().call()
            token0 = pair_contract.functions.token0().call()
            
            # VALIDATION: Check reserves are not zero
            if reserves[0] == 0 or reserves[1] == 0:
                logger.debug(f"Zero reserves for {dex_name} {token_a}/{token_b}")
                return None
            
            decimals_a = self.get_token_decimals(token_a)
            decimals_b = self.get_token_decimals(token_b)
            
            if token0.lower() == token_a_addr.lower():
                reserve_a = reserves[0] / (10 ** decimals_a)
                reserve_b = reserves[1] / (10 ** decimals_b)
            else:
                reserve_a = reserves[1] / (10 ** decimals_a)
                reserve_b = reserves[0] / (10 ** decimals_b)
            
            # VALIDATION: Check reserves are reasonable
            if reserve_a <= 0 or reserve_b <= 0:
                return None
            
            # VALIDATION: Check minimum liquidity (avoid low-liquidity pools)
            if reserve_a < 0.01 or reserve_b < 0.01:
                logger.debug(f"Low liquidity for {dex_name} {token_a}/{token_b}")
                return None
            
            price = reserve_b / reserve_a
            
            # VALIDATION: Check price is reasonable (not infinity, not zero)
            if price <= 0 or price > 1e15:
                logger.warning(f"Unrealistic price from {dex_name}: {price}")
                return None
            
            return price
            
        except Exception as e:
            logger.debug(f"Error getting {dex_name} V2 price for {token_a}/{token_b}: {e}")
            return None
    
    def get_uniswap_v3_price(self, token_a: str, token_b: str, fee: int = 3000) -> Optional[float]:
        """Get price from Uniswap V3 pool"""
        try:
            factory_address = Web3.to_checksum_address(DEXS['Uniswap_V3']['factory'])
            
            factory_contract = self.w3.eth.contract(
                address=factory_address,
                abi=UNISWAP_V3_FACTORY_ABI
            )
            
            token_a_addr = Web3.to_checksum_address(token_a)
            token_b_addr = Web3.to_checksum_address(token_b)
            
            # Try different fee tiers
            fee_tiers = [3000, 500, 10000, 100] if fee == 3000 else [fee]
            
            for fee_tier in fee_tiers:
                try:
                    pool_address = factory_contract.functions.getPool(
                        token_a_addr, token_b_addr, fee_tier
                    ).call()
                    
                    if pool_address == '0x0000000000000000000000000000000000000000':
                        continue
                    
                    pool_contract = self.w3.eth.contract(
                        address=pool_address,
                        abi=UNISWAP_V3_POOL_ABI
                    )
                    
                    slot0 = pool_contract.functions.slot0().call()
                    sqrt_price_x96 = slot0[0]
                    
                    token0 = pool_contract.functions.token0().call()
                    
                    decimals_a = self.get_token_decimals(token_a)
                    decimals_b = self.get_token_decimals(token_b)
                    
                    # Calculate price from sqrtPriceX96
                    price_raw = (sqrt_price_x96 / (2 ** 96)) ** 2
                    
                    if token0.lower() == token_a_addr.lower():
                        price = price_raw * (10 ** decimals_a) / (10 ** decimals_b)
                    else:
                        price = (1 / price_raw) * (10 ** decimals_b) / (10 ** decimals_a)
                    
                    # Check liquidity to ensure pool is active
                    liquidity = pool_contract.functions.liquidity().call()
                    if liquidity > 1000:  # Minimum liquidity threshold
                        return price
                        
                except Exception as e:
                    logger.debug(f"Fee tier {fee_tier} failed: {e}")
                    continue
            
            return None
            
        except Exception as e:
            logger.debug(f"Error getting Uniswap V3 price for {token_a}/{token_b}: {e}")
            return None
    
    def get_all_prices(self, token_a_name: str, token_b_name: str) -> Dict[str, float]:
        """Get prices from all DEXs for a token pair"""
        token_a = TOKENS[token_a_name]
        token_b = TOKENS[token_b_name]
        
        prices = {}
        
        # Uniswap V3 - MOST RELIABLE
        price = self.get_uniswap_v3_price(token_a, token_b)
        if price and price > 0 and price < 1e15:
            prices['Uniswap_V3'] = price
        
        # Sushiswap - RELIABLE
        price = self.get_uniswap_v2_price('Sushiswap', token_a, token_b)
        if price and price > 0 and price < 1e15:
            prices['Sushiswap'] = price
        
        # Camelot - SKIP FOR NOW (bad data)
        # Only use Camelot for very specific safe pairs
        safe_camelot_pairs = [
            ('WETH', 'USDC'),
            ('WETH', 'USDT'),
            ('ARB', 'USDC'),
            ('ARB', 'USDT'),
        ]
        
        if (token_a_name, token_b_name) in safe_camelot_pairs or (token_b_name, token_a_name) in safe_camelot_pairs:
            price = self.get_uniswap_v2_price('Camelot', token_a, token_b)
            if price and price > 0 and price < 1e15:
                # Extra validation for Camelot
                if len(prices) > 0:
                    avg_price = sum(prices.values()) / len(prices)
                    # Only accept if within 30% of average
                    if abs(price - avg_price) / avg_price < 0.3:
                        prices['Camelot'] = price
        
        return prices
    
    def calculate_profit(self, spread_pct: float, trade_size: float = 50000) -> Dict:
        """
        Calculate estimated profit for a trade with all costs
        
        Args:
            spread_pct: Spread percentage
            trade_size: Trade size in USD (default $50k)
        
        Returns:
            Dict with profit breakdown
        """
        # Gross profit from spread
        gross_profit = trade_size * (spread_pct / 100)
        
        # Costs
        flash_loan_fee_pct = 0.09  # Aave flash loan fee 0.09%
        flash_loan_fee = trade_size * (flash_loan_fee_pct / 100)
        
        # Arbitrum gas costs (very cheap!)
        # Typical flash loan arb: ~500k gas at 0.1 gwei = $0.05-2
        estimated_gas = 1.50  # Conservative estimate for Arbitrum
        
        # Slippage (0.1% conservative)
        slippage_pct = 0.1
        slippage_cost = trade_size * (slippage_pct / 100)
        
        # Total costs
        total_costs = flash_loan_fee + estimated_gas + slippage_cost
        
        # Net profit
        net_profit = gross_profit - total_costs
        
        # ROI (on flash loan amount)
        roi_pct = (net_profit / trade_size) * 100
        
        return {
            'trade_size': trade_size,
            'gross_profit': gross_profit,
            'flash_loan_fee': flash_loan_fee,
            'gas_cost': estimated_gas,
            'slippage_cost': slippage_cost,
            'total_costs': total_costs,
            'net_profit': net_profit,
            'roi_pct': roi_pct
        }
    
    def validate_price_sanity(self, token_a_name: str, token_b_name: str, prices: Dict[str, float]) -> Dict[str, float]:
        """Validate prices are reasonable and filter out bad data"""
        if len(prices) < 2:
            return prices
        
        # Calculate median price
        price_values = list(prices.values())
        price_values.sort()
        median_price = price_values[len(price_values) // 2]
        
        # Filter out prices that are more than 50% away from median
        # This removes obviously wrong Camelot prices
        valid_prices = {}
        for dex, price in prices.items():
            deviation = abs(price - median_price) / median_price
            if deviation < 0.5:  # Within 50% of median
                valid_prices[dex] = price
            else:
                logger.warning(f"Filtering out bad price: {dex} {token_a_name}/{token_b_name} = {price} (median={median_price})")
        
        return valid_prices
    
    def find_direct_arbitrage(self, token_a_name: str, token_b_name: str) -> List[Dict]:
        """Find direct arbitrage opportunities for a token pair"""
        opportunities = []
        prices = self.get_all_prices(token_a_name, token_b_name)
        
        if len(prices) < 2:
            return opportunities
        
        # VALIDATION: Filter out unrealistic prices
        prices = self.validate_price_sanity(token_a_name, token_b_name, prices)
        
        if len(prices) < 2:
            return opportunities
        
        # Find best buy and sell prices
        dex_list = list(prices.items())
        
        for i in range(len(dex_list)):
            for j in range(i + 1, len(dex_list)):
                dex1, price1 = dex_list[i]
                dex2, price2 = dex_list[j]
                
                # VALIDATION: Check for zero or negative prices
                if price1 <= 0 or price2 <= 0:
                    continue
                
                # VALIDATION: Check price ratio is reasonable (within 20x)
                price_ratio = max(price1, price2) / min(price1, price2)
                if price_ratio > 20:  # Prices shouldn't differ by more than 20x
                    logger.warning(f"Skipping unrealistic price ratio: {price_ratio:.2f}x for {token_a_name}/{token_b_name}")
                    continue
                
                # Calculate spread percentage
                if price1 < price2:
                    buy_dex, buy_price = dex1, price1
                    sell_dex, sell_price = dex2, price2
                else:
                    buy_dex, buy_price = dex2, price2
                    sell_dex, sell_price = dex1, price1
                
                spread_pct = ((sell_price - buy_price) / buy_price) * 100
                
                # VALIDATION: Realistic spread range (0.3% to 20%)
                if spread_pct > 0.3 and spread_pct < 20:
                    # Calculate profit for $50k trade
                    profit_calc = self.calculate_profit(spread_pct, 50000)
                    
                    opportunities.append({
                        'type': 'direct',
                        'pair': f"{token_a_name}/{token_b_name}",
                        'buy_dex': buy_dex,
                        'sell_dex': sell_dex,
                        'buy_price': buy_price,
                        'sell_price': sell_price,
                        'spread_pct': spread_pct,
                        'profit': profit_calc,
                        'timestamp': datetime.now().isoformat()
                    })
        
        return opportunities
    
    def find_triangular_arbitrage(self, token_a: str, token_b: str, token_c: str) -> List[Dict]:
        """Find triangular arbitrage opportunities in both directions"""
        opportunities = []
        
        # Get prices for all three pairs on each DEX
        for dex_name in ['Uniswap_V3', 'Sushiswap', 'Camelot']:
            try:
                token_a_addr = TOKENS[token_a]
                token_b_addr = TOKENS[token_b]
                token_c_addr = TOKENS[token_c]
                
                # Get prices
                if dex_name == 'Uniswap_V3':
                    price_ab = self.get_uniswap_v3_price(token_a_addr, token_b_addr)
                    price_bc = self.get_uniswap_v3_price(token_b_addr, token_c_addr)
                    price_ca = self.get_uniswap_v3_price(token_c_addr, token_a_addr)
                else:
                    price_ab = self.get_uniswap_v2_price(dex_name, token_a_addr, token_b_addr)
                    price_bc = self.get_uniswap_v2_price(dex_name, token_b_addr, token_c_addr)
                    price_ca = self.get_uniswap_v2_price(dex_name, token_c_addr, token_a_addr)
                
                if not all([price_ab, price_bc, price_ca]):
                    continue
                
                # Direction 1: A -> B -> C -> A
                final_amount_1 = 1.0 * price_ab * price_bc * price_ca
                profit_pct_1 = (final_amount_1 - 1.0) * 100
                
                # VALIDATION: Filter out unrealistic profits (calculation errors)
                # Real triangular arbitrage is typically 0.5% to 5%
                if profit_pct_1 > 0.5 and profit_pct_1 < 5:  # Realistic range
                    # Calculate profit for $50k trade
                    profit_calc = self.calculate_profit(profit_pct_1, 50000)
                    
                    opportunities.append({
                        'type': 'triangular',
                        'direction': 'forward',
                        'dex': dex_name,
                        'path': f"{token_a} → {token_b} → {token_c} → {token_a}",
                        'prices': {
                            f"{token_a}/{token_b}": price_ab,
                            f"{token_b}/{token_c}": price_bc,
                            f"{token_c}/{token_a}": price_ca
                        },
                        'profit_pct': profit_pct_1,
                        'profit': profit_calc,
                        'timestamp': datetime.now().isoformat()
                    })
                
                # Direction 2: A -> C -> B -> A (REVERSE)
                price_ac = 1 / price_ca if price_ca else None
                price_cb = 1 / price_bc if price_bc else None
                price_ba = 1 / price_ab if price_ab else None
                
                if all([price_ac, price_cb, price_ba]):
                    final_amount_2 = 1.0 * price_ac * price_cb * price_ba
                    profit_pct_2 = (final_amount_2 - 1.0) * 100
                    
                    # VALIDATION: Filter out unrealistic profits (calculation errors)
                    # Real triangular arbitrage is typically 0.5% to 5%
                    if profit_pct_2 > 0.5 and profit_pct_2 < 5:  # Realistic range
                        # Calculate profit for $50k trade
                        profit_calc = self.calculate_profit(profit_pct_2, 50000)
                        
                        opportunities.append({
                            'type': 'triangular',
                            'direction': 'reverse',
                            'dex': dex_name,
                            'path': f"{token_a} → {token_c} → {token_b} → {token_a}",
                            'prices': {
                                f"{token_a}/{token_c}": price_ac,
                                f"{token_c}/{token_b}": price_cb,
                                f"{token_b}/{token_a}": price_ba
                            },
                            'profit_pct': profit_pct_2,
                            'profit': profit_calc,
                            'timestamp': datetime.now().isoformat()
                        })
                
            except Exception as e:
                logger.debug(f"Error in triangular arbitrage on {dex_name}: {e}")
                continue
        
        return opportunities
    
    def send_telegram_message(self, message: str):
        """Send message to Telegram"""
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            data = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML"
            }
            response = requests.post(url, data=data, timeout=10)
            if response.status_code == 200:
                logger.info("Telegram alert sent successfully")
            else:
                logger.error(f"Failed to send Telegram message: {response.text}")
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")
    
    def format_opportunity_message(self, opportunities: List[Dict]) -> str:
        """Format arbitrage opportunities for Telegram with profit details"""
        if not opportunities:
            return None
        
        # Sort all by net profit and take top 3
        top_opps = sorted(opportunities, key=lambda x: x['profit']['net_profit'], reverse=True)[:3]
        
        message = f"🚨 <b>TOP ARBITRAGE OPPORTUNITIES</b> 🚨\n"
        message += f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
        message += f"🔗 Arbitrum Mainnet\n"
        message += f"💵 Flash Loan: <b>$50,000</b>\n\n"
        
        for idx, opp in enumerate(top_opps, 1):
            profit = opp['profit']
            
            if opp['type'] == 'direct':
                message += f"<b>#{idx} DIRECT - {opp['pair']}</b>\n"
                message += f"📈 Buy:  {opp['buy_dex']} @ ${opp['buy_price']:.6f}\n"
                message += f"📉 Sell: {opp['sell_dex']} @ ${opp['sell_price']:.6f}\n"
                message += f"📊 Spread: <b>{opp['spread_pct']:.3f}%</b>\n"
            else:
                message += f"<b>#{idx} TRIANGULAR</b>\n"
                message += f"🔄 {opp['path']}\n"
                message += f"🏦 DEX: {opp['dex']}\n"
                message += f"📊 Profit: <b>{opp['profit_pct']:.3f}%</b>\n"
            
            message += f"\n💰 <b>PROFIT ($50k flash loan):</b>\n"
            message += f"  Gross:     ${profit['gross_profit']:>8,.2f}\n"
            message += f"  Costs:     -${profit['total_costs']:>7,.2f}\n"
            message += f"  <b>NET:       ${profit['net_profit']:>8,.2f}</b>\n"
            message += f"  <b>ROI:       {profit['roi_pct']:>7.2f}%</b>\n\n"
        
        # Summary
        total_net_profit = sum(opp['profit']['net_profit'] for opp in opportunities)
        message += f"━━━━━━━━━━━━━━━━━━━\n"
        message += f"📊 Total Found: <b>{len(opportunities)}</b>\n"
        message += f"💰 Combined Profit: <b>${total_net_profit:,.2f}</b>\n"
        message += f"⚡ Flash Loan: Aave/Balancer ready\n"
        
        return message
    
    def scan_for_opportunities(self):
        """Main scanning function"""
        logger.info("Starting arbitrage scan...")
        
        all_opportunities = []
        
        # Major trading pairs for direct arbitrage (SAFE PAIRS ONLY)
        # Removed risky pairs that show fake opportunities
        pairs = [
            # WETH pairs (most liquid) - ONLY USE UNISWAP V3 AND SUSHISWAP
            ('WETH', 'USDC'),
            ('WETH', 'ARB'),
            ('WETH', 'USDT'),
            
            # ARB pairs - SAFE
            ('ARB', 'USDC'),
            ('ARB', 'USDT'),
            
            # Stablecoin pairs - SAFE  
            ('USDC', 'USDT'),
            ('USDC', 'DAI'),
            
            # Note: LINK and MAGIC removed from direct arbitrage
            # Camelot has bad data for these pairs
        ]
        
        # Scan direct arbitrage
        for token_a, token_b in pairs:
            try:
                opps = self.find_direct_arbitrage(token_a, token_b)
                all_opportunities.extend(opps)
                if opps:
                    logger.info(f"Scanned {token_a}/{token_b}: {len(opps)} opportunities (Best: ${opps[0]['profit']['net_profit']:.2f})")
                else:
                    logger.debug(f"Scanned {token_a}/{token_b}: 0 opportunities")
            except Exception as e:
                logger.debug(f"Error scanning {token_a}/{token_b}: {e}")
        
        # Triangular arbitrage paths (both directions tested)
        triangular_paths = [
            # WETH base triangles
            ('WETH', 'USDC', 'ARB'),
            ('WETH', 'USDC', 'LINK'),
            ('WETH', 'USDC', 'MAGIC'),
            ('WETH', 'ARB', 'USDT'),
            ('WETH', 'ARB', 'USDC'),
            ('WETH', 'LINK', 'USDC'),
            ('WETH', 'MAGIC', 'USDC'),
            
            # ARB base triangles
            ('ARB', 'USDC', 'USDT'),
            ('ARB', 'USDC', 'DAI'),
            ('ARB', 'WETH', 'USDC'),
            
            # Stablecoin triangles
            ('USDC', 'USDT', 'DAI'),
            ('USDC', 'WETH', 'ARB'),
        ]
        
        # Scan triangular arbitrage (both directions)
        for token_a, token_b, token_c in triangular_paths:
            try:
                opps = self.find_triangular_arbitrage(token_a, token_b, token_c)
                all_opportunities.extend(opps)
                if opps:
                    best_profit = max(opp['profit']['net_profit'] for opp in opps)
                    logger.info(f"Scanned triangular {token_a}-{token_b}-{token_c}: {len(opps)} opportunities (Best: ${best_profit:.2f})")
                else:
                    logger.debug(f"Scanned triangular {token_a}-{token_b}-{token_c}: 0 opportunities")
            except Exception as e:
                logger.debug(f"Error in triangular scan {token_a}-{token_b}-{token_c}: {e}")
        
        # Filter only profitable opportunities (net profit > $10)
        profitable_opps = [opp for opp in all_opportunities if opp['profit']['net_profit'] > 10]
        
        # Send Telegram alert if interval has passed
        current_time = time.time()
        if profitable_opps and (current_time - self.last_alert_time) >= self.alert_interval:
            message = self.format_opportunity_message(profitable_opps)
            if message:
                self.send_telegram_message(message)
                self.last_alert_time = current_time
                total_profit = sum(opp['profit']['net_profit'] for opp in profitable_opps)
                logger.info(f"Found {len(profitable_opps)} profitable opportunities (Total: ${total_profit:,.2f}), alert sent")
        elif profitable_opps:
            total_profit = sum(opp['profit']['net_profit'] for opp in profitable_opps)
            logger.info(f"Found {len(profitable_opps)} opportunities (Total: ${total_profit:,.2f}), waiting for alert interval")
        else:
            logger.info("No profitable opportunities found this scan (net profit > $10)")
        
        return profitable_opps
    
    def run_continuous(self, scan_interval: int = 10):
        """Run continuous scanning"""
        logger.info("Starting continuous arbitrage scanner...")
        logger.info(f"Scan interval: {scan_interval} seconds")
        logger.info(f"Alert interval: {self.alert_interval} seconds (every 3 minutes)")
        
        # Send startup message
        startup_msg = (
            "🤖 <b>Arbitrage Bot Started</b>\n\n"
            "🔗 Network: Arbitrum Mainnet\n"
            "📊 Scanning DEXs: Uniswap V3, Sushiswap, Camelot\n"
            "💎 Tokens: WETH, ARB, USDC, LINK, MAGIC, USDT, DAI\n"
            "🔍 Modes: Direct + Triangular Arbitrage (Both Directions)\n"
            "💵 Flash Loan Size: $50,000 per trade\n"
            "⚡ Flash Loan Providers: Aave V3, Balancer V2\n\n"
            "💰 <b>PROFIT CALCULATION:</b>\n"
            "   • Flash Loan Fee: 0.09% (Aave)\n"
            "   • Gas Cost: ~$1.50 (Arbitrum)\n"
            "   • Slippage: 0.1% (conservative)\n"
            "   • Shows NET profit after all costs\n\n"
            f"⏰ Scan Interval: {scan_interval}s\n"
            f"📨 Alert Interval: {self.alert_interval}s (3 min)\n"
            "📈 Min Net Profit: $10 per trade\n\n"
            "✅ Bot is now monitoring for profitable spreads..."
        )
        self.send_telegram_message(startup_msg)
        
        while True:
            try:
                self.scan_for_opportunities()
                logger.info(f"Waiting {scan_interval} seconds until next scan...")
                time.sleep(scan_interval)
            except KeyboardInterrupt:
                logger.info("Bot stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(scan_interval)


def main():
    """Main entry point"""
    logger.info("="*60)
    logger.info("Arbitrum Arbitrage Scanner Bot")
    logger.info("="*60)
    
    scanner = ArbitrageScanner()
    scanner.run_continuous(scan_interval=10)


if __name__ == "__main__":
    main()
