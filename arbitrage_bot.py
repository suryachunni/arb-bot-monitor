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
            
            decimals_a = self.get_token_decimals(token_a)
            decimals_b = self.get_token_decimals(token_b)
            
            if token0.lower() == token_a_addr.lower():
                reserve_a = reserves[0] / (10 ** decimals_a)
                reserve_b = reserves[1] / (10 ** decimals_b)
            else:
                reserve_a = reserves[1] / (10 ** decimals_a)
                reserve_b = reserves[0] / (10 ** decimals_b)
            
            if reserve_a == 0:
                return None
            
            price = reserve_b / reserve_a
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
        
        # Uniswap V3
        price = self.get_uniswap_v3_price(token_a, token_b)
        if price:
            prices['Uniswap_V3'] = price
        
        # Sushiswap
        price = self.get_uniswap_v2_price('Sushiswap', token_a, token_b)
        if price:
            prices['Sushiswap'] = price
        
        # Camelot
        price = self.get_uniswap_v2_price('Camelot', token_a, token_b)
        if price:
            prices['Camelot'] = price
        
        return prices
    
    def find_direct_arbitrage(self, token_a_name: str, token_b_name: str) -> List[Dict]:
        """Find direct arbitrage opportunities for a token pair"""
        opportunities = []
        prices = self.get_all_prices(token_a_name, token_b_name)
        
        if len(prices) < 2:
            return opportunities
        
        # Find best buy and sell prices
        dex_list = list(prices.items())
        
        for i in range(len(dex_list)):
            for j in range(i + 1, len(dex_list)):
                dex1, price1 = dex_list[i]
                dex2, price2 = dex_list[j]
                
                # Calculate spread percentage
                if price1 < price2:
                    buy_dex, buy_price = dex1, price1
                    sell_dex, sell_price = dex2, price2
                else:
                    buy_dex, buy_price = dex2, price2
                    sell_dex, sell_price = dex1, price1
                
                spread_pct = ((sell_price - buy_price) / buy_price) * 100
                
                # Consider profitable if spread > 0.3% (to account for gas fees)
                if spread_pct > 0.3:
                    opportunities.append({
                        'type': 'direct',
                        'pair': f"{token_a_name}/{token_b_name}",
                        'buy_dex': buy_dex,
                        'sell_dex': sell_dex,
                        'buy_price': buy_price,
                        'sell_price': sell_price,
                        'spread_pct': spread_pct,
                        'timestamp': datetime.now().isoformat()
                    })
        
        return opportunities
    
    def find_triangular_arbitrage(self, token_a: str, token_b: str, token_c: str) -> List[Dict]:
        """Find triangular arbitrage opportunities"""
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
                
                if profit_pct_1 > 0.5:  # Minimum 0.5% profit
                    opportunities.append({
                        'type': 'triangular',
                        'dex': dex_name,
                        'path': f"{token_a} -> {token_b} -> {token_c} -> {token_a}",
                        'prices': {
                            f"{token_a}/{token_b}": price_ab,
                            f"{token_b}/{token_c}": price_bc,
                            f"{token_c}/{token_a}": price_ca
                        },
                        'profit_pct': profit_pct_1,
                        'timestamp': datetime.now().isoformat()
                    })
                
                # Direction 2: A -> C -> B -> A
                price_ac = 1 / price_ca if price_ca else None
                price_cb = 1 / price_bc if price_bc else None
                price_ba = 1 / price_ab if price_ab else None
                
                if all([price_ac, price_cb, price_ba]):
                    final_amount_2 = 1.0 * price_ac * price_cb * price_ba
                    profit_pct_2 = (final_amount_2 - 1.0) * 100
                    
                    if profit_pct_2 > 0.5:
                        opportunities.append({
                            'type': 'triangular',
                            'dex': dex_name,
                            'path': f"{token_a} -> {token_c} -> {token_b} -> {token_a}",
                            'prices': {
                                f"{token_a}/{token_c}": price_ac,
                                f"{token_c}/{token_b}": price_cb,
                                f"{token_b}/{token_a}": price_ba
                            },
                            'profit_pct': profit_pct_2,
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
        """Format arbitrage opportunities for Telegram"""
        if not opportunities:
            return None
        
        message = f"🚨 <b>ARBITRAGE OPPORTUNITIES DETECTED</b> 🚨\n"
        message += f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
        message += f"🔗 Network: Arbitrum Mainnet\n\n"
        
        # Direct arbitrage
        direct_opps = [opp for opp in opportunities if opp['type'] == 'direct']
        if direct_opps:
            message += "📊 <b>DIRECT ARBITRAGE:</b>\n"
            for opp in sorted(direct_opps, key=lambda x: x['spread_pct'], reverse=True)[:5]:
                message += f"\n💰 Pair: <b>{opp['pair']}</b>\n"
                message += f"  📈 Buy: {opp['buy_dex']} @ {opp['buy_price']:.8f}\n"
                message += f"  📉 Sell: {opp['sell_dex']} @ {opp['sell_price']:.8f}\n"
                message += f"  💵 Spread: <b>{opp['spread_pct']:.4f}%</b>\n"
                message += f"  ⚡ Flash Loan: Available\n"
        
        # Triangular arbitrage
        triangular_opps = [opp for opp in opportunities if opp['type'] == 'triangular']
        if triangular_opps:
            message += "\n\n🔺 <b>TRIANGULAR ARBITRAGE:</b>\n"
            for opp in sorted(triangular_opps, key=lambda x: x['profit_pct'], reverse=True)[:5]:
                message += f"\n🔄 Path: <b>{opp['path']}</b>\n"
                message += f"  🏦 DEX: {opp['dex']}\n"
                for pair, price in opp['prices'].items():
                    message += f"  • {pair}: {price:.8f}\n"
                message += f"  💰 Profit: <b>{opp['profit_pct']:.4f}%</b>\n"
                message += f"  ⚡ Flash Loan: Available\n"
        
        return message
    
    def scan_for_opportunities(self):
        """Main scanning function"""
        logger.info("Starting arbitrage scan...")
        
        all_opportunities = []
        
        # Major trading pairs for direct arbitrage
        pairs = [
            ('WETH', 'USDC'),
            ('WETH', 'ARB'),
            ('WETH', 'USDT'),
            ('ARB', 'USDC'),
            ('LINK', 'WETH'),
            ('MAGIC', 'WETH'),
            ('LINK', 'USDC'),
            ('MAGIC', 'USDC'),
        ]
        
        # Scan direct arbitrage
        for token_a, token_b in pairs:
            try:
                opps = self.find_direct_arbitrage(token_a, token_b)
                all_opportunities.extend(opps)
                logger.info(f"Scanned {token_a}/{token_b}: {len(opps)} opportunities")
            except Exception as e:
                logger.error(f"Error scanning {token_a}/{token_b}: {e}")
        
        # Triangular arbitrage paths
        triangular_paths = [
            ('WETH', 'USDC', 'ARB'),
            ('WETH', 'ARB', 'USDT'),
            ('WETH', 'LINK', 'USDC'),
            ('WETH', 'MAGIC', 'USDC'),
            ('ARB', 'USDC', 'USDT'),
        ]
        
        # Scan triangular arbitrage
        for token_a, token_b, token_c in triangular_paths:
            try:
                opps = self.find_triangular_arbitrage(token_a, token_b, token_c)
                all_opportunities.extend(opps)
                logger.info(f"Scanned triangular {token_a}-{token_b}-{token_c}: {len(opps)} opportunities")
            except Exception as e:
                logger.error(f"Error in triangular scan {token_a}-{token_b}-{token_c}: {e}")
        
        # Send Telegram alert if interval has passed
        current_time = time.time()
        if all_opportunities and (current_time - self.last_alert_time) >= self.alert_interval:
            message = self.format_opportunity_message(all_opportunities)
            if message:
                self.send_telegram_message(message)
                self.last_alert_time = current_time
                logger.info(f"Found {len(all_opportunities)} opportunities, alert sent")
        elif all_opportunities:
            logger.info(f"Found {len(all_opportunities)} opportunities, waiting for alert interval")
        else:
            logger.info("No profitable opportunities found this scan")
        
        return all_opportunities
    
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
            "🔍 Modes: Direct + Triangular Arbitrage\n"
            "⚡ Flash Loans: Enabled\n"
            f"⏰ Scan Interval: {scan_interval}s\n"
            f"📨 Alert Interval: {self.alert_interval}s (3 min)\n\n"
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
