// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
    ) external returns (uint256[] memory amounts);
}

contract FlashLoanArbitrage is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum DexType {
        UniswapV3,
        UniswapV2,
        Balancer,
        Curve
    }

    struct SwapLeg {
        uint8 dexType;
        address pool;
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 minAmountOut;
    }

    struct ExecuteParams {
        address loanToken;
        uint256 loanAmount;
        uint256 minProfit;
        uint256 deadline;
        SwapLeg[] legs;
    }

    address public constant AAVE_POOL_PROVIDER = 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb;
    address public constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address public constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;

    address public profitReceiver;

    event ArbitrageExecuted(address indexed token, uint256 loanAmount, uint256 profit);
    event ProfitReceiverUpdated(address indexed receiver);

    constructor() {
        profitReceiver = msg.sender;
    }

    function executeArbitrage(ExecuteParams calldata params) external onlyOwner nonReentrant {
        require(params.legs.length > 0, "no legs");
        require(params.deadline >= block.timestamp, "deadline");
        require(params.loanAmount > 0, "invalid loan");
        require(params.legs[0].tokenIn == params.loanToken, "first leg token");
        require(params.legs[params.legs.length - 1].tokenOut == params.loanToken, "last leg token");

        IPool pool = IPool(IPoolAddressesProvider(AAVE_POOL_PROVIDER).getPool());
        bytes memory data = abi.encode(msg.sender, params);

        pool.flashLoanSimple(
            address(this),
            params.loanToken,
            params.loanAmount,
            data,
            0
        );
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(initiator == address(this), "initiator");
        require(msg.sender == IPoolAddressesProvider(AAVE_POOL_PROVIDER).getPool(), "pool");

        (, ExecuteParams memory execParams) = abi.decode(params, (address, ExecuteParams));

        _executeSwapSequence(execParams);

        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
        uint256 totalDebt = amount + premium;
        require(balanceAfter >= totalDebt, "repay");

        uint256 profit = balanceAfter - totalDebt;
        require(profit >= execParams.minProfit, "profit");

        IERC20(asset).safeApprove(msg.sender, 0);
        IERC20(asset).safeApprove(msg.sender, totalDebt);

        if (profit > 0) {
            IERC20(asset).safeTransfer(profitReceiver, profit);
        }

        emit ArbitrageExecuted(asset, amount, profit);
        return true;
    }

    function setProfitReceiver(address receiver) external onlyOwner {
        require(receiver != address(0), "zero");
        profitReceiver = receiver;
        emit ProfitReceiverUpdated(receiver);
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function emergencyWithdrawETH(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }

    function _executeSwapSequence(ExecuteParams memory params) internal {
        uint256 currentAmount = params.loanAmount;

        for (uint256 i = 0; i < params.legs.length; i++) {
            SwapLeg memory leg = params.legs[i];
            require(leg.tokenIn != address(0) && leg.tokenOut != address(0), "invalid tokens");

            if (i > 0) {
                require(leg.tokenIn == params.legs[i - 1].tokenOut, "path continuity");
            }

            currentAmount = _executeLeg(leg, currentAmount);
            require(currentAmount >= leg.minAmountOut, "slippage");
        }
    }

    function _executeLeg(SwapLeg memory leg, uint256 amountIn) internal returns (uint256) {
        IERC20(leg.tokenIn).safeApprove(_routerForDex(leg.dexType), 0);
        IERC20(leg.tokenIn).safeApprove(_routerForDex(leg.dexType), amountIn);

        if (DexType(leg.dexType) == DexType.UniswapV3) {
            ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
                tokenIn: leg.tokenIn,
                tokenOut: leg.tokenOut,
                fee: leg.fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: leg.minAmountOut,
                sqrtPriceLimitX96: 0
            });
            return ISwapRouter(UNISWAP_V3_ROUTER).exactInputSingle(swapParams);
        }

        if (DexType(leg.dexType) == DexType.UniswapV2) {
            address[] memory path = new address[](2);
            path[0] = leg.tokenIn;
            path[1] = leg.tokenOut;

            uint256[] memory amounts = IUniswapV2Router02(SUSHISWAP_ROUTER).swapExactTokensForTokens(
                amountIn,
                leg.minAmountOut,
                path,
                address(this),
                block.timestamp
            );
            return amounts[amounts.length - 1];
        }

        revert("dex unsupported");
    }

    function _routerForDex(uint8 dexType) internal pure returns (address) {
        if (DexType(dexType) == DexType.UniswapV3) {
            return UNISWAP_V3_ROUTER;
        }
        if (DexType(dexType) == DexType.UniswapV2) {
            return SUSHISWAP_ROUTER;
        }
        revert("router");
    }

    receive() external payable {}
}
