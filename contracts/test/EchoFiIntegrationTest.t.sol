// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/EchoFiFactory.sol";
import "../src/EchoFiTreasury.sol";
import "../src/AgentExecutor.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockWETH.sol";
import "../src/mocks/MockDeFiProtocol.sol";

contract EchoFiIntegrationTest is Test {
    EchoFiFactory public factory;
    MockUSDC public usdc;
    MockWETH public weth;
    MockDeFiProtocol public defiProtocol;
    AgentExecutor public executor;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    function setUp() public {
        factory = new EchoFiFactory();
        usdc = new MockUSDC();
        weth = new MockWETH();
        defiProtocol = new MockDeFiProtocol();
        executor = new AgentExecutor(address(factory));
    }
    
    function testCreateGroup() public {
        EchoFiTreasury.GroupConfig memory config = EchoFiTreasury.GroupConfig({
            xmtpGroupId: "test-xmtp-group",
            minVotingPower: 1,
            votingDuration: 7 days,
            executionDelay: 1 hours,
            quorumPercentage: 51,
            autoExecute: true,
            maxProposalAmount: 100000 * 10**6
        });
        
        address treasury = factory.createGroup(
            "test-group-1",
            "test-xmtp-group",
            "test-creator-xmtp",
            config
        );
        
        assertNotEq(treasury, address(0));
    }
    
    function testFundAccounts() public {
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = charlie;
        
        for (uint i = 0; i < accounts.length; i++) {
            usdc.mint(accounts[i], 50000 * 10**6);
            weth.mint(accounts[i], 25 * 10**18);
            
            assertEq(usdc.balanceOf(accounts[i]), 50000 * 10**6);
            assertEq(weth.balanceOf(accounts[i]), 25 * 10**18);
        }
    }
    
    function testDeFiProtocolDeposit() public {
        uint256 depositAmount = 1000 * 10**6; // 1000 USDC
        
        usdc.mint(alice, depositAmount);
        
        vm.startPrank(alice);
        usdc.approve(address(defiProtocol), depositAmount);
        defiProtocol.deposit(address(usdc), depositAmount);
        vm.stopPrank();
        
        assertEq(defiProtocol.getBalance(alice, address(usdc)), depositAmount);
    }
}