import os
import json
import time
import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import requests
from tenacity import retry, stop_after_attempt, wait_fixed
from web3 import Web3
from web3.contract import Contract

# ---- Constants (Arbitrum addresses) ----
WETH = Web3.to_checksum_address("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1")
USDC = Web3.to_checksum_address("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8")  # bridged (USDC.e)
USDC_NATIVE = Web3.to_checksum_address("0xaf88d065e77c8cC2239327C5EDb3A432268e5831")  # native USDC

# Uniswap v3 QuoterV2 (Arbitrum)
UNISWAP_V3_QUOTER_V2 = Web3.to_checksum_address("0x61fFE014bA17989E743c5F6cB21bF9697530B21e")

# Sushi & Camelot are Uniswap V2-style; we need pair addresses
# Factory addresses
SUSHI_FACTORY = Web3.to_checksum_address("0xc35DADB65012eC5796536bD9864eD8773aBc74C4")
CAMELOT_FACTORY = Web3.to_checksum_address("0x6EcCab422D763aC031210895C81787E87B43A652")

# Minimal Factory ABI for getPair
UNISWAP_V2_FACTORY_ABI = [
    {
        "constant": True,
        "inputs": [
            {"internalType": "address", "name": "tokenA", "type": "address"},
            {"internalType": "address", "name": "tokenB", "type": "address"},
        ],
        "name": "getPair",
        "outputs": [
            {"internalType": "address", "name": "pair", "type": "address"}
        ],
        "payable": False,
        "stateMutability": "view",
        "type": "function",
    }
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ABI_DIR = os.path.join(SCRIPT_DIR, "abis")


def load_abi(name: str) -> List[dict]:
    with open(os.path.join(ABI_DIR, name), "r") as f:
        data = json.load(f)
        # some files wrap under 'abi'
        return data.get("abi", data)


@dataclass
class Quote:
    dex: str
    market: str  # e.g., WETH/USDC or WETH/USDC.e
    amount_in_weth: float
    amount_out_usdc: float
    price_usdc_per_weth: float
    details: Dict[str, str]


class DexPricer:
    def __init__(self, w3: Web3):
        self.w3 = w3
        self.v3_quoter: Contract = self.w3.eth.contract(
            address=UNISWAP_V3_QUOTER_V2,
            abi=load_abi("UniswapV3QuoterV2.json"),
        )
        self.v2_pair_abi = load_abi("UniswapV2Pair.json")
        self.factory_abi = UNISWAP_V2_FACTORY_ABI
        self.sushi_factory = self.w3.eth.contract(address=SUSHI_FACTORY, abi=self.factory_abi)
        self.camelot_factory = self.w3.eth.contract(address=CAMELOT_FACTORY, abi=self.factory_abi)

    @retry(stop=stop_after_attempt(3), wait=wait_fixed(0.5))
    def quote_uniswap_v3_single(self, token_in: str, token_out: str, fee: int, amount_in_wei: int) -> int:
        # returns amountOut
        tx = self.v3_quoter.functions.quoteExactInputSingle(
            token_in, token_out, fee, amount_in_wei, 0
        ).call()
        amount_out = tx[0]
        return amount_out

    def get_uniswap_v3_quotes(self, amount_in_weth: float) -> List[Quote]:
        fees = [100, 500, 3000, 10000]
        amount_in_wei = int(amount_in_weth * 10**18)
        quotes: List[Quote] = []
        for out_token, market in ((USDC_NATIVE, "WETH/USDC"), (USDC, "WETH/USDC.e")):
            best_amount_out = 0
            best_fee = None
            for fee in fees:
                try:
                    out_amt = self.quote_uniswap_v3_single(WETH, out_token, fee, amount_in_wei)
                    if out_amt > best_amount_out:
                        best_amount_out = out_amt
                        best_fee = fee
                except Exception:
                    continue
            if best_amount_out > 0 and best_fee is not None:
                price = best_amount_out / (10**6) / amount_in_weth  # USDC has 6 decimals
                quotes.append(Quote(
                    dex="UniswapV3",
                    market=market,
                    amount_in_weth=amount_in_weth,
                    amount_out_usdc=best_amount_out / (10**6),
                    price_usdc_per_weth=price,
                    details={"best_fee": str(best_fee)}
                ))
        return quotes

    def get_uniswap_v3_buy_quotes(self, amount_in_usdc: float) -> List[Quote]:
        """USDC -> WETH quotes; convert to implied USDC per WETH."""
        fees = [100, 500, 3000, 10000]
        amount_in_wei = int(amount_in_usdc * 10**6)
        quotes: List[Quote] = []
        for in_token, market in ((USDC_NATIVE, "WETH/USDC"), (USDC, "WETH/USDC.e")):
            best_amount_out_weth = 0
            best_fee = None
            for fee in fees:
                try:
                    out_amt = self.quote_uniswap_v3_single(in_token, WETH, fee, amount_in_wei)
                    if out_amt > best_amount_out_weth:
                        best_amount_out_weth = out_amt
                        best_fee = fee
                except Exception:
                    continue
            if best_amount_out_weth > 0 and best_fee is not None:
                weth_out = best_amount_out_weth / (10**18)
                price_usdc_per_weth = amount_in_usdc / weth_out
                quotes.append(Quote(
                    dex="UniswapV3",
                    market=market,
                    amount_in_weth=0.0,
                    amount_out_usdc=amount_in_usdc,
                    price_usdc_per_weth=price_usdc_per_weth,
                    details={"best_fee": str(best_fee), "side": "buy", "amount_in_usdc": str(amount_in_usdc)}
                ))
        return quotes

    def get_v2_pair_address(self, factory: Contract, token_a: str, token_b: str) -> Optional[str]:
        try:
            pair = factory.functions.getPair(token_a, token_b).call()
            if int(pair, 16) == 0:
                return None
            return Web3.to_checksum_address(pair)
        except Exception:
            return None

    def quote_uniswap_v2_like(self, pair_addr: str, token_in: str, token_out: str, amount_in_wei: int) -> Optional[int]:
        pair = self.w3.eth.contract(address=pair_addr, abi=self.v2_pair_abi)
        try:
            reserve0, reserve1, _ = pair.functions.getReserves().call()
            token0 = pair.functions.token0().call()
            token1 = pair.functions.token1().call()
        except Exception:
            return None
        # map reserves to input/output
        if token_in.lower() == token0.lower() and token_out.lower() == token1.lower():
            reserve_in, reserve_out = reserve0, reserve1
        elif token_in.lower() == token1.lower() and token_out.lower() == token0.lower():
            reserve_in, reserve_out = reserve1, reserve0
        else:
            return None
        if reserve_in == 0 or reserve_out == 0:
            return None
        # Standard x*y=k formula with 0.3% fee typical for v2 (Sushi/Camelot vary, but 0.3% default)
        amount_in_with_fee = amount_in_wei * 997 // 1000
        numerator = amount_in_with_fee * reserve_out
        denominator = reserve_in + amount_in_with_fee
        return numerator // denominator

    def get_sushi_quotes(self, amount_in_weth: float) -> List[Quote]:
        amount_in_wei = int(amount_in_weth * 10**18)
        quotes: List[Quote] = []
        for out_token, market in ((USDC_NATIVE, "WETH/USDC"), (USDC, "WETH/USDC.e")):
            pair = self.get_v2_pair_address(self.sushi_factory, WETH, out_token)
            if not pair:
                continue
            out_amt = self.quote_uniswap_v2_like(pair, WETH, out_token, amount_in_wei)
            if out_amt:
                price = out_amt / (10**6) / amount_in_weth
                quotes.append(Quote(
                    dex="SushiV2",
                    market=market,
                    amount_in_weth=amount_in_weth,
                    amount_out_usdc=out_amt / (10**6),
                    price_usdc_per_weth=price,
                    details={"pair": pair}
                ))
        return quotes

    def get_sushi_buy_quotes(self, amount_in_usdc: float) -> List[Quote]:
        amount_in_wei = int(amount_in_usdc * 10**6)
        quotes: List[Quote] = []
        for in_token, market in ((USDC_NATIVE, "WETH/USDC"), (USDC, "WETH/USDC.e")):
            pair = self.get_v2_pair_address(self.sushi_factory, WETH, in_token)
            if not pair:
                continue
            out_amt = self.quote_uniswap_v2_like(pair, in_token, WETH, amount_in_wei)
            if out_amt:
                weth_out = out_amt / (10**18)
                price = amount_in_usdc / weth_out
                quotes.append(Quote(
                    dex="SushiV2",
                    market=market,
                    amount_in_weth=0.0,
                    amount_out_usdc=amount_in_usdc,
                    price_usdc_per_weth=price,
                    details={"pair": pair, "side": "buy", "amount_in_usdc": str(amount_in_usdc)}
                ))
        return quotes

    def get_camelot_quotes(self, amount_in_weth: float) -> List[Quote]:
        amount_in_wei = int(amount_in_weth * 10**18)
        quotes: List[Quote] = []
        for out_token, market in ((USDC_NATIVE, "WETH/USDC"), (USDC, "WETH/USDC.e")):
            pair = self.get_v2_pair_address(self.camelot_factory, WETH, out_token)
            if not pair:
                continue
            out_amt = self.quote_uniswap_v2_like(pair, WETH, out_token, amount_in_wei)
            if out_amt:
                price = out_amt / (10**6) / amount_in_weth
                quotes.append(Quote(
                    dex="CamelotV2",
                    market=market,
                    amount_in_weth=amount_in_weth,
                    amount_out_usdc=out_amt / (10**6),
                    price_usdc_per_weth=price,
                    details={"pair": pair}
                ))
        return quotes

    def get_camelot_buy_quotes(self, amount_in_usdc: float) -> List[Quote]:
        amount_in_wei = int(amount_in_usdc * 10**6)
        quotes: List[Quote] = []
        for in_token, market in ((USDC_NATIVE, "WETH/USDC"), (USDC, "WETH/USDC.e")):
            pair = self.get_v2_pair_address(self.camelot_factory, WETH, in_token)
            if not pair:
                continue
            out_amt = self.quote_uniswap_v2_like(pair, in_token, WETH, amount_in_wei)
            if out_amt:
                weth_out = out_amt / (10**18)
                price = amount_in_usdc / weth_out
                quotes.append(Quote(
                    dex="CamelotV2",
                    market=market,
                    amount_in_weth=0.0,
                    amount_out_usdc=amount_in_usdc,
                    price_usdc_per_weth=price,
                    details={"pair": pair, "side": "buy", "amount_in_usdc": str(amount_in_usdc)}
                ))
        return quotes


def compute_spreads(buy_quotes: List[Quote], sell_quotes: List[Quote]) -> List[Dict[str, object]]:
    """Compute spreads between best place to buy WETH (USDC->WETH) and best place to sell WETH (WETH->USDC)."""
    results: List[Dict[str, object]] = []
    by_market_buy: Dict[str, List[Quote]] = {}
    for q in buy_quotes:
        by_market_buy.setdefault(q.market, []).append(q)
    by_market_sell: Dict[str, List[Quote]] = {}
    for q in sell_quotes:
        by_market_sell.setdefault(q.market, []).append(q)

    for market in sorted(set(by_market_buy.keys()) & set(by_market_sell.keys())):
        buys = by_market_buy[market]
        sells = by_market_sell[market]
        if not buys or not sells:
            continue
        best_buy = min(buys, key=lambda x: x.price_usdc_per_weth)
        best_sell = max(sells, key=lambda x: x.price_usdc_per_weth)
        spread = (best_sell.price_usdc_per_weth - best_buy.price_usdc_per_weth) / best_buy.price_usdc_per_weth * 100
        results.append({
            "market": market,
            "best_buy_dex": best_buy.dex,
            "best_sell_dex": best_sell.dex,
            "best_buy_price": best_buy.price_usdc_per_weth,
            "best_sell_price": best_sell.price_usdc_per_weth,
            "spread_pct": spread,
        })
    return results


def format_message(sell_quotes: List[Quote], buy_quotes: List[Quote], spreads: List[Dict[str, object]]) -> str:
    parts: List[str] = []
    parts.append("WETH live quotes (Arbitrum)\n")
    parts.append("Sell WETH -> USDC (per WETH):")
    for q in sorted(sell_quotes, key=lambda x: (x.market, x.dex)):
        parts.append(f"- {q.market} | {q.dex}: ${q.price_usdc_per_weth:,.2f}")
    parts.append("")
    parts.append("Buy WETH <- USDC (implied per WETH):")
    for q in sorted(buy_quotes, key=lambda x: (x.market, x.dex)):
        parts.append(f"- {q.market} | {q.dex}: ${q.price_usdc_per_weth:,.2f}")
    parts.append("")
    parts.append("Arbitrage spreads:")
    if not spreads:
        parts.append("- None (insufficient data or no spread)")
    else:
        for s in spreads:
            parts.append(
                f"- {s['market']}: buy on {s['best_buy_dex']} @ ${s['best_buy_price']:,.2f}, "
                f"sell on {s['best_sell_dex']} @ ${s['best_sell_price']:,.2f} "
                f"=> spread {s['spread_pct']:.2f}%"
            )
    return "\n".join(parts)


def send_telegram(token: str, chat_id: str, text: str) -> None:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception:
        pass


def main():
    # Load config from env or config.json
    config_path = os.path.join(SCRIPT_DIR, "config.json")
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            cfg = json.load(f)
    else:
        cfg = {
            "rpc_url": os.getenv("RPC_URL", ""),
            "telegram_bot_token": os.getenv("TELEGRAM_BOT_TOKEN", ""),
            "telegram_chat_id": os.getenv("TELEGRAM_CHAT_ID", ""),
            "poll_interval_seconds": int(os.getenv("POLL_INTERVAL_SECONDS", "180")),
        }

    rpc_url = cfg.get("rpc_url")
    bot_token = cfg.get("telegram_bot_token")
    chat_id = cfg.get("telegram_chat_id")
    interval = int(cfg.get("poll_interval_seconds", 180))
    run_once_env = os.getenv("RUN_ONCE", "0").strip()
    run_once = run_once_env in ("1", "true", "True")

    if not rpc_url:
        raise SystemExit("RPC URL missing. Provide in config.json or RPC_URL env var.")
    if not bot_token or not chat_id:
        raise SystemExit("Telegram creds missing. Provide in config.json or env vars.")

    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 20}))
    if not w3.is_connected():
        raise SystemExit("Web3 failed to connect to RPC.")

    pricer = DexPricer(w3)

    amount_in_weth_sell = 1.0   # WETH -> USDC
    amount_in_usdc_buy = 1000.0 # USDC -> WETH

    while True:
        sell_quotes: List[Quote] = []
        buy_quotes: List[Quote] = []
        try:
            sell_quotes.extend(pricer.get_uniswap_v3_quotes(amount_in_weth_sell))
        except Exception:
            pass
        try:
            sell_quotes.extend(pricer.get_sushi_quotes(amount_in_weth_sell))
        except Exception:
            pass
        try:
            sell_quotes.extend(pricer.get_camelot_quotes(amount_in_weth_sell))
        except Exception:
            pass
        # Buy side
        try:
            buy_quotes.extend(pricer.get_uniswap_v3_buy_quotes(amount_in_usdc_buy))
        except Exception:
            pass
        try:
            buy_quotes.extend(pricer.get_sushi_buy_quotes(amount_in_usdc_buy))
        except Exception:
            pass
        try:
            buy_quotes.extend(pricer.get_camelot_buy_quotes(amount_in_usdc_buy))
        except Exception:
            pass

        spreads = compute_spreads(buy_quotes, sell_quotes)
        msg = format_message(sell_quotes, buy_quotes, spreads)
        send_telegram(bot_token, chat_id, msg)
        if run_once:
            break
        time.sleep(interval)


if __name__ == "__main__":
    main()
