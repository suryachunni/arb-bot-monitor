// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Aave V3 Flash Loan Interface
interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

// Uniswap V3 Router Interface
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

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

// Uniswap V2 Router Interface
interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

contract FlashLoanArbitrage is Ownable, ReentrancyGuard {
    // Aave V3 Pool Address Provider on Arbitrum
    address public constant AAVE_POOL_PROVIDER = 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb;
    
    // Uniswap V3 Router on Arbitrum
    address public constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    // SushiSwap Router on Arbitrum
    address public constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    
    // Fee tiers for Uniswap V3
    uint24 public constant FEE_LOW = 500;     // 0.05%
    uint24 public constant FEE_MEDIUM = 3000; // 0.3%
    uint24 public constant FEE_HIGH = 10000;  // 1%
    
    uint256 public minProfitBasisPoints = 50; // 0.5% minimum profit
    address public profitReceiver;
    
    event ArbitrageExecuted(
        address indexed token,
        uint256 loanAmount,
        uint256 profit,
        address dexBuy,
        address dexSell
    );
    
    event FlashLoanReceived(address indexed asset, uint256 amount);
    event ProfitWithdrawn(address indexed token, uint256 amount);
    
    struct ArbitrageParams {
        address tokenBorrow;
        address tokenTarget;
        uint256 amountBorrow;
        address dexBuy;
        address dexSell;
        uint24 feeBuy;
        uint24 feeSell;
        uint256 minProfit;
        uint256 deadline;
    }
    
    constructor() {
        profitReceiver = msg.sender;
    }
    
    /**
     * @notice Execute flash loan arbitrage
     * @param params Arbitrage parameters
     */
    function executeArbitrage(ArbitrageParams calldata params) external onlyOwner nonReentrant {
        require(params.deadline >= block.timestamp, "Deadline expired");
        require(params.amountBorrow > 0, "Invalid loan amount");
        
        IPool pool = IPool(IPoolAddressesProvider(AAVE_POOL_PROVIDER).getPool());
        
        bytes memory data = abi.encode(params);
        
        pool.flashLoanSimple(
            address(this),
            params.tokenBorrow,
            params.amountBorrow,
            data,
            0
        );
    }
    
    /**
     * @notice Aave V3 flash loan callback
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(initiator == address(this), "Invalid initiator");
        require(
            msg.sender == IPoolAddressesProvider(AAVE_POOL_PROVIDER).getPool(),
            "Invalid caller"
        );
        
        emit FlashLoanReceived(asset, amount);
        
        ArbitrageParams memory arbParams = abi.decode(params, (ArbitrageParams));
        
        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));
        
        // Execute arbitrage
        _executeArbitrageLogic(arbParams, amount);
        
        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
        uint256 totalDebt = amount + premium;
        
        require(balanceAfter >= totalDebt, "Insufficient funds to repay");
        
        uint256 profit = balanceAfter - totalDebt;
        require(profit >= arbParams.minProfit, "Profit below minimum");
        
        // Approve Aave to take back the loan + premium
        IERC20(asset).approve(msg.sender, totalDebt);
        
        // Transfer profit to receiver
        if (profit > 0) {
            IERC20(asset).transfer(profitReceiver, profit);
        }
        
        emit ArbitrageExecuted(
            asset,
            amount,
            profit,
            arbParams.dexBuy,
            arbParams.dexSell
        );
        
        return true;
    }
    
    /**
     * @notice Execute arbitrage logic
     */
    function _executeArbitrageLogic(
        ArbitrageParams memory params,
        uint256 amount
    ) internal {
        // Step 1: Buy tokenTarget on first DEX
        uint256 amountOut = _swapOnDEX(
            params.dexBuy,
            params.tokenBorrow,
            params.tokenTarget,
            amount,
            params.feeBuy,
            0
        );
        
        // Step 2: Sell tokenTarget on second DEX
        _swapOnDEX(
            params.dexSell,
            params.tokenTarget,
            params.tokenBorrow,
            amountOut,
            params.feeSell,
            0
        );
    }
    
    /**
     * @notice Swap tokens on specified DEX
     */
    function _swapOnDEX(
        address dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee,
        uint256 minAmountOut
    ) internal returns (uint256) {
        IERC20(tokenIn).approve(dex, amountIn);
        
        if (dex == UNISWAP_V3_ROUTER) {
            return _swapOnUniswapV3(tokenIn, tokenOut, amountIn, fee, minAmountOut);
        } else {
            return _swapOnUniswapV2(dex, tokenIn, tokenOut, amountIn, minAmountOut);
        }
    }
    
    /**
     * @notice Swap on Uniswap V3
     */
    function _swapOnUniswapV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee,
        uint256 minAmountOut
    ) internal returns (uint256) {
        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        return ISwapRouter(UNISWAP_V3_ROUTER).exactInputSingle(swapParams);
    }
    
    /**
     * @notice Swap on Uniswap V2 compatible DEX (SushiSwap, Camelot)
     */
    function _swapOnUniswapV2(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint[] memory amounts = IUniswapV2Router02(router).swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp
        );
        
        return amounts[amounts.length - 1];
    }
    
    /**
     * @notice Set profit receiver
     */
    function setProfitReceiver(address _receiver) external onlyOwner {
        require(_receiver != address(0), "Invalid address");
        profitReceiver = _receiver;
    }
    
    /**
     * @notice Set minimum profit basis points
     */
    function setMinProfitBasisPoints(uint256 _basisPoints) external onlyOwner {
        minProfitBasisPoints = _basisPoints;
    }
    
    /**
     * @notice Emergency withdraw tokens
     */
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner(), balance);
        }
    }
    
    /**
     * @notice Emergency withdraw ETH
     */
    function emergencyWithdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    receive() external payable {}
}
