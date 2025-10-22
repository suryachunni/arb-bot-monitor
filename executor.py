"""
Automated Flash Loan Arbitrage Executor
Monitors for opportunities and executes trades automatically
"""

import os
import time
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv
import requests
import json
from decimal import Decimal
from arbitrage_bot import ArbitrageScanner, TOKENS, DEXS
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Contract ABI (simplified for execution)
ARBITRAGE_CONTRACT_ABI = json.loads('''[
    {
        "inputs": [
            {"internalType": "uint256", "name": "flashLoanAmount", "type": "uint256"},
            {"components": [
                {"internalType": "address", "name": "tokenIn", "type": "address"},
                {"internalType": "address", "name": "tokenOut", "type": "address"},
                {"internalType": "uint8", "name": "buyDex", "type": "uint8"},
                {"internalType": "uint8", "name": "sellDex", "type": "uint8"},
                {"internalType": "uint24", "name": "buyFee", "type": "uint24"},
                {"internalType": "uint24", "name": "sellFee", "type": "uint24"},
                {"internalType": "uint256", "name": "minProfit", "type": "uint256"}
            ], "internalType": "struct FlashLoanArbitrage.ArbitrageParams", "name": "params", "type": "tuple"}
        ],
        "name": "executeArbitrage",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]''')


class ArbitrageExecutor:
    def __init__(self):
        # Load configuration
        self.private_key = os.getenv('PRIVATE_KEY')
        self.rpc_url = os.getenv('ARBITRUM_RPC_URL', 'https://arb1.arbitrum.io/rpc')
        self.contract_address = os.getenv('ARBITRAGE_CONTRACT_ADDRESS')
        self.min_profit_usd = float(os.getenv('MIN_PROFIT_USD', '50'))
        self.max_gas_price = float(os.getenv('MAX_GAS_PRICE_GWEI', '0.5'))
        self.flash_loan_amount_usd = float(os.getenv('FLASH_LOAN_AMOUNT_USD', '50000'))
        self.auto_execute = os.getenv('AUTO_EXECUTE', 'false').lower() == 'true'
        
        # Telegram
        self.telegram_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.telegram_chat_id = os.getenv('TELEGRAM_CHAT_ID')
        
        # Initialize Web3
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        if not self.w3.is_connected():
            raise Exception("Failed to connect to Arbitrum")
        
        # Initialize account
        if self.private_key and self.private_key != 'your_private_key_here':
            self.account = Account.from_key(self.private_key)
            logger.info(f"Wallet loaded: {self.account.address}")
        else:
            self.account = None
            logger.warning("No private key configured - execution disabled")
        
        # Initialize contract
        if self.contract_address and self.contract_address != '':
            self.contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(self.contract_address),
                abi=ARBITRAGE_CONTRACT_ABI
            )
            logger.info(f"Contract loaded: {self.contract_address}")
        else:
            self.contract = None
            logger.warning("No contract address - execution disabled")
        
        # Initialize scanner
        self.scanner = ArbitrageScanner()
        
        # Execution tracking
        self.trades_executed = 0
        self.total_profit = 0
        self.pending_confirmation = {}
        
    def send_telegram(self, message):
        """Send Telegram message"""
        try:
            url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
            data = {
                "chat_id": self.telegram_chat_id,
                "text": message,
                "parse_mode": "HTML"
            }
            requests.post(url, data=data, timeout=10)
        except Exception as e:
            logger.error(f"Telegram error: {e}")
    
    def get_dex_enum(self, dex_name):
        """Convert DEX name to contract enum"""
        dex_map = {
            'Uniswap_V3': 0,
            'Sushiswap': 1,
            'Camelot': 2
        }
        return dex_map.get(dex_name, 0)
    
    def prepare_transaction(self, opportunity):
        """Prepare transaction parameters for execution"""
        try:
            # Get token addresses
            if opportunity['type'] == 'direct':
                pair = opportunity['pair'].split('/')
                token_in_name = pair[0]
                token_out_name = pair[1]
            else:
                # For triangular, we'll need to handle differently
                logger.warning("Triangular arbitrage execution not yet implemented")
                return None
            
            token_in = TOKENS[token_in_name]
            token_out = TOKENS[token_out_name]
            
            # Calculate flash loan amount in token decimals
            # For simplicity, using USDC value as reference
            flash_loan_amount = int(self.flash_loan_amount_usd * (10 ** 6))  # Assuming USDC decimals
            
            # Get DEX enums
            buy_dex = self.get_dex_enum(opportunity['buy_dex'])
            sell_dex = self.get_dex_enum(opportunity['sell_dex'])
            
            # Uniswap V3 fees (default 3000 = 0.3%)
            buy_fee = 3000
            sell_fee = 3000
            
            # Minimum profit in wei (80% of expected to account for slippage)
            min_profit_wei = int(opportunity['profit']['net_profit'] * 0.8 * (10 ** 6))
            
            # Prepare params
            params = {
                'tokenIn': Web3.to_checksum_address(token_in),
                'tokenOut': Web3.to_checksum_address(token_out),
                'buyDex': buy_dex,
                'sellDex': sell_dex,
                'buyFee': buy_fee,
                'sellFee': sell_fee,
                'minProfit': min_profit_wei
            }
            
            return {
                'flash_loan_amount': flash_loan_amount,
                'params': params,
                'opportunity': opportunity
            }
            
        except Exception as e:
            logger.error(f"Error preparing transaction: {e}")
            return None
    
    def execute_trade(self, tx_data):
        """Execute the arbitrage trade on-chain"""
        if not self.account or not self.contract:
            logger.error("Execution not configured (missing key or contract)")
            return False
        
        try:
            opportunity = tx_data['opportunity']
            
            logger.info(f"Executing arbitrage: {opportunity['pair']}")
            logger.info(f"Expected profit: ${opportunity['profit']['net_profit']:.2f}")
            
            # Build transaction
            txn = self.contract.functions.executeArbitrage(
                tx_data['flash_loan_amount'],
                tuple(tx_data['params'].values())
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 500000,  # Estimate gas
                'gasPrice': self.w3.eth.gas_price,
                'chainId': 42161
            })
            
            # Check gas price
            gas_price_gwei = self.w3.from_wei(txn['gasPrice'], 'gwei')
            if gas_price_gwei > self.max_gas_price:
                logger.warning(f"Gas price too high: {gas_price_gwei} gwei")
                return False
            
            # Sign transaction
            signed_txn = self.account.sign_transaction(txn)
            
            # Send transaction
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            logger.info(f"Transaction sent: {tx_hash.hex()}")
            
            # Send Telegram notification
            self.send_telegram(
                f"🚀 <b>TRADE EXECUTING</b>\n\n"
                f"Pair: {opportunity['pair']}\n"
                f"Expected Profit: ${opportunity['profit']['net_profit']:.2f}\n"
                f"TX: {tx_hash.hex()}\n\n"
                f"Waiting for confirmation..."
            )
            
            # Wait for receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
            
            if receipt['status'] == 1:
                logger.info("✅ Transaction successful!")
                
                self.trades_executed += 1
                self.total_profit += opportunity['profit']['net_profit']
                
                self.send_telegram(
                    f"✅ <b>TRADE SUCCESSFUL!</b>\n\n"
                    f"Pair: {opportunity['pair']}\n"
                    f"Profit: ${opportunity['profit']['net_profit']:.2f}\n"
                    f"Gas Used: {receipt['gasUsed']}\n"
                    f"TX: {tx_hash.hex()}\n\n"
                    f"Total Trades: {self.trades_executed}\n"
                    f"Total Profit: ${self.total_profit:.2f}"
                )
                
                return True
            else:
                logger.error("❌ Transaction failed")
                self.send_telegram(
                    f"❌ <b>TRADE FAILED</b>\n\n"
                    f"Pair: {opportunity['pair']}\n"
                    f"TX: {tx_hash.hex()}\n\n"
                    f"Check transaction for details"
                )
                return False
                
        except Exception as e:
            logger.error(f"Execution error: {e}")
            self.send_telegram(f"❌ <b>EXECUTION ERROR</b>\n\n{str(e)}")
            return False
    
    def process_opportunity(self, opportunity):
        """Process a single opportunity"""
        # Check if profitable enough
        if opportunity['profit']['net_profit'] < self.min_profit_usd:
            logger.debug(f"Profit too low: ${opportunity['profit']['net_profit']:.2f}")
            return False
        
        # Only handle direct arbitrage for now
        if opportunity['type'] != 'direct':
            logger.debug("Skipping triangular arbitrage (not implemented yet)")
            return False
        
        # Prepare transaction
        tx_data = self.prepare_transaction(opportunity)
        if not tx_data:
            return False
        
        # Send opportunity alert
        message = (
            f"💰 <b>OPPORTUNITY DETECTED</b>\n\n"
            f"Pair: {opportunity['pair']}\n"
            f"Buy: {opportunity['buy_dex']} @ ${opportunity['buy_price']:.6f}\n"
            f"Sell: {opportunity['sell_dex']} @ ${opportunity['sell_price']:.6f}\n"
            f"Spread: {opportunity['spread_pct']:.3f}%\n\n"
            f"Expected Profit: <b>${opportunity['profit']['net_profit']:.2f}</b>\n"
            f"ROI: {opportunity['profit']['roi_pct']:.2f}%\n\n"
        )
        
        if self.auto_execute:
            message += "⚡ AUTO-EXECUTING NOW..."
            self.send_telegram(message)
            return self.execute_trade(tx_data)
        else:
            message += "⏸️ Manual confirmation required\nSet AUTO_EXECUTE=true to enable"
            self.send_telegram(message)
            return False
    
    def run(self):
        """Main execution loop"""
        logger.info("="*70)
        logger.info("ARBITRAGE EXECUTOR STARTED")
        logger.info("="*70)
        logger.info(f"Wallet: {self.account.address if self.account else 'Not configured'}")
        logger.info(f"Contract: {self.contract_address if self.contract_address else 'Not configured'}")
        logger.info(f"Auto-Execute: {self.auto_execute}")
        logger.info(f"Min Profit: ${self.min_profit_usd}")
        logger.info("="*70)
        
        self.send_telegram(
            f"🤖 <b>EXECUTOR STARTED</b>\n\n"
            f"Wallet: {self.account.address if self.account else 'Not configured'}\n"
            f"Auto-Execute: {'✅ ON' if self.auto_execute else '⏸️ OFF'}\n"
            f"Min Profit: ${self.min_profit_usd}\n\n"
            f"Monitoring for opportunities..."
        )
        
        scan_count = 0
        
        while True:
            try:
                scan_count += 1
                logger.info(f"\n{'='*70}")
                logger.info(f"SCAN #{scan_count}")
                logger.info(f"{'='*70}")
                
                # Scan for opportunities
                opportunities = self.scanner.scan_for_opportunities()
                
                if opportunities:
                    logger.info(f"Found {len(opportunities)} opportunities")
                    
                    # Process each opportunity
                    for opp in sorted(opportunities, key=lambda x: x['profit']['net_profit'], reverse=True):
                        if self.process_opportunity(opp):
                            # If executed, wait a bit before next trade
                            time.sleep(30)
                            break
                
                # Wait before next scan
                logger.info("Waiting 15 seconds until next scan...")
                time.sleep(15)
                
            except KeyboardInterrupt:
                logger.info("\nExecutor stopped by user")
                self.send_telegram("🛑 <b>EXECUTOR STOPPED</b>")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(15)


def main():
    executor = ArbitrageExecutor()
    executor.run()


if __name__ == "__main__":
    main()
