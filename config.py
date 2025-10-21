import os
from dotenv import load_dotenv

load_dotenv()

# Alchemy configuration
ALCHEMY_URL = os.getenv('ALCHEMY_URL')
if not ALCHEMY_URL:
    raise ValueError("ALCHEMY_URL not found in environment variables")

# Telegram configuration
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
    raise ValueError("Telegram credentials not found in environment variables")

# WETH token address on Arbitrum
WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"

# DEX configurations
DEXS = {
    "Uniswap V3": {
        "router": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        "factory": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        "quoter": "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
    },
    "SushiSwap": {
        "router": "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        "factory": "0xc35DADB65012eC5796536bD9864eD8773aBc74C4"
    },
    "Camelot": {
        "router": "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
        "factory": "0x6EcCab422D763aC031210895C81787E87D43A2a8"
    },
    "KyberSwap": {
        "router": "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5",
        "factory": "0x5F1dddbf348bC2f9F8A2c416E23B4e8f5d4b3B4c"
    },
    "GMX": {
        "router": "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064"
    }
}

# USDC address for price comparison
USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"

# Monitoring interval (in seconds)
MONITORING_INTERVAL = 180  # 3 minutes

# Minimum price difference for arbitrage alert (in percentage)
MIN_ARBITRAGE_THRESHOLD = 0.5  # 0.5%