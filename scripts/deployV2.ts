import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * PRODUCTION DEPLOYMENT SCRIPT FOR FLASH LOAN ARBITRAGE V2
 * 
 * Features:
 * - Network detection and validation
 * - Gas optimization
 * - Contract verification
 * - Deployment record keeping
 * - Safety checks
 */

async function main() {
    console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
    console.log("║     FLASH LOAN ARBITRAGE V2 - PRODUCTION DEPLOYMENT             ║");
    console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

    // Get network info
    const network = await ethers.provider.getNetwork();
    const [deployer] = await ethers.getSigners();
    const balance = await deployer.getBalance();

    console.log("📊 Deployment Configuration:");
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`   Network:        ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`   Deployer:       ${deployer.address}`);
    console.log(`   Balance:        ${ethers.utils.formatEther(balance)} ETH`);
    console.log("═══════════════════════════════════════════════════════════════════\n");

    // Validate network
    if (network.chainId !== 42161 && network.chainId !== 421614) {
        console.log("⚠️  Warning: Not deploying to Arbitrum mainnet or testnet");
        console.log("   Current network: " + network.name);
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise<string>((resolve) => {
            readline.question('   Continue anyway? (yes/no): ', resolve);
        });
        readline.close();

        if (answer.toLowerCase() !== 'yes') {
            console.log("\n❌ Deployment cancelled\n");
            process.exit(0);
        }
    }

    // Check balance
    const minimumBalance = ethers.utils.parseEther("0.05");
    if (balance.lt(minimumBalance)) {
        console.error(`\n❌ Insufficient balance!`);
        console.error(`   Required: 0.05 ETH minimum`);
        console.error(`   Current:  ${ethers.utils.formatEther(balance)} ETH\n`);
        process.exit(1);
    }

    // Get profit receiver address
    const profitReceiver = process.env.PROFIT_RECEIVER || deployer.address;
    
    console.log("🚀 Deploying FlashLoanArbitrageV2...\n");
    console.log(`   Profit Receiver: ${profitReceiver}`);

    // Deploy contract
    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrageV2");
    const flashLoan = await FlashLoanArbitrage.deploy(profitReceiver);

    console.log("\n⏳ Waiting for deployment confirmation...");
    await flashLoan.deployed();

    console.log("\n✅ CONTRACT DEPLOYED SUCCESSFULLY!");
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`   Address:        ${flashLoan.address}`);
    console.log(`   Deployer:       ${deployer.address}`);
    console.log(`   Profit Receiver: ${profitReceiver}`);
    console.log(`   Network:        ${network.name}`);
    console.log(`   Chain ID:       ${network.chainId}`);
    console.log("═══════════════════════════════════════════════════════════════════\n");

    // Get deployment transaction
    const deployTx = flashLoan.deployTransaction;
    console.log("📊 Deployment Transaction:");
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`   Hash:           ${deployTx.hash}`);
    console.log(`   Block:          ${deployTx.blockNumber || 'pending'}`);
    console.log(`   Gas Limit:      ${deployTx.gasLimit?.toString()}`);
    console.log(`   Gas Price:      ${deployTx.gasPrice ? ethers.utils.formatUnits(deployTx.gasPrice, 'gwei') + ' gwei' : 'N/A'}`);
    console.log("═══════════════════════════════════════════════════════════════════\n");

    // Wait for a few confirmations
    console.log("⏳ Waiting for confirmations...");
    const receipt = await deployTx.wait(3);
    
    console.log(`✅ Confirmed after ${receipt.confirmations} blocks`);
    console.log(`   Gas Used:       ${receipt.gasUsed.toString()}`);
    console.log(`   Effective Gas:  ${receipt.effectiveGasPrice ? ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei') + ' gwei' : 'N/A'}`);
    console.log(`   Block:          ${receipt.blockNumber}\n`);

    // Save deployment info
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId,
        contractAddress: flashLoan.address,
        deployer: deployer.address,
        profitReceiver: profitReceiver,
        deploymentHash: deployTx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date().toISOString(),
    };

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(
        deploymentsDir,
        `deployment-${network.name}-${Date.now()}.json`
    );
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("💾 Deployment info saved to:");
    console.log(`   ${deploymentFile}\n`);

    // Update .env with contract address
    console.log("📝 Updating .env file...");
    const envPath = path.join(__dirname, "..", ".env");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    
    if (envContent.includes("CONTRACT_ADDRESS=")) {
        envContent = envContent.replace(
            /CONTRACT_ADDRESS=.*/,
            `CONTRACT_ADDRESS=${flashLoan.address}`
        );
    } else {
        envContent += `\nCONTRACT_ADDRESS=${flashLoan.address}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log("   ✅ CONTRACT_ADDRESS updated in .env\n");

    // Verify contract configuration
    console.log("🔍 Verifying Contract Configuration:");
    console.log("═══════════════════════════════════════════════════════════════════");
    
    const config = await flashLoan.getConfiguration();
    console.log(`   Min Profit:     ${config.minProfit} basis points (${config.minProfit / 100}%)`);
    console.log(`   Max Slippage:   ${config.maxSlippage} basis points (${config.maxSlippage / 100}%)`);
    console.log(`   Profit Receiver: ${config.receiver}`);
    console.log(`   Emergency Stop: ${config.stopped ? '🔴 ACTIVE' : '🟢 INACTIVE'}`);
    console.log("═══════════════════════════════════════════════════════════════════\n");

    // Next steps
    console.log("📋 NEXT STEPS:");
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("   1. Verify contract on block explorer (if mainnet/testnet):");
    console.log(`      npx hardhat verify --network ${network.name} ${flashLoan.address} ${profitReceiver}`);
    console.log("");
    console.log("   2. Fund the executor wallet with gas money:");
    console.log(`      Wallet: ${deployer.address}`);
    console.log(`      Recommended: 0.02-0.05 ETH on ${network.name}`);
    console.log("");
    console.log("   3. Test the bot with small amounts first");
    console.log("");
    console.log("   4. Monitor Telegram for alerts and execution logs");
    console.log("═══════════════════════════════════════════════════════════════════\n");

    // Explorer link
    if (network.chainId === 42161) {
        console.log(`🔗 View on Arbiscan:`);
        console.log(`   https://arbiscan.io/address/${flashLoan.address}\n`);
    } else if (network.chainId === 421614) {
        console.log(`🔗 View on Arbiscan Sepolia:`);
        console.log(`   https://sepolia.arbiscan.io/address/${flashLoan.address}\n`);
    }

    console.log("✅ DEPLOYMENT COMPLETE!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ DEPLOYMENT FAILED:");
        console.error(error);
        process.exit(1);
    });
