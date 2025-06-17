// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/EchoFiFactory.sol";
import "../src/EchoFiTreasury.sol";
import "../src/AgentExecutor.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockWETH.sol";
import "../src/mocks/MockDeFiProtocol.sol";

/**
 * @title EchoFiIntegrationTest - FIXED VERSION
 * @dev Integration tests for the complete EchoFi ecosystem
 * @notice Updated to match the optimized function signatures
 */
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
        
        // ✅ FIXED: Pass required constructor arguments to EchoFiFactory
        factory = new EchoFiFactory(MOCK_AUSDC, owner);
        
        executor = new AgentExecutor(address(factory));
        
        vm.stopPrank();
    }
    
    /**
     * @dev ✅ FIXED: Updated to match simplified createGroup function signature
     * @notice The function now only takes 2 parameters instead of 4
     */
    function testCreateGroup() public {
        vm.startPrank(alice);
        
        // ✅ REMOVED: GroupConfig is no longer needed since we simplified the function
        // The createGroup function now automatically creates a single-member treasury
        // that can be expanded later through proposals
        
        // Provide the creation fee
        vm.deal(alice, 1 ether);
        
        // ✅ FIXED: Call createGroup with only 2 arguments (name and xmtpGroupId)
        address treasury = factory.createGroup{value: 0.001 ether}(
            "test-group-1",
            "test-xmtp-group"
            // ✅ REMOVED: "test-creator-xmtp" parameter (was unused)
            // ✅ REMOVED: config parameter (was unused)
        );
        
        // Verify treasury was created successfully
        assertNotEq(treasury, address(0));
        
        // ✅ ENHANCED: Let's verify the treasury was set up correctly
        EchoFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(treasury);
        assertEq(info.creator, alice);
        assertEq(info.name, "test-group-1");
        assertEq(info.memberCount, 1); // Starts with just the creator
        assertEq(info.totalVotingPower, 100); // Creator has 100% initially
        assertTrue(info.isActive);
        
        // Verify alice is in the treasury's member list
        address[] memory aliceTreasuries = factory.getUserTreasuries(alice);
        assertEq(aliceTreasuries.length, 1);
        assertEq(aliceTreasuries[0], treasury);
        
        vm.stopPrank();
    }
    
    /**
     * @dev ✅ ENHANCED: Test creating multiple groups to verify factory functionality
     */
    function testCreateMultipleGroups() public {
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        
        // Alice creates first group
        vm.prank(alice);
        address treasury1 = factory.createGroup{value: 0.001 ether}(
            "alice-investment-group",
            "alice-xmtp-123"
        );
        
        // Bob creates second group
        vm.prank(bob);
        address treasury2 = factory.createGroup{value: 0.001 ether}(
            "bob-trading-group",
            "bob-xmtp-456"
        );
        
        // Verify both groups exist and are different
        assertTrue(treasury1 != treasury2);
        assertEq(factory.treasuryCount(), 2);
        
        // Verify creators are properly assigned
        EchoFiFactory.TreasuryInfo memory info1 = factory.getTreasuryInfo(treasury1);
        EchoFiFactory.TreasuryInfo memory info2 = factory.getTreasuryInfo(treasury2);
        
        assertEq(info1.creator, alice);
        assertEq(info2.creator, bob);
        assertEq(info1.name, "alice-investment-group");
        assertEq(info2.name, "bob-trading-group");
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
    
    /**
     * @dev ✅ NEW: Test complete workflow from group creation to proposal execution
     */
    function testCompleteWorkflow() public {
        // Setup: Fund alice and create group
        vm.deal(alice, 10 ether);
        vm.startPrank(owner);
        usdc.mint(alice, 100000 * 10**6); // 100k USDC
        vm.stopPrank();
        
        // Step 1: Create group
        vm.prank(alice);
        address treasuryAddress = factory.createGroup{value: 0.001 ether}(
            "integration-test-group",
            "integration-xmtp-789"
        );
        
        // Step 2: Fund the treasury
        vm.prank(alice);
        usdc.transfer(treasuryAddress, 50000 * 10**6); // Send 50k USDC to treasury
        
        // Step 3: Verify treasury received funds
        EchoFiTreasury treasury = EchoFiTreasury(treasuryAddress);
        (uint256 usdcBalance, uint256 aUsdcBalance) = treasury.getTreasuryBalance();
        assertEq(usdcBalance, 50000 * 10**6);
        assertEq(aUsdcBalance, 0);
        
        // Step 4: Create a proposal
        vm.prank(alice);
        uint256 proposalId = treasury.createProposal(
            EchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            20000 * 10**6, // 20k USDC
            address(0),
            "",
            "Deposit 20k USDC to Aave for yield generation"
        );
        
        // Step 5: Vote on proposal (alice has 100% voting power initially)
        vm.prank(alice);
        treasury.vote(proposalId, true);
        
        // Step 6: Fast forward to after voting period
        vm.warp(block.timestamp + 4 days);
        
        // Step 7: Execute proposal
        vm.prank(alice);
        treasury.executeProposal(proposalId);
        
        // Step 8: Verify proposal was executed
        (
            uint256 id,
            address proposer,
            EchoFiTreasury.ProposalType proposalType,
            uint256 amount,
            address target,
            bytes memory data,
            string memory description,
            uint256 votesFor,
            uint256 votesAgainst,
            uint256 deadline,
            bool executed,
            bool cancelled
        ) = treasury.getProposal(proposalId);
        
        assertTrue(executed);
        assertEq(proposer, alice);
        assertEq(amount, 20000 * 10**6);
        assertEq(votesFor, 100); // Alice's 100% voting power
    }
    
    /**
     * @dev ✅ NEW: Test factory statistics functionality
     */
    function testFactoryStats() public {
        // Initially no treasuries
        (
            uint256 totalTreasuries,
            uint256 activeTreasuries,
            uint256 totalMembers,
            uint256 totalFeesCollected
        ) = factory.getStats();
        
        assertEq(totalTreasuries, 0);
        assertEq(activeTreasuries, 0);
        assertEq(totalMembers, 0);
        assertEq(totalFeesCollected, 0);
        
        // Create some treasuries
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        
        vm.prank(alice);
        factory.createGroup{value: 0.001 ether}("group1", "xmtp1");
        
        vm.prank(bob);
        factory.createGroup{value: 0.001 ether}("group2", "xmtp2");
        
        // Check updated stats
        (
            totalTreasuries,
            activeTreasuries,
            totalMembers,
            totalFeesCollected
        ) = factory.getStats();
        
        assertEq(totalTreasuries, 2);
        assertEq(activeTreasuries, 2);
        assertEq(totalMembers, 2); // Each group has 1 member
        assertEq(totalFeesCollected, 0.002 ether); // 2 * 0.001 ether
    }
    
    /**
     * @dev ✅ NEW: Test error conditions
     */
    function testInsufficientCreationFee() public {
        vm.deal(alice, 1 ether);
        
        vm.prank(alice);
        vm.expectRevert(EchoFiFactory.InsufficientFee.selector);
        factory.createGroup{value: 0.0005 ether}( // Too low fee
            "test-group",
            "test-xmtp"
        );
    }
    
    /**
     * @dev ✅ NEW: Test agent executor functionality
     */
    function testAgentExecutor() public {
        // Verify executor was deployed correctly
        assertEq(executor.factory(), address(factory));
        
        // Verify deployer is authorized
        assertTrue(executor.authorizedAgents(owner));
        
        // Test adding new agent
        vm.prank(address(factory));
        executor.addAgent(alice);
        assertTrue(executor.authorizedAgents(alice));
    }
}