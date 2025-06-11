// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


/**
 * @title MockWETH
 * @dev Mock WETH token for testing
 */
contract MockWETH is ERC20, Ownable {
    constructor() ERC20("Mock Wrapped Ether", "WETH") Ownable(msg.sender) {
        _mint(msg.sender, 1000 * 10**18); // 1000 WETH
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function faucet() external {
        _mint(msg.sender, 10 * 10**18); // 10 WETH per call
    }

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }
}