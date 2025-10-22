// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

/**
 * @title FlashLoanArbitrage
 * @notice Executes flash loan arbitrage on Arbitrum
 * @dev Takes flash loan from Aave V3, executes arbitrage, repays loan, sends profit
 */
contract FlashLoanArbitrage is FlashLoanSimpleReceiverBase {
    address public owner;
    
    // Arbitrum mainnet addresses
    ISwapRouter public constant UNISWAP_V3_ROUTER = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IUniswapV2Router02 public constant SUSHISWAP_ROUTER = IUniswapV2Router02(0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506);
    IUniswapV2Router02 public constant CAMELOT_ROUTER = IUniswapV2Router02(0xc873fEcbd354f5A56E00E710B90EF4201db2448d);
    
    // Aave V3 Pool on Arbitrum
    address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    
    enum DEX {
        UNISWAP_V3,
        SUSHISWAP,
        CAMELOT
    }
    
    struct ArbitrageParams {
        address tokenIn;
        address tokenOut;
        DEX buyDex;
        DEX sellDex;
        uint24 buyFee;    // For Uniswap V3 (3000 = 0.3%)
        uint24 sellFee;   // For Uniswap V3
        uint256 minProfit; // Minimum profit in wei
    }
    
    event ArbitrageExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 profit,
        uint256 timestamp
    );
    
    event EmergencyWithdraw(address token, uint256 amount);
    
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
     * @notice Execute flash loan arbitrage
     * @param flashLoanAmount Amount to borrow
     * @param params Arbitrage parameters
     */
    function executeArbitrage(
        uint256 flashLoanAmount,
        ArbitrageParams memory params
    ) external onlyOwner {
        // Request flash loan from Aave
        POOL.flashLoanSimple(
            address(this),
            params.tokenIn,
            flashLoanAmount,
            abi.encode(params),
            0 // referral code
        );
    }
    
    /**
     * @notice Called by Aave after flash loan is received
     * @dev This is where the arbitrage logic executes
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Unauthorized");
        require(initiator == address(this), "Invalid initiator");
        
        ArbitrageParams memory arbParams = abi.decode(params, (ArbitrageParams));
        
        // Step 1: Buy on cheaper DEX
        uint256 amountOut = _swap(
            arbParams.tokenIn,
            arbParams.tokenOut,
            amount,
            arbParams.buyDex,
            arbParams.buyFee
        );
        
        // Step 2: Sell on more expensive DEX
        uint256 finalAmount = _swap(
            arbParams.tokenOut,
            arbParams.tokenIn,
            amountOut,
            arbParams.sellDex,
            arbParams.sellFee
        );
        
        // Step 3: Calculate profit
        uint256 amountOwed = amount + premium;
        require(finalAmount > amountOwed, "No profit");
        
        uint256 profit = finalAmount - amountOwed;
        require(profit >= arbParams.minProfit, "Profit too low");
        
        // Step 4: Approve repayment to Aave
        IERC20(asset).approve(address(POOL), amountOwed);
        
        // Step 5: Send profit to owner
        IERC20(asset).transfer(owner, profit);
        
        emit ArbitrageExecuted(arbParams.tokenIn, arbParams.tokenOut, profit, block.timestamp);
        
        return true;
    }
    
    /**
     * @notice Internal swap function
     */
    function _swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        DEX dex,
        uint24 fee
    ) internal returns (uint256 amountOut) {
        if (dex == DEX.UNISWAP_V3) {
            return _swapUniswapV3(tokenIn, tokenOut, amountIn, fee);
        } else if (dex == DEX.SUSHISWAP) {
            return _swapUniswapV2(tokenIn, tokenOut, amountIn, address(SUSHISWAP_ROUTER));
        } else {
            return _swapUniswapV2(tokenIn, tokenOut, amountIn, address(CAMELOT_ROUTER));
        }
    }
    
    /**
     * @notice Swap on Uniswap V3
     */
    function _swapUniswapV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee
    ) internal returns (uint256 amountOut) {
        IERC20(tokenIn).approve(address(UNISWAP_V3_ROUTER), amountIn);
        
        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0, // In production, calculate from price oracle
            sqrtPriceLimitX96: 0
        });
        
        amountOut = UNISWAP_V3_ROUTER.exactInputSingle(swapParams);
    }
    
    /**
     * @notice Swap on Uniswap V2 style DEX (Sushiswap/Camelot)
     */
    function _swapUniswapV2(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address router
    ) internal returns (uint256 amountOut) {
        IERC20(tokenIn).approve(router, amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = IUniswapV2Router02(router).swapExactTokensForTokens(
            amountIn,
            0, // In production, calculate from price oracle
            path,
            address(this),
            block.timestamp
        );
        
        amountOut = amounts[amounts.length - 1];
    }
    
    /**
     * @notice Emergency withdraw - only owner can call
     */
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance");
        
        IERC20(token).transfer(owner, balance);
        emit EmergencyWithdraw(token, balance);
    }
    
    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
