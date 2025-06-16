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
    address public owner = makeAddr("owner");

    // Mock aUSDC address for testing
    address public constant MOCK_AUSDC = address(0x123456789);

    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy mock tokens first
        usdc = new MockUSDC();
        weth = new MockWETH();
        defiProtocol = new MockDeFiProtocol();
        
        // FIXED: Pass required constructor arguments to EchoFiFactory
        factory = new EchoFiFactory(MOCK_AUSDC, owner);
        
        executor = new AgentExecutor(address(factory));
        
        vm.stopPrank();
    }
    
    function testCreateGroup() public {
        vm.startPrank(alice);
        
        EchoFiTreasury.GroupConfig memory config = EchoFiTreasury.GroupConfig({
            xmtpGroupId: "test-xmtp-group",
            minVotingPower: 1,
            votingDuration: 7 days,
            executionDelay: 1 hours,
            quorumPercentage: 51,
            autoExecute: true,
            maxProposalAmount: 100000 * 10**6
        });
        
        // Provide the creation fee
        vm.deal(alice, 1 ether);
        
        address treasury = factory.createGroup{value: 0.001 ether}(
            "test-group-1",
            "test-xmtp-group",
            "test-creator-xmtp",
            config
        );
        
        assertNotEq(treasury, address(0));
        vm.stopPrank();
    }
    
    function testFundAccounts() public {
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = charlie;
        vm.startPrank(owner);
        for (uint i = 0; i < accounts.length; i++) {
            usdc.mint(accounts[i], 50000 * 10**6);
            weth.mint(accounts[i], 25 * 10**18);
            
            assertEq(usdc.balanceOf(accounts[i]), 50000 * 10**6);
            assertEq(weth.balanceOf(accounts[i]), 25 * 10**18);
        }
        vm.stopPrank();
    }
    
    function testDeFiProtocolDeposit() public {
        uint256 depositAmount = 1000 * 10**6; // 1000 USDC
        
        vm.startPrank(owner);
        usdc.mint(alice, depositAmount);
        vm.stopPrank();
        
        vm.startPrank(alice);
        usdc.approve(address(defiProtocol), depositAmount);
        defiProtocol.deposit(address(usdc), depositAmount);
        vm.stopPrank();
        
        assertEq(defiProtocol.getBalance(alice, address(usdc)), depositAmount);
    }
}