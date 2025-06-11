// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockDeFiProtocol
 * @dev Mock DeFi protocol for testing investment strategies
 */
contract MockDeFiProtocol {
    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => uint256) public totalDeposits;
    
    uint256 public constant YIELD_RATE = 800; // 8% APY (800 basis points)
    uint256 public constant BASIS_POINTS = 10000;
    
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    
    function deposit(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][token] += amount;
        totalDeposits[token] += amount;
        
        emit Deposited(msg.sender, token, amount);
    }
    
    function withdraw(address token, uint256 amount) external {
        require(deposits[msg.sender][token] >= amount, "Insufficient balance");
        
        deposits[msg.sender][token] -= amount;
        totalDeposits[token] -= amount;
        
        // Calculate yield (simplified)
        uint256 yield = (amount * YIELD_RATE) / BASIS_POINTS / 365; // Daily yield
        
        IERC20(token).transfer(msg.sender, amount + yield);
        
        emit Withdrawn(msg.sender, token, amount + yield);
    }
    
    function getBalance(address user, address token) external view returns (uint256) {
        return deposits[user][token];
    }
    
    function getYield(address user, address token) external view returns (uint256) {
        uint256 balance = deposits[user][token];
        return (balance * YIELD_RATE) / BASIS_POINTS / 365;
    }
}