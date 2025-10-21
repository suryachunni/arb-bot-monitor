#!/usr/bin/env python3
"""
WETH Price Monitor for Arbitrum DEXs
Fetches real-time WETH prices from multiple DEXs and alerts via Telegram
"""

import os
import time
import asyncio
from datetime import datetime
from web3 import Web3
from dotenv import load_dotenv
import requests
from typing import Dict, List, Tuple

# Load environment variables
load_dotenv()

# Configuration
ALCHEMY_RPC_URL = os.getenv('ALCHEMY_RPC_URL')
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')
INTERVAL_SECONDS = int(os.getenv('INTERVAL_SECONDS', 180))

# Initialize Web3
w3 = Web3(Web3.HTTPProvider(ALCHEMY_RPC_URL))

# Token addresses on Arbitrum
WETH_ADDRESS = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'  # Native USDC
USDT_ADDRESS = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'

# Uniswap V3 Quoter on Arbitrum
UNISWAP_V3_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'
UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

# SushiSwap Router on Arbitrum
SUSHISWAP_ROUTER = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'

# Camelot Router on Arbitrum
CAMELOT_ROUTER = '0xc873fEcbd354f5A56E00E710B90EF4201db2448d'

# Balancer Vault on Arbitrum
BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'

# ABI for Uniswap V3 Quoter (quoteExactInputSingle)
UNISWAP_V3_QUOTER_ABI = [
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

# ABI for SushiSwap/Camelot Router (getAmountsOut)
ROUTER_ABI = [
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


def send_telegram_message(message: str):
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
            print("✅ Telegram message sent successfully")
        else:
            print(f"❌ Failed to send Telegram: {response.text}")
    except Exception as e:
        print(f"❌ Telegram error: {e}")


def get_uniswap_v3_price(token_in: str, token_out: str, amount_in: int, fee: int = 500) -> float:
    """Get price from Uniswap V3"""
    try:
        quoter = w3.eth.contract(address=UNISWAP_V3_QUOTER, abi=UNISWAP_V3_QUOTER_ABI)
        amount_out = quoter.functions.quoteExactInputSingle(
            token_in,
            token_out,
            fee,
            amount_in,
            0
        ).call()
        return amount_out / 1e6  # USDC has 6 decimals
    except Exception as e:
        print(f"⚠️  Uniswap V3 (fee {fee}) error: {e}")
        return None


def get_sushiswap_price(token_in: str, token_out: str, amount_in: int) -> float:
    """Get price from SushiSwap"""
    try:
        router = w3.eth.contract(address=SUSHISWAP_ROUTER, abi=ROUTER_ABI)
        amounts = router.functions.getAmountsOut(
            amount_in,
            [token_in, token_out]
        ).call()
        return amounts[1] / 1e6  # USDC has 6 decimals
    except Exception as e:
        print(f"⚠️  SushiSwap error: {e}")
        return None


def get_camelot_price(token_in: str, token_out: str, amount_in: int) -> float:
    """Get price from Camelot - tries USDC first, then USDT"""
    # Try USDC first
    try:
        router = w3.eth.contract(address=CAMELOT_ROUTER, abi=ROUTER_ABI)
        amounts = router.functions.getAmountsOut(
            amount_in,
            [token_in, token_out]
        ).call()
        price = amounts[1] / 1e6  # USDC has 6 decimals
        
        # Validate price is reasonable (WETH should be between $500 and $10,000)
        if 500 <= price <= 10000:
            return price
        else:
            print(f"⚠️  Camelot USDC price out of range: ${price:,.2f} - trying USDT")
    except Exception as e:
        print(f"⚠️  Camelot USDC error: {e} - trying USDT")
    
    # Try USDT as fallback
    try:
        router = w3.eth.contract(address=CAMELOT_ROUTER, abi=ROUTER_ABI)
        amounts = router.functions.getAmountsOut(
            amount_in,
            [token_in, USDT_ADDRESS]
        ).call()
        price = amounts[1] / 1e6  # USDT has 6 decimals
        
        # Validate price
        if 500 <= price <= 10000:
            return price
        else:
            print(f"⚠️  Camelot USDT price out of range: ${price:,.2f}")
            return None
    except Exception as e:
        print(f"⚠️  Camelot USDT error: {e}")
        return None


def get_reference_eth_price() -> float:
    """Get reference ETH price from CoinGecko API"""
    try:
        url = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            price = data.get('ethereum', {}).get('usd')
            if price:
                print(f"📍 Reference Price (CoinGecko): ${price:,.2f}")
                return price
    except Exception as e:
        print(f"⚠️  CoinGecko API error: {e}")
    return None


def validate_price(price: float, dex_name: str, reference_price: float = None) -> bool:
    """Validate that a price is reasonable for WETH"""
    if price is None:
        return False
    
    # Basic sanity check: WETH price should be between $500 and $10,000
    if not (500 <= price <= 10000):
        print(f"⚠️  {dex_name} price ${price:,.2f} failed basic validation (expected $500-$10,000)")
        return False
    
    # If we have a reference price, check deviation isn't too extreme
    if reference_price:
        deviation = abs(price - reference_price) / reference_price * 100
        if deviation > 10:  # More than 10% deviation from reference
            print(f"⚠️  {dex_name} price ${price:,.2f} deviates {deviation:.1f}% from reference ${reference_price:,.2f}")
            return False
    
    return True


def fetch_all_weth_prices() -> Dict[str, float]:
    """Fetch WETH prices from all DEXs with validation"""
    print(f"\n{'='*60}")
    print(f"🔍 Fetching WETH prices at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    
    # Get reference price for validation
    reference_price = get_reference_eth_price()
    
    amount_in = Web3.to_wei(1, 'ether')  # 1 WETH
    prices = {}
    
    # Uniswap V3 - Multiple fee tiers (most reliable)
    for fee in [500, 3000, 10000]:  # 0.05%, 0.3%, 1%
        price = get_uniswap_v3_price(WETH_ADDRESS, USDC_ADDRESS, amount_in, fee)
        if price and validate_price(price, f'Uniswap V3 ({fee/10000}%)', reference_price):
            prices[f'Uniswap V3 ({fee/10000}%)'] = price
            print(f"📊 Uniswap V3 ({fee/10000}%): ${price:,.2f}")
    
    # SushiSwap
    price = get_sushiswap_price(WETH_ADDRESS, USDC_ADDRESS, amount_in)
    if price and validate_price(price, 'SushiSwap', reference_price):
        prices['SushiSwap'] = price
        print(f"📊 SushiSwap: ${price:,.2f}")
    
    # Camelot (with fallback to USDT)
    price = get_camelot_price(WETH_ADDRESS, USDC_ADDRESS, amount_in)
    if price and validate_price(price, 'Camelot', reference_price):
        prices['Camelot'] = price
        print(f"📊 Camelot: ${price:,.2f}")
    
    return prices


def calculate_arbitrage_opportunities(prices: Dict[str, float]) -> List[Tuple[str, str, float, float]]:
    """Calculate arbitrage spreads between DEXs"""
    if len(prices) < 2:
        return []
    
    opportunities = []
    dex_list = list(prices.items())
    
    for i in range(len(dex_list)):
        for j in range(i + 1, len(dex_list)):
            dex1, price1 = dex_list[i]
            dex2, price2 = dex_list[j]
            
            if price1 > price2:
                spread = ((price1 - price2) / price2) * 100
                opportunities.append((dex1, dex2, price1, price2, spread))
            else:
                spread = ((price2 - price1) / price1) * 100
                opportunities.append((dex2, dex1, price2, price1, spread))
    
    # Sort by spread (highest first)
    opportunities.sort(key=lambda x: x[4], reverse=True)
    return opportunities


def format_telegram_message(prices: Dict[str, float], opportunities: List[Tuple]) -> str:
    """Format message for Telegram"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    message = f"🚨 <b>WETH Price Alert - Arbitrum</b> 🚨\n"
    message += f"⏰ {timestamp} UTC\n"
    message += f"{'='*35}\n\n"
    
    if not prices:
        message += "❌ No valid prices available\n"
        return message
    
    # Price listing
    message += "<b>💰 WETH Prices (Validated):</b>\n"
    for dex, price in sorted(prices.items(), key=lambda x: x[1], reverse=True):
        message += f"  • {dex}: ${price:,.2f}\n"
    
    # Calculate statistics
    avg_price = sum(prices.values()) / len(prices)
    min_price = min(prices.values())
    max_price = max(prices.values())
    price_range_pct = ((max_price - min_price) / min_price * 100)
    
    message += f"\n<b>📈 Market Statistics:</b>\n"
    message += f"  • Average: ${avg_price:,.2f}\n"
    message += f"  • Highest: ${max_price:,.2f}\n"
    message += f"  • Lowest: ${min_price:,.2f}\n"
    message += f"  • Spread: ${max_price - min_price:,.2f} ({price_range_pct:.2f}%)\n"
    
    # Arbitrage opportunities (only show if spread > 0.1%)
    profitable_opps = [opp for opp in opportunities if opp[4] > 0.1]
    
    if profitable_opps:
        message += f"\n<b>⚡ Arbitrage Opportunities:</b>\n"
        for i, (buy_dex, sell_dex, sell_price, buy_price, spread) in enumerate(profitable_opps[:3], 1):
            # Add warning emoji for very high spreads (might indicate low liquidity)
            warning = " ⚠️ High spread!" if spread > 3 else ""
            profit_per_weth = sell_price - buy_price
            message += f"\n<b>#{i} - {spread:.3f}% Spread</b>{warning}\n"
            message += f"  📥 Buy: {buy_dex}\n"
            message += f"     Price: ${buy_price:,.2f}\n"
            message += f"  📤 Sell: {sell_dex}\n"
            message += f"     Price: ${sell_price:,.2f}\n"
            message += f"  💰 Profit: <b>${profit_per_weth:,.2f}</b> per WETH\n"
    else:
        message += f"\n<b>⚡ Arbitrage Status:</b>\n"
        message += f"  ✅ No significant spreads found\n"
        message += f"  📊 Market prices are aligned (${price_range_pct:.2f}% max spread)\n"
    
    message += f"\n{'='*35}\n"
    message += f"✅ All prices validated\n"
    message += f"🔄 Next update in 3 minutes"
    
    return message


def main():
    """Main monitoring loop"""
    print("🚀 Starting WETH Price Monitor for Arbitrum")
    print(f"⏱️  Monitoring interval: {INTERVAL_SECONDS} seconds")
    print(f"📡 RPC: {ALCHEMY_RPC_URL[:50]}...")
    print(f"💬 Telegram Chat ID: {TELEGRAM_CHAT_ID}")
    
    # Check Web3 connection
    if not w3.is_connected():
        print("❌ Failed to connect to Arbitrum RPC")
        send_telegram_message("❌ WETH Monitor: Failed to connect to Arbitrum RPC")
        return
    
    print(f"✅ Connected to Arbitrum (Chain ID: {w3.eth.chain_id})")
    
    # Send startup message
    send_telegram_message(
        f"✅ <b>WETH Monitor Started</b>\n"
        f"Network: Arbitrum Mainnet\n"
        f"Interval: Every {INTERVAL_SECONDS//60} minutes\n"
        f"Monitoring: Uniswap V3, SushiSwap, Camelot"
    )
    
    iteration = 0
    while True:
        try:
            iteration += 1
            print(f"\n{'#'*60}")
            print(f"Iteration #{iteration}")
            print(f"{'#'*60}")
            
            # Fetch prices
            prices = fetch_all_weth_prices()
            
            # Calculate arbitrage
            opportunities = calculate_arbitrage_opportunities(prices)
            
            # Display opportunities
            if opportunities:
                print(f"\n⚡ Top Arbitrage Spread: {opportunities[0][4]:.3f}%")
                print(f"   Buy on {opportunities[0][1]} @ ${opportunities[0][3]:,.2f}")
                print(f"   Sell on {opportunities[0][0]} @ ${opportunities[0][2]:,.2f}")
            
            # Send to Telegram
            message = format_telegram_message(prices, opportunities)
            send_telegram_message(message)
            
            # Wait for next iteration
            print(f"\n⏳ Waiting {INTERVAL_SECONDS} seconds until next check...")
            time.sleep(INTERVAL_SECONDS)
            
        except KeyboardInterrupt:
            print("\n\n👋 Shutting down gracefully...")
            send_telegram_message("⚠️ WETH Monitor stopped by user")
            break
        except Exception as e:
            print(f"\n❌ Error in main loop: {e}")
            send_telegram_message(f"❌ WETH Monitor error: {str(e)[:200]}")
            time.sleep(30)  # Wait 30 seconds before retry


if __name__ == "__main__":
    main()
