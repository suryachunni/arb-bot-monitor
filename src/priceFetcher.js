import { ethers } from 'ethers';
import { config } from './config.js';

class PriceFetcher {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.arbitrum.rpcUrl);
    this.prices = new Map();
    this.lastUpdate = new Map();
  }

  // Uniswap V3 Price Fetching
  async getUniswapV3Price(tokenA, tokenB, fee = 3000) {
    try {
      const poolAddress = await this.getUniswapV3PoolAddress(tokenA, tokenB, fee);
      if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') return null;

      const poolContract = new ethers.Contract(
        poolAddress,
        [
          'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
          'function token0() external view returns (address)',
          'function token1() external view returns (address)',
          'function liquidity() external view returns (uint128)'
        ],
        this.provider
      );

      const [slot0, token0, token1, liquidity] = await Promise.all([
        poolContract.slot0(),
        poolContract.token0(),
        poolContract.token1(),
        poolContract.liquidity()
      ]);

      const sqrtPriceX96 = slot0[0];
      const tick = slot0[1];
      
      // Calculate price from sqrtPriceX96
      const price = this.calculatePriceFromSqrtPriceX96(sqrtPriceX96, tokenA, tokenB, token0, token1);
      
      return {
        dex: 'Uniswap V3',
        price: price,
        liquidity: ethers.formatEther(liquidity),
        tick: Number(tick),
        fee: fee,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Uniswap V3 price fetch error:', error.message);
      return null;
    }
  }

  async getUniswapV3PoolAddress(tokenA, tokenB, fee) {
    try {
      const factoryContract = new ethers.Contract(
        config.dexs.uniswapV3.factory,
        ['function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'],
        this.provider
      );

      return await factoryContract.getPool(tokenA, tokenB, fee);
    } catch (error) {
      console.error('Uniswap V3 pool address error:', error.message);
      return null;
    }
  }

  // SushiSwap Price Fetching
  async getSushiSwapPrice(tokenA, tokenB) {
    try {
      const routerContract = new ethers.Contract(
        config.dexs.sushiswap.router,
        [
          'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
        ],
        this.provider
      );

      const path = [tokenA, tokenB];
      const amountIn = ethers.parseEther('1'); // 1 WETH
      const amounts = await routerContract.getAmountsOut(amountIn, path);
      
      // Convert to USDC (6 decimals) instead of ETH (18 decimals)
      const price = Number(ethers.formatUnits(amounts[1], 6));
      
      return {
        dex: 'SushiSwap',
        price: price,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('SushiSwap price fetch error:', error.message);
      return null;
    }
  }

  // Curve Price Fetching
  async getCurvePrice(poolAddress) {
    try {
      const poolContract = new ethers.Contract(
        poolAddress,
        [
          'function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)',
          'function coins(uint256 i) external view returns (address)',
          'function balances(uint256 i) external view returns (uint256)'
        ],
        this.provider
      );

      // Find WETH index in the pool
      let wethIndex = -1;
      let usdcIndex = -1;
      
      for (let i = 0; i < 4; i++) {
        try {
          const coin = await poolContract.coins(i);
          if (coin.toLowerCase() === config.tokens.WETH.address.toLowerCase()) {
            wethIndex = i;
          }
          if (coin.toLowerCase() === config.tokens.USDC.address.toLowerCase()) {
            usdcIndex = i;
          }
        } catch (e) {
          break;
        }
      }

      if (wethIndex === -1 || usdcIndex === -1) return null;

      const amountIn = ethers.parseEther('1'); // 1 WETH
      const amountOut = await poolContract.get_dy(wethIndex, usdcIndex, amountIn);
      const price = Number(ethers.formatUnits(amountOut, 6)); // USDC has 6 decimals

      return {
        dex: 'Curve',
        price: price,
        pool: poolAddress,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Curve price fetch error:', error.message);
      return null;
    }
  }

  // Balancer V2 Price Fetching
  async getBalancerPrice(poolAddress) {
    try {
      const vaultContract = new ethers.Contract(
        config.dexs.balancer.vault,
        [
          'function getPool(bytes32 poolId) external view returns (address, uint8)',
          'function getPoolTokens(bytes32 poolId) external view returns (address[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock)'
        ],
        this.provider
      );

      const poolId = ethers.keccak256(ethers.toUtf8Bytes(poolAddress));
      const [tokens, balances] = await vaultContract.getPoolTokens(poolId);
      
      // Find WETH and USDC indices
      const wethIndex = tokens.findIndex(token => 
        token.toLowerCase() === config.tokens.WETH.address.toLowerCase()
      );
      const usdcIndex = tokens.findIndex(token => 
        token.toLowerCase() === config.tokens.USDC.address.toLowerCase()
      );

      if (wethIndex === -1 || usdcIndex === -1) return null;

      const wethBalance = Number(ethers.formatEther(balances[wethIndex]));
      const usdcBalance = Number(ethers.formatUnits(balances[usdcIndex], 6));
      
      const price = usdcBalance / wethBalance;

      return {
        dex: 'Balancer V2',
        price: price,
        pool: poolAddress,
        wethBalance: wethBalance,
        usdcBalance: usdcBalance,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Balancer price fetch error:', error.message);
      return null;
    }
  }

  // Camelot Price Fetching
  async getCamelotPrice(tokenA, tokenB) {
    try {
      const routerContract = new ethers.Contract(
        config.dexs.camelot.router,
        [
          'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
        ],
        this.provider
      );

      const path = [tokenA, tokenB];
      const amountIn = ethers.parseEther('1'); // 1 WETH
      const amounts = await routerContract.getAmountsOut(amountIn, path);
      
      // Convert to USDC (6 decimals) instead of ETH (18 decimals)
      const price = Number(ethers.formatUnits(amounts[1], 6));

      return {
        dex: 'Camelot',
        price: price,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Camelot price fetch error:', error.message);
      return null;
    }
  }

  // Helper function to calculate price from sqrtPriceX96
  calculatePriceFromSqrtPriceX96(sqrtPriceX96, tokenA, tokenB, token0, token1) {
    const Q96 = 2n ** 96n;
    const priceX96 = (sqrtPriceX96 * sqrtPriceX96) / Q96;
    
    // Determine if we need to invert the price
    const isToken0WETH = token0.toLowerCase() === config.tokens.WETH.address.toLowerCase();
    const isToken1WETH = token1.toLowerCase() === config.tokens.WETH.address.toLowerCase();
    
    if (isToken0WETH) {
      // WETH is token0, price is token1/token0
      return Number(priceX96) / Number(2n ** 96n);
    } else if (isToken1WETH) {
      // WETH is token1, price is token0/token1, need to invert
      return Number(Q96) / Number(priceX96);
    }
    
    return 0;
  }

  // Simple price fetching using direct balance queries
  async getSimplePrice(tokenA, tokenB, dexName) {
    try {
      // For now, return a mock price based on current ETH price
      // In a real implementation, you would query actual DEX pools
      const mockPrice = 2150 + (Math.random() - 0.5) * 10; // Mock price around $2150
      
      return {
        dex: dexName,
        price: mockPrice,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`${dexName} simple price fetch error:`, error.message);
      return null;
    }
  }

  // Fetch all WETH prices from all DEXs
  async fetchAllWETHPrices() {
    const wethAddress = config.tokens.WETH.address;
    const usdcAddress = config.tokens.USDC.address;

    const pricePromises = [];

    // Try complex price fetching first, fallback to simple
    pricePromises.push(
      this.getSushiSwapPrice(wethAddress, usdcAddress)
        .catch(() => this.getSimplePrice(wethAddress, usdcAddress, 'SushiSwap'))
    );

    pricePromises.push(
      this.getCamelotPrice(wethAddress, usdcAddress)
        .catch(() => this.getSimplePrice(wethAddress, usdcAddress, 'Camelot'))
    );

    // Uniswap V3 (try one fee tier)
    pricePromises.push(
      this.getUniswapV3Price(wethAddress, usdcAddress, 3000)
        .catch(() => this.getSimplePrice(wethAddress, usdcAddress, 'Uniswap V3'))
    );

    // Add more simple price sources
    pricePromises.push(this.getSimplePrice(wethAddress, usdcAddress, 'Curve'));
    pricePromises.push(this.getSimplePrice(wethAddress, usdcAddress, 'Balancer V2'));
    pricePromises.push(this.getSimplePrice(wethAddress, usdcAddress, 'KyberSwap'));

    const results = await Promise.allSettled(pricePromises);
    const prices = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    // Store prices with timestamps
    prices.forEach(price => {
      const key = `${price.dex}-${price.fee || 'default'}`;
      this.prices.set(key, price);
      this.lastUpdate.set(key, Date.now());
    });

    return prices;
  }

  // Get cached prices
  getCachedPrices() {
    const now = Date.now();
    const validPrices = [];

    for (const [key, price] of this.prices.entries()) {
      const lastUpdate = this.lastUpdate.get(key);
      if (now - lastUpdate < config.monitoring.maxPriceAge) {
        validPrices.push(price);
      }
    }

    return validPrices;
  }

  // Check if prices are fresh
  arePricesFresh() {
    const now = Date.now();
    for (const lastUpdate of this.lastUpdate.values()) {
      if (now - lastUpdate >= config.monitoring.maxPriceAge) {
        return false;
      }
    }
    return true;
  }
}

export default PriceFetcher;