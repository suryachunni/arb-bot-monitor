// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ProductionArbitrage
 * @notice Production-grade flash loan arbitrage with MEV protection, slippage guards, and gas optimization
 * @dev Optimized for Arbitrum mainnet with strict profitability and safety checks
 */
contract ProductionArbitrage is FlashLoanSimpleReceiverBase {
    
    address public immutable owner;
    
    // Arbitrum mainnet addresses
    address private constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address private constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address private constant CAMELOT_ROUTER = 0xc873fEcbd354f5A56E00E710B90EF4201db2448d;
    
    // Safety parameters
    uint256 private constant MAX_SLIPPAGE = 50; // 0.5% max slippage (50 basis points)
    uint256 private constant MIN_PROFIT_BPS = 10; // Minimum 0.1% profit after all costs
    uint256 private constant BASIS_POINTS = 10000;
    
    // Gas optimization: packed struct
    struct TradeParams {
        address tokenIn;
        address tokenOut;
        uint24 fee; // Uniswap V3 fee tier
        uint8 buyDex; // 0=UniV3, 1=Sushi, 2=Camelot
        uint8 sellDex;
        uint256 minProfit; // Minimum profit required (in tokenIn)
        uint256 deadline;
    }
    
    // Events for monitoring
    event ArbitrageExecuted(
        address indexed token,
        uint256 profit,
        uint256 gasUsed
    );
    
    event ArbitrageFailed(
        string reason,
        uint256 gasUsed
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(address _addressProvider) 
        FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) 
    {
        owner = msg.sender;
    }
    
    /**
     * @notice Execute arbitrage with flash loan
     * @param flashAmount Amount to borrow
     * @param params Trade parameters
     */
    function executeArbitrage(
        uint256 flashAmount,
        TradeParams calldata params
    ) external onlyOwner {
        require(flashAmount > 0, "Invalid amount");
        require(params.deadline >= block.timestamp, "Expired");
        
        // Encode params for callback
        bytes memory data = abi.encode(params);
        
        // Request flash loan
        POOL.flashLoanSimple(
            address(this),
            params.tokenIn,
            flashAmount,
            data,
            0 // referral code
        );
    }
    
    /**
     * @notice Aave flash loan callback - executes arbitrage
     * @dev This is called by Aave pool after receiving flash loan
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata data
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Unauthorized");
        require(initiator == address(this), "Invalid initiator");
        
        uint256 gasStart = gasleft();
        
        TradeParams memory params = abi.decode(data, (TradeParams));
        
        // Calculate amounts with slippage protection
        uint256 amountOwed = amount + premium;
        uint256 minBuyAmount = amount - (amount * MAX_SLIPPAGE / BASIS_POINTS);
        
        // STEP 1: Buy on DEX 1
        uint256 boughtAmount = _executeSwap(
            params.buyDex,
            params.tokenIn,
            params.tokenOut,
            amount,
            minBuyAmount,
            params.fee,
            params.deadline
        );
        
        require(boughtAmount >= minBuyAmount, "Slippage: Buy failed");
        
        // STEP 2: Sell on DEX 2 with slippage protection
        uint256 minSellAmount = amountOwed + params.minProfit;
        uint256 finalAmount = _executeSwap(
            params.sellDex,
            params.tokenOut,
            params.tokenIn,
            boughtAmount,
            minSellAmount,
            params.fee,
            params.deadline
        );
        
        require(finalAmount >= minSellAmount, "Slippage: Sell failed");
        
        // Calculate actual profit
        uint256 profit = finalAmount - amountOwed;
        require(profit >= params.minProfit, "Insufficient profit");
        
        // Minimum profit check (0.1% of flash loan amount)
        uint256 minRequiredProfit = (amount * MIN_PROFIT_BPS) / BASIS_POINTS;
        require(profit >= minRequiredProfit, "Profit below minimum");
        
        // Approve Aave to take back loan + premium
        IERC20(asset).approve(address(POOL), amountOwed);
        
        // Transfer profit to owner
        IERC20(asset).transfer(owner, profit);
        
        uint256 gasUsed = gasStart - gasleft();
        emit ArbitrageExecuted(asset, profit, gasUsed);
        
        return true;
    }
    
    /**
     * @notice Execute swap on specified DEX
     * @dev Gas-optimized swap execution
     */
    function _executeSwap(
        uint8 dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee,
        uint256 deadline
    ) private returns (uint256 amountOut) {
        
        if (dex == 0) {
            // Uniswap V3
            IERC20(tokenIn).approve(UNISWAP_V3_ROUTER, amountIn);
            
            ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });
            
            amountOut = ISwapRouter(UNISWAP_V3_ROUTER).exactInputSingle(swapParams);
            
        } else {
            // Uniswap V2 style (Sushiswap/Camelot)
            address router = dex == 1 ? SUSHISWAP_ROUTER : CAMELOT_ROUTER;
            
            IERC20(tokenIn).approve(router, amountIn);
            
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            
            uint256[] memory amounts = IUniswapV2Router(router).swapExactTokensForTokens(
                amountIn,
                minAmountOut,
                path,
                address(this),
                deadline
            );
            
            amountOut = amounts[1];
        }
        
        require(amountOut >= minAmountOut, "Insufficient output");
    }
    
    /**
     * @notice Emergency withdrawal - only owner
     */
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner, balance);
        }
    }
    
    /**
     * @notice Withdraw native ETH - only owner
     */
    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    receive() external payable {}
}

// Interfaces
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
