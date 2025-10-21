"""
Deploy Flash Loan Arbitrage Contract to Arbitrum
"""

import os
import json
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv
from solcx import compile_standard, install_solc
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Aave V3 Pool Address Provider on Arbitrum
AAVE_POOL_PROVIDER = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb"

def compile_contract():
    """Compile the Solidity contract"""
    logger.info("Installing Solidity compiler...")
    install_solc('0.8.20')
    
    logger.info("Reading contract source...")
    with open('contracts/FlashLoanArbitrage.sol', 'r') as f:
        contract_source = f.read()
    
    logger.info("Compiling contract...")
    compiled_sol = compile_standard(
        {
            "language": "Solidity",
            "sources": {"FlashLoanArbitrage.sol": {"content": contract_source}},
            "settings": {
                "outputSelection": {
                    "*": {
                        "*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]
                    }
                }
            },
        },
        solc_version="0.8.20",
    )
    
    return compiled_sol

def deploy_contract(w3, account):
    """Deploy the contract"""
    logger.info("Compiling contract...")
    compiled_sol = compile_contract()
    
    # Get bytecode and ABI
    contract_interface = compiled_sol['contracts']['FlashLoanArbitrage.sol']['FlashLoanArbitrage']
    bytecode = contract_interface['evm']['bytecode']['object']
    abi = contract_interface['abi']
    
    # Save ABI
    with open('contract_abi.json', 'w') as f:
        json.dump(abi, f, indent=2)
    logger.info("ABI saved to contract_abi.json")
    
    # Create contract
    FlashLoanArbitrage = w3.eth.contract(abi=abi, bytecode=bytecode)
    
    # Build deployment transaction
    logger.info("Building deployment transaction...")
    txn = FlashLoanArbitrage.constructor(AAVE_POOL_PROVIDER).build_transaction({
        'from': account.address,
        'nonce': w3.eth.get_transaction_count(account.address),
        'gas': 3000000,
        'gasPrice': w3.eth.gas_price,
        'chainId': 42161
    })
    
    # Sign and send
    logger.info("Signing transaction...")
    signed_txn = account.sign_transaction(txn)
    
    logger.info("Sending transaction...")
    tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
    
    logger.info(f"Transaction hash: {tx_hash.hex()}")
    logger.info("Waiting for confirmation...")
    
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
    
    if receipt['status'] == 1:
        contract_address = receipt['contractAddress']
        logger.info(f"✅ Contract deployed successfully!")
        logger.info(f"Contract address: {contract_address}")
        
        # Update .env file
        env_path = '.env'
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                lines = f.readlines()
            
            with open(env_path, 'w') as f:
                for line in lines:
                    if line.startswith('ARBITRAGE_CONTRACT_ADDRESS='):
                        f.write(f'ARBITRAGE_CONTRACT_ADDRESS={contract_address}\n')
                    else:
                        f.write(line)
            
            logger.info(f"Updated .env file with contract address")
        
        return contract_address
    else:
        logger.error("❌ Deployment failed")
        return None

def main():
    logger.info("="*70)
    logger.info("FLASH LOAN ARBITRAGE CONTRACT DEPLOYMENT")
    logger.info("="*70)
    
    # Load environment
    private_key = os.getenv('PRIVATE_KEY')
    rpc_url = os.getenv('ARBITRUM_RPC_URL', 'https://arb1.arbitrum.io/rpc')
    
    if not private_key or private_key == 'your_private_key_here':
        logger.error("Please set PRIVATE_KEY in .env file")
        return
    
    # Connect to Arbitrum
    logger.info("Connecting to Arbitrum...")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    if not w3.is_connected():
        logger.error("Failed to connect to Arbitrum")
        return
    
    logger.info(f"✅ Connected to Arbitrum (Chain ID: {w3.eth.chain_id})")
    
    # Load account
    account = Account.from_key(private_key)
    logger.info(f"Deployer address: {account.address}")
    
    # Check balance
    balance = w3.eth.get_balance(account.address)
    balance_eth = w3.from_wei(balance, 'ether')
    logger.info(f"Balance: {balance_eth:.4f} ETH")
    
    if balance_eth < 0.01:
        logger.warning("⚠️  Low balance! You need at least 0.01 ETH for deployment")
        logger.info("Send some ETH to your wallet first")
        return
    
    # Estimate gas cost
    gas_price = w3.eth.gas_price
    gas_price_gwei = w3.from_wei(gas_price, 'gwei')
    estimated_cost = w3.from_wei(gas_price * 3000000, 'ether')
    logger.info(f"Gas price: {gas_price_gwei:.2f} gwei")
    logger.info(f"Estimated deployment cost: {estimated_cost:.4f} ETH")
    
    # Confirm
    response = input("\n🚀 Deploy contract? (yes/no): ")
    if response.lower() != 'yes':
        logger.info("Deployment cancelled")
        return
    
    # Deploy
    contract_address = deploy_contract(w3, account)
    
    if contract_address:
        logger.info("\n" + "="*70)
        logger.info("DEPLOYMENT SUCCESSFUL!")
        logger.info("="*70)
        logger.info(f"Contract Address: {contract_address}")
        logger.info(f"Deployer: {account.address}")
        logger.info(f"Network: Arbitrum Mainnet")
        logger.info(f"View on Arbiscan: https://arbiscan.io/address/{contract_address}")
        logger.info("="*70)
        logger.info("\nNext steps:")
        logger.info("1. Contract address saved to .env")
        logger.info("2. Start the executor: python3 executor.py")
        logger.info("3. Or use Telegram bot: python3 telegram_executor_bot.py")

if __name__ == "__main__":
    main()
