import { BigNumber, Contract, ethers } from 'ethers';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { ArbitrageOpportunity } from './ArbitrageDetector';
import { PriceScanner } from './PriceScanner';

const FLASH_LOAN_ARBITRAGE_ABI = [
  'function executeArbitrage((address loanToken,uint256 loanAmount,uint256 minProfit,uint256 deadline,tuple(uint8 dexType,address pool,address tokenIn,address tokenOut,uint24 fee,uint256 minAmountOut)[] legs) params) external',
  'function profitReceiver() view returns (address)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

type DexCode = 0 | 1 | 2 | 3;

const dexTypeToCode = (dex: string): DexCode => {
  switch (dex) {
    case 'UniswapV3':
      return 0;
    case 'SushiSwap':
      return 1;
    case 'Balancer':
      return 2;
    case 'Curve':
      return 3;
    default:
      return 0;
  }
};

export class TradeExecutor {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: Contract;
  private priceScanner: PriceScanner;

  constructor(priceScanner: PriceScanner) {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    this.wallet = new ethers.Wallet(config.wallet.privateKey, this.provider);
    this.priceScanner = priceScanner;

    if (!config.contract.arbitrageAddress) {
      throw new Error('Contract address not set. Deploy flash-loan arbitrage contract first.');
    }

    this.contract = new Contract(config.contract.arbitrageAddress, FLASH_LOAN_ARBITRAGE_ABI, this.wallet);

    logger.info(`Trade executor initialized with wallet: ${this.wallet.address}`);
  }

  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<{
    success: boolean;
    txHash?: string;
    profit?: number;
    error?: string;
  }> {
    try {
      logger.info(`🚀 Executing ${opportunity.type} arbitrage with notional ${opportunity.notionalUsd.toFixed(2)} USD`);

      const gasPrice = await this.provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      if (gasPriceGwei > config.execution.maxGasPriceGwei) {
        const error = `Gas price too high ${gasPriceGwei.toFixed(2)} gwei (max ${config.execution.maxGasPriceGwei})`;
        logger.warn(error);
        return { success: false, error };
      }

      const verification = await this.simulateOpportunity(opportunity);
      if (!verification.success) {
        return { success: false, error: verification.error };
      }

      const params = this.buildContractParams(opportunity, verification.outputs);

      const profitTokenHuman = parseFloat(
        ethers.utils.formatUnits(verification.profitTokenAmount, opportunity.borrowToken.decimals)
      );
      const profitUsd = profitTokenHuman * opportunity.borrowTokenUsd;
      logger.info(
        `📈 Verified profit: ${profitTokenHuman.toFixed(6)} ${opportunity.borrowToken.symbol} (~$${profitUsd.toFixed(2)})`
      );

      let gasLimit: BigNumber;
      try {
        gasLimit = await this.contract.estimateGas.executeArbitrage(params);
        const multiplierBps = Math.round(config.execution.gasLimitMultiplier * 10_000);
        gasLimit = gasLimit.mul(multiplierBps).div(10_000);
      } catch (err) {
        logger.error('Gas estimation failed', err);
        return { success: false, error: 'Gas estimation failed - transaction likely reverts' };
      }

      const feeData = await this.provider.getFeeData();
      const txOptions: Record<string, BigNumber> = {
        gasLimit,
      };

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        txOptions.maxFeePerGas = feeData.maxFeePerGas;
        txOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(120).div(100); // 20% boost for inclusion
      } else if (gasPrice) {
        txOptions.gasPrice = gasPrice.mul(120).div(100);
      }

      const tx = await this.contract.executeArbitrage(params, txOptions);
      logger.info(`📝 Sent transaction ${tx.hash}, awaiting confirmation...`);

      const receipt = await tx.wait(1);
      if (receipt.status !== 1) {
        logger.error('❌ Transaction reverted');
        return { success: false, txHash: receipt.transactionHash, error: 'Transaction reverted' };
      }

      logger.info('✅ Transaction confirmed');
      return {
        success: true,
        txHash: receipt.transactionHash,
        profit: profitUsd,
      };
    } catch (error: any) {
      logger.error('Execution failed', error);
      return {
        success: false,
        error: error.message || 'Unknown execution error',
      };
    }
  }

  private async simulateOpportunity(opportunity: ArbitrageOpportunity): Promise<{
    success: boolean;
    outputs: BigNumber[];
    profitTokenAmount: BigNumber;
    error?: string;
  }> {
    let currentAmount = opportunity.borrowAmount;
    const outputs: BigNumber[] = [];

    for (const leg of opportunity.legs) {
      if (currentAmount.lte(0)) {
        return {
          success: false,
          outputs,
          profitTokenAmount: BigNumber.from(0),
          error: 'Invalid input amount',
        };
      }
      const amountOut = await this.priceScanner.quoteSwap(
        leg.dex,
        leg.fromToken,
        leg.toToken,
        currentAmount,
        leg.feeBps
      );
      if (!amountOut || amountOut.lte(0)) {
        return {
          success: false,
          outputs,
          profitTokenAmount: BigNumber.from(0),
          error: `Failed to get quote for leg ${leg.fromToken.symbol}->${leg.toToken.symbol} on ${leg.dex}`,
        };
      }
      outputs.push(amountOut);
      currentAmount = amountOut;
    }

    const profitTokenAmount = currentAmount.sub(opportunity.borrowAmount);
    if (profitTokenAmount.lte(0)) {
      return {
        success: false,
        outputs,
        profitTokenAmount,
        error: 'No profit after re-verification',
      };
    }

    return {
      success: true,
      outputs,
      profitTokenAmount,
    };
  }

  private buildContractParams(opportunity: ArbitrageOpportunity, outputs: BigNumber[]) {
    const toleranceBps = config.execution.reverifyToleranceBps;
    const rawProfit = outputs[outputs.length - 1].sub(opportunity.borrowAmount);
    const minProfitAmount = rawProfit.gt(0)
      ? rawProfit.mul(BigNumber.from(10_000 - toleranceBps)).div(10_000)
      : BigNumber.from(0);

    const legs = opportunity.legs.map((leg, idx) => {
      const amountOut = outputs[idx];
      const minAmountOut = amountOut.mul(BigNumber.from(10_000 - toleranceBps)).div(10_000);
      return {
        dexType: dexTypeToCode(leg.dex),
        pool: leg.poolAddress,
        tokenIn: leg.fromToken.address,
        tokenOut: leg.toToken.address,
        fee: leg.feeBps ?? 0,
        minAmountOut,
      };
    });

    return {
      loanToken: opportunity.borrowToken.address,
      loanAmount: opportunity.borrowAmount,
      minProfit: minProfitAmount,
      deadline: Math.floor(Date.now() / 1000) + config.execution.deadlineSeconds,
      legs,
    };
  }

  async checkBalance(): Promise<{ eth: string; ethValue: number }> {
    const balance = await this.wallet.getBalance();
    const eth = ethers.utils.formatEther(balance);
    return {
      eth,
      ethValue: parseFloat(eth),
    };
  }

  getWalletAddress(): string {
    return this.wallet.address;
  }
}
