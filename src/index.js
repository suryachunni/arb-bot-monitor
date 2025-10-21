#!/usr/bin/env node

import ArbitrumMonitor from './monitor.js';
import { config } from './config.js';
import chalk from 'chalk';

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n🛑 Received SIGINT, shutting down gracefully...'));
  if (global.monitor) {
    global.monitor.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\n🛑 Received SIGTERM, shutting down gracefully...'));
  if (global.monitor) {
    global.monitor.stop();
  }
  process.exit(0);
});

// Main execution
async function main() {
  try {
    console.log(chalk.blue.bold('🔍 Arbitrum WETH Arbitrage Monitor'));
    console.log(chalk.gray('====================================='));
    console.log('');

    // Validate configuration
    if (!config.arbitrum.rpcUrl) {
      console.error(chalk.red('❌ Error: No RPC URL configured'));
      console.log(chalk.yellow('Please set ALCHEMY_URL in your .env file'));
      process.exit(1);
    }

    // Create and start monitor
    const monitor = new ArbitrumMonitor();
    global.monitor = monitor;

    // Start monitoring
    await monitor.start();

  } catch (error) {
    console.error(chalk.red('❌ Fatal error:'), error.message);
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  console.error(chalk.red('❌ Unhandled error:'), error);
  process.exit(1);
});