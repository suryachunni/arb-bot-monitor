// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FlashLoanArbitrageV2
 * @notice Production-grade flash loan arbitrage contract with comprehensive safety features
 * @dev Implements Aave V3 flash loans with multi-DEX support and slippage protection
 */

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

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

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);
}

interface IBalancerVault {
    enum SwapKind { GIVEN_IN, GIVEN_OUT }
    
    struct SingleSwap {
        bytes32 poolId;
        SwapKind kind;
        address assetIn;
        address assetOut;
        uint256 amount;
        bytes userData;
    }
    
    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address payable recipient;
        bool toInternalBalance;
    }
    
    function swap(
        SingleSwap memory singleSwap,
        FundManagement memory funds,
        uint256 limit,
        uint256 deadline
    ) external returns (uint256);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN CONTRACT
// ═══════════════════════════════════════════════════════════════════

contract FlashLoanArbitrageV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════

    // Protocol addresses
    address public constant AAVE_POOL_PROVIDER = 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb;
    address public constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address public constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address public constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;

    // Configuration
    uint256 public minProfitBasisPoints = 50; // 0.5% minimum profit
    uint256 public maxSlippageBasisPoints = 50; // 0.5% max slippage
    address public profitReceiver;
    bool public emergencyStop;

    // Statistics
    uint256 public totalArbitragesExecuted;
    uint256 public totalProfitGenerated;
    uint256 public totalGasUsed;

    // ═══════════════════════════════════════════════════════════════
    // STRUCTS & ENUMS
    // ═══════════════════════════════════════════════════════════════

    enum DEXType { UNISWAP_V3, SUSHISWAP, BALANCER }

    struct ArbitrageParams {
        address tokenBorrow;
        address tokenTarget;
        uint256 amountBorrow;
        DEXType dexBuy;
        DEXType dexSell;
        bytes dexDataBuy;   // DEX-specific data (fee, poolId, etc.)
        bytes dexDataSell;
        uint256 minAmountOutBuy;   // ✅ SLIPPAGE PROTECTION
        uint256 minAmountOutSell;  // ✅ SLIPPAGE PROTECTION
        uint256 minProfit;
        uint256 estimatedGasCost;
        uint256 deadline;
    }

    struct SwapResult {
        uint256 amountOut;
        uint256 gasUsed;
        bool success;
    }

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════

    event FlashLoanInitiated(
        address indexed asset,
        uint256 amount,
        uint256 premium,
        uint256 timestamp
    );

    event SwapExecuted(
        DEXType indexed dex,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 gasUsed
    );

    event ArbitrageExecuted(
        address indexed tokenBorrow,
        address indexed tokenTarget,
        uint256 loanAmount,
        uint256 profit,
        uint256 totalGasUsed,
        DEXType dexBuy,
        DEXType dexSell,
        uint256 timestamp
    );

    event ArbitrageFailed(
        address indexed tokenBorrow,
        uint256 loanAmount,
        string reason,
        uint256 timestamp
    );

    event ProfitWithdrawn(
        address indexed token,
        address indexed receiver,
        uint256 amount,
        uint256 timestamp
    );

    event ConfigurationUpdated(
        uint256 minProfitBasisPoints,
        uint256 maxSlippageBasisPoints,
        address profitReceiver
    );

    event EmergencyStopToggled(bool stopped);

    // ═══════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════

    error DeadlineExpired();
    error InvalidLoanAmount();
    error InvalidInitiator();
    error InvalidCaller();
    error InsufficientFundsToRepay();
    error ProfitBelowMinimum(uint256 actual, uint256 required);
    error SlippageExceeded(uint256 actual, uint256 minimum);
    error InvalidDEXType();
    error EmergencyStopActive();
    error InvalidAddress();
    error SwapFailed(string reason);

    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor(address _profitReceiver) {
        if (_profitReceiver == address(0)) revert InvalidAddress();
        profitReceiver = _profitReceiver;
    }

    // ═══════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier whenNotStopped() {
        if (emergencyStop) revert EmergencyStopActive();
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    // MAIN EXECUTION FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Execute flash loan arbitrage with full validation
     * @param params Complete arbitrage parameters including slippage limits
     */
    function executeArbitrage(ArbitrageParams calldata params) 
        external 
        onlyOwner 
        nonReentrant 
        whenNotStopped 
    {
        // Input validation
        if (params.deadline < block.timestamp) revert DeadlineExpired();
        if (params.amountBorrow == 0) revert InvalidLoanAmount();
        if (params.minAmountOutBuy == 0 || params.minAmountOutSell == 0) {
            revert SlippageExceeded(0, 1);
        }

        // Get Aave pool
        IPool pool = IPool(IPoolAddressesProvider(AAVE_POOL_PROVIDER).getPool());

        // Encode parameters
        bytes memory data = abi.encode(params);

        // Initiate flash loan
        pool.flashLoanSimple(
            address(this),
            params.tokenBorrow,
            params.amountBorrow,
            data,
            0 // referralCode
        );
    }

    /**
     * @notice Aave V3 flash loan callback - executes arbitrage logic
     * @dev This function is called by Aave after transferring the flash loan
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        // Security checks
        if (initiator != address(this)) revert InvalidInitiator();
        if (msg.sender != IPoolAddressesProvider(AAVE_POOL_PROVIDER).getPool()) {
            revert InvalidCaller();
        }

        // Emit flash loan event
        emit FlashLoanInitiated(asset, amount, premium, block.timestamp);

        // Decode parameters
        ArbitrageParams memory arbParams = abi.decode(params, (ArbitrageParams));

        // Track gas
        uint256 gasStart = gasleft();

        try this._executeArbitrageLogic(arbParams, amount) returns (uint256 finalAmount) {
            // Calculate results
            uint256 totalDebt = amount + premium;
            
            // Check we have enough to repay
            if (finalAmount < totalDebt) {
                revert InsufficientFundsToRepay();
            }

            uint256 profit = finalAmount - totalDebt;
            
            // Check minimum profit threshold
            if (profit < arbParams.minProfit) {
                revert ProfitBelowMinimum(profit, arbParams.minProfit);
            }

            // Calculate gas used
            uint256 gasUsed = gasStart - gasleft();
            totalGasUsed += gasUsed;

            // Approve Aave to take repayment
            IERC20(asset).safeApprove(msg.sender, totalDebt);

            // Transfer profit to receiver
            if (profit > 0) {
                IERC20(asset).safeTransfer(profitReceiver, profit);
                totalProfitGenerated += profit;
            }

            // Update statistics
            totalArbitragesExecuted++;

            // Emit success event
            emit ArbitrageExecuted(
                arbParams.tokenBorrow,
                arbParams.tokenTarget,
                amount,
                profit,
                gasUsed,
                arbParams.dexBuy,
                arbParams.dexSell,
                block.timestamp
            );

            return true;

        } catch Error(string memory reason) {
            emit ArbitrageFailed(asset, amount, reason, block.timestamp);
            revert SwapFailed(reason);
        } catch (bytes memory) {
            emit ArbitrageFailed(asset, amount, "Unknown error", block.timestamp);
            revert SwapFailed("Unknown error in arbitrage execution");
        }
    }

    /**
     * @notice Execute the actual arbitrage swaps
     * @dev External function to enable try/catch error handling
     */
    function _executeArbitrageLogic(
        ArbitrageParams memory params,
        uint256 amount
    ) external returns (uint256) {
        // Only callable by this contract
        require(msg.sender == address(this), "Internal function");

        // Step 1: Buy tokenTarget on first DEX with slippage protection
        uint256 gasBeforeBuy = gasleft();
        uint256 amountOut = _swapOnDEX(
            params.dexBuy,
            params.tokenBorrow,
            params.tokenTarget,
            amount,
            params.dexDataBuy,
            params.minAmountOutBuy
        );
        uint256 gasBuy = gasBeforeBuy - gasleft();

        emit SwapExecuted(
            params.dexBuy,
            params.tokenBorrow,
            params.tokenTarget,
            amount,
            amountOut,
            gasBuy
        );

        // Verify slippage on first swap
        if (amountOut < params.minAmountOutBuy) {
            revert SlippageExceeded(amountOut, params.minAmountOutBuy);
        }

        // Step 2: Sell tokenTarget on second DEX with slippage protection
        uint256 gasBeforeSell = gasleft();
        uint256 finalAmount = _swapOnDEX(
            params.dexSell,
            params.tokenTarget,
            params.tokenBorrow,
            amountOut,
            params.dexDataSell,
            params.minAmountOutSell
        );
        uint256 gasSell = gasBeforeSell - gasleft();

        emit SwapExecuted(
            params.dexSell,
            params.tokenTarget,
            params.tokenBorrow,
            amountOut,
            finalAmount,
            gasSell
        );

        // Verify slippage on second swap
        if (finalAmount < params.minAmountOutSell) {
            revert SlippageExceeded(finalAmount, params.minAmountOutSell);
        }

        return finalAmount;
    }

    // ═══════════════════════════════════════════════════════════════
    // DEX SWAP FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Route swap to appropriate DEX
     */
    function _swapOnDEX(
        DEXType dexType,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes memory dexData,
        uint256 minAmountOut
    ) internal returns (uint256) {
        if (dexType == DEXType.UNISWAP_V3) {
            return _swapOnUniswapV3(tokenIn, tokenOut, amountIn, dexData, minAmountOut);
        } else if (dexType == DEXType.SUSHISWAP) {
            return _swapOnSushiSwap(tokenIn, tokenOut, amountIn, minAmountOut);
        } else if (dexType == DEXType.BALANCER) {
            return _swapOnBalancer(tokenIn, tokenOut, amountIn, dexData, minAmountOut);
        } else {
            revert InvalidDEXType();
        }
    }

    /**
     * @notice Swap on Uniswap V3
     */
    function _swapOnUniswapV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes memory dexData,
        uint256 minAmountOut
    ) internal returns (uint256) {
        uint24 fee = abi.decode(dexData, (uint24));

        IERC20(tokenIn).safeApprove(UNISWAP_V3_ROUTER, amountIn);

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
     * @notice Swap on SushiSwap (Uniswap V2 fork)
     */
    function _swapOnSushiSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256) {
        IERC20(tokenIn).safeApprove(SUSHISWAP_ROUTER, amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint[] memory amounts = IUniswapV2Router02(SUSHISWAP_ROUTER).swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp
        );

        return amounts[amounts.length - 1];
    }

    /**
     * @notice Swap on Balancer
     */
    function _swapOnBalancer(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes memory dexData,
        uint256 minAmountOut
    ) internal returns (uint256) {
        bytes32 poolId = abi.decode(dexData, (bytes32));

        IERC20(tokenIn).safeApprove(BALANCER_VAULT, amountIn);

        IBalancerVault.SingleSwap memory singleSwap = IBalancerVault.SingleSwap({
            poolId: poolId,
            kind: IBalancerVault.SwapKind.GIVEN_IN,
            assetIn: tokenIn,
            assetOut: tokenOut,
            amount: amountIn,
            userData: ""
        });

        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: payable(address(this)),
            toInternalBalance: false
        });

        return IBalancerVault(BALANCER_VAULT).swap(
            singleSwap,
            funds,
            minAmountOut,
            block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFIGURATION FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Update configuration parameters
     */
    function updateConfiguration(
        uint256 _minProfitBasisPoints,
        uint256 _maxSlippageBasisPoints,
        address _profitReceiver
    ) external onlyOwner {
        if (_profitReceiver == address(0)) revert InvalidAddress();
        
        minProfitBasisPoints = _minProfitBasisPoints;
        maxSlippageBasisPoints = _maxSlippageBasisPoints;
        profitReceiver = _profitReceiver;

        emit ConfigurationUpdated(_minProfitBasisPoints, _maxSlippageBasisPoints, _profitReceiver);
    }

    /**
     * @notice Toggle emergency stop
     */
    function toggleEmergencyStop() external onlyOwner {
        emergencyStop = !emergencyStop;
        emit EmergencyStopToggled(emergencyStop);
    }

    // ═══════════════════════════════════════════════════════════════
    // WITHDRAWAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Emergency withdraw tokens (only owner, only when stopped)
     */
    function emergencyWithdraw(address token) external onlyOwner {
        require(emergencyStop, "Emergency stop must be active");
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(owner(), balance);
            emit ProfitWithdrawn(token, owner(), balance, block.timestamp);
        }
    }

    /**
     * @notice Emergency withdraw ETH (only owner, only when stopped)
     */
    function emergencyWithdrawETH() external onlyOwner {
        require(emergencyStop, "Emergency stop must be active");
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner()).transfer(balance);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Get contract statistics
     */
    function getStatistics() external view returns (
        uint256 executed,
        uint256 profit,
        uint256 gasUsed,
        uint256 avgGasPerTrade
    ) {
        executed = totalArbitragesExecuted;
        profit = totalProfitGenerated;
        gasUsed = totalGasUsed;
        avgGasPerTrade = executed > 0 ? totalGasUsed / executed : 0;
    }

    /**
     * @notice Get current configuration
     */
    function getConfiguration() external view returns (
        uint256 minProfit,
        uint256 maxSlippage,
        address receiver,
        bool stopped
    ) {
        minProfit = minProfitBasisPoints;
        maxSlippage = maxSlippageBasisPoints;
        receiver = profitReceiver;
        stopped = emergencyStop;
    }

    // ═══════════════════════════════════════════════════════════════
    // FALLBACK
    // ═══════════════════════════════════════════════════════════════

    receive() external payable {}
}
