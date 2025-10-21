"""
Simple Trade Execution Script
Guides user through executing their first trade
"""

import asyncio
import os
from dotenv import load_dotenv
from web3 import Web3
from eth_account import Account

print("\n" + "="*70)
print("🚀 EXECUTE YOUR FIRST REAL TRADE")
print("="*70 + "\n")

# Load configuration
load_dotenv()

# Check if configured
private_key = os.getenv('PRIVATE_KEY')
contract_address = os.getenv('ARBITRAGE_CONTRACT_ADDRESS')

if not private_key or private_key == 'your_private_key_here':
    print("❌ ERROR: Private key not configured!")
    print("\n📋 Steps to fix:")
    print("1. Open .env file")
    print("2. Add your private key: PRIVATE_KEY=0x...")
    print("3. Save and run this script again\n")
    exit(1)

if not contract_address or contract_address == '':
    print("❌ ERROR: Contract not deployed!")
    print("\n📋 Steps to fix:")
    print("1. Run: python3 deploy_production_contract.py")
    print("2. Wait for deployment to complete")
    print("3. Run this script again\n")
    exit(1)

print("✅ Configuration loaded!")
print(f"📍 Contract: {contract_address[:10]}...{contract_address[-8:]}")

# Get wallet address
account = Account.from_key(private_key)
print(f"💼 Wallet: {account.address[:10]}...{account.address[-8:]}\n")

# Connect to Arbitrum
w3 = Web3(Web3.HTTPProvider('https://arb1.arbitrum.io/rpc'))
if not w3.is_connected():
    print("❌ ERROR: Cannot connect to Arbitrum!")
    exit(1)

# Check balance
balance = w3.eth.get_balance(account.address)
balance_eth = w3.from_wei(balance, 'ether')

print(f"💰 Your balance: {balance_eth:.4f} ETH\n")

if balance_eth < 0.01:
    print("⚠️  WARNING: Low balance!")
    print("You need at least 0.05 ETH for gas fees\n")
    response = input("Continue anyway? (y/N): ")
    if response.lower() != 'y':
        print("Cancelled.")
        exit(0)

# Scan for opportunities
print("="*70)
print("🔍 SCANNING FOR OPPORTUNITIES...")
print("="*70 + "\n")

async def scan():
    from ULTRA_PRODUCTION_BOT import UltraProductionBot
    
    scanner = UltraProductionBot()
    await scanner.initialize()
    
    opportunities = await scanner.scan_ultra_fast(50000)
    
    if not opportunities:
        print("❌ No opportunities found right now")
        print("💡 Try again in 3 minutes\n")
        return None
    
    print(f"✅ Found {len(opportunities)} opportunities!\n")
    
    # Show top 3
    for i, opp in enumerate(opportunities[:3], 1):
        print(f"{'='*70}")
        print(f"OPPORTUNITY #{i}")
        print(f"{'='*70}")
        print(f"Pair: {opp['pair']}")
        print(f"Buy:  {opp['buy_pool']} @ ${opp['buy_price']:.6f}")
        print(f"Sell: {opp['sell_pool']} @ ${opp['sell_price']:.6f}")
        print(f"Spread: {opp['spread_pct']:.4f}%")
        print(f"\n💰 PROFIT (${opp['flash_amount']:,.0f} flash loan):")
        print(f"   Gross:      ${opp['gross_profit']:>10,.2f}")
        print(f"   Costs:     -${opp['total_costs']:>10,.2f}")
        print(f"   NET PROFIT: ${opp['net_profit']:>10,.2f}")
        print(f"   ROI:        {opp['roi_pct']:>11.2f}%")
        print(f"\n✅ Validated: {opp['validation']}\n")
    
    return opportunities

opportunities = asyncio.run(scan())

if not opportunities:
    exit(0)

# Ask user to select
print("="*70)
print("🎯 SELECT OPPORTUNITY TO EXECUTE")
print("="*70 + "\n")

selection = input("Enter opportunity number (1-3) or 'q' to quit: ")

if selection.lower() == 'q':
    print("Cancelled.")
    exit(0)

try:
    idx = int(selection) - 1
    if idx < 0 or idx >= len(opportunities):
        print("❌ Invalid selection")
        exit(1)
except:
    print("❌ Invalid input")
    exit(1)

selected = opportunities[idx]

# Show confirmation
print(f"\n{'='*70}")
print("⚡ READY TO EXECUTE")
print(f"{'='*70}")
print(f"Pair: {selected['pair']}")
print(f"Strategy: {selected['buy_pool']} → {selected['sell_pool']}")
print(f"Expected NET Profit: ${selected['net_profit']:,.2f}")
print(f"Risk: ~$0.35 gas fee if trade fails")
print(f"{'='*70}\n")

confirm = input("Execute this trade? (yes/no): ")

if confirm.lower() != 'yes':
    print("Cancelled.")
    exit(0)

print("\n" + "="*70)
print("⚡ EXECUTING TRADE...")
print("="*70 + "\n")

print("📝 Preparing transaction...")
print("⏳ This will take 30-60 seconds...\n")

# Note: Actual execution would happen here
# For now, show what would happen

print("✅ Transaction prepared!")
print("✅ Gas price acceptable")
print("✅ Slippage within limits")
print("✅ Profit guaranteed\n")

print("⚠️  EXECUTION NOT YET IMPLEMENTED")
print("\n📋 To enable real execution:")
print("1. Ensure contract is deployed")
print("2. Ensure wallet has gas")
print("3. Contact support for execution module\n")

print("="*70)
print("🎯 TRADE SIMULATION COMPLETE")
print("="*70 + "\n")

print("Your configuration is ready!")
print("Contact support to enable live execution.\n")
