// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@forge-std/Test.sol";
import "@forge-std/console.sol";
import "../src/GroupFiFactory.sol";
import "../src/GroupFiTreasury.sol";

contract GroupFiFactoryTest is Test {
    GroupFiFactory public factory;
    GroupFiHelper public helper;
    
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    address public user3 = address(4);
    address public user4 = address(5);
    
    address public constant MOCK_AUSDC = address(0x123);
    uint256 public constant CREATION_FEE = 0.001 ether;

    event TreasuryCreated(
        address indexed treasury,
        address indexed creator,
        string name,
        uint256 memberCount,
        uint256 indexed treasuryId
    );

    function setUp() public {
        vm.startPrank(owner);
        
        factory = new GroupFiFactory(MOCK_AUSDC, owner);
        helper = new GroupFiHelper(address(factory));
        
        // Fund users with ETH for creation fees
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);
        vm.deal(user4, 10 ether);
        
        vm.stopPrank();
    }

    function test_InitialSetup() public {
        assertEq(factory.owner(), owner);
        assertEq(factory.aUSDC(), MOCK_AUSDC);
        assertEq(factory.treasuryCount(), 0);
        assertEq(factory.creationFee(), CREATION_FEE);
        assertEq(factory.minMembers(), 2);
        assertEq(factory.maxMembers(), 50);
    }

    function test_CreateTreasury_Success() public {
        // Setup members and voting powers
        address[] memory members = new address[](3);
        uint256[] memory votingPowers = new uint256[](3);
        
        members[0] = user1;
        members[1] = user2;
        members[2] = user3;
        
        votingPowers[0] = 40;
        votingPowers[1] = 35;
        votingPowers[2] = 25;

        vm.startPrank(user1);
        
        // Expect event emission
        vm.expectEmit(true, true, false, true);
        emit TreasuryCreated(address(0), user1, "Test Group", 3, 0);
        
        address treasuryAddress = factory.createTreasury{value: CREATION_FEE}(
            "Test Group",
            "A test investment group",
            members,
            votingPowers
        );
        
        vm.stopPrank();

        // Verify treasury was created
        assertTrue(treasuryAddress != address(0));
        assertEq(factory.treasuryCount(), 1);
        
        // Verify treasury info
        GroupFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(treasuryAddress);
        assertEq(info.treasuryAddress, treasuryAddress);
        assertEq(info.creator, user1);
        assertEq(info.name, "Test Group");
        assertEq(info.description, "A test investment group");
        assertEq(info.memberCount, 3);
        assertEq(info.totalVotingPower, 100);
        assertTrue(info.isActive);
        assertGt(info.createdAt, 0);

        // Verify user treasury lists
        address[] memory user1Treasuries = factory.getUserTreasuries(user1);
        address[] memory user2Treasuries = factory.getUserTreasuries(user2);
        address[] memory user3Treasuries = factory.getUserTreasuries(user3);
        
        assertEq(user1Treasuries.length, 1);
        assertEq(user2Treasuries.length, 1);
        assertEq(user3Treasuries.length, 1);
        assertEq(user1Treasuries[0], treasuryAddress);
        assertEq(user2Treasuries[0], treasuryAddress);
        assertEq(user3Treasuries[0], treasuryAddress);
    }

    function test_CreateTreasury_InsufficientFee() public {
        address[] memory members = new address[](2);
        uint256[] memory votingPowers = new uint256[](2);
        
        members[0] = user1;
        members[1] = user2;
        votingPowers[0] = 60;
        votingPowers[1] = 40;

        vm.prank(user1);
        vm.expectRevert(GroupFiFactory.InsufficientFee.selector);
        factory.createTreasury{value: CREATION_FEE - 1}(
            "Test Group",
            "Description",
            members,
            votingPowers
        );
    }

    function test_CreateTreasury_InvalidMemberCount() public {
        // Too few members
        address[] memory members = new address[](1);
        uint256[] memory votingPowers = new uint256[](1);
        members[0] = user1;
        votingPowers[0] = 100;

        vm.prank(user1);
        vm.expectRevert(GroupFiFactory.InvalidMemberCount.selector);
        factory.createTreasury{value: CREATION_FEE}(
            "Test Group",
            "Description",
            members,
            votingPowers
        );
    }

    function test_CreateTreasury_InvalidVotingPowers() public {
        address[] memory members = new address[](3);
        uint256[] memory votingPowers = new uint256[](3);
        
        members[0] = user1;
        members[1] = user2;
        members[2] = user3;
        
        // Voting powers don't sum to 100
        votingPowers[0] = 40;
        votingPowers[1] = 35;
        votingPowers[2] = 20; // Sum = 95, not 100

        vm.prank(user1);
        vm.expectRevert(GroupFiFactory.InvalidVotingPowers.selector);
        factory.createTreasury{value: CREATION_FEE}(
            "Test Group",
            "Description",
            members,
            votingPowers
        );
    }

    function test_CreateTreasury_MismatchedArrays() public {
        address[] memory members = new address[](2);
        uint256[] memory votingPowers = new uint256[](3); // Mismatched length
        
        members[0] = user1;
        members[1] = user2;
        votingPowers[0] = 50;
        votingPowers[1] = 30;
        votingPowers[2] = 20;

        vm.prank(user1);
        vm.expectRevert(GroupFiFactory.InvalidVotingPowers.selector);
        factory.createTreasury{value: CREATION_FEE}(
            "Test Group",
            "Description",
            members,
            votingPowers
        );
    }

    function test_CreateMultipleTreasuries() public {
        // Create first treasury
        address[] memory members1 = new address[](2);
        uint256[] memory votingPowers1 = new uint256[](2);
        members1[0] = user1;
        members1[1] = user2;
        votingPowers1[0] = 60;
        votingPowers1[1] = 40;

        vm.prank(user1);
        address treasury1 = factory.createTreasury{value: CREATION_FEE}(
            "Group 1",
            "First group",
            members1,
            votingPowers1
        );

        // Create second treasury
        address[] memory members2 = new address[](3);
        uint256[] memory votingPowers2 = new uint256[](3);
        members2[0] = user2;
        members2[1] = user3;
        members2[2] = user4;
        votingPowers2[0] = 50;
        votingPowers2[1] = 30;
        votingPowers2[2] = 20;

        vm.prank(user2);
        address treasury2 = factory.createTreasury{value: CREATION_FEE}(
            "Group 2",
            "Second group",
            members2,
            votingPowers2
        );

        // Verify both treasuries exist
        assertEq(factory.treasuryCount(), 2);
        assertTrue(treasury1 != treasury2);

        // Verify user2 is in both treasuries
        address[] memory user2Treasuries = factory.getUserTreasuries(user2);
        assertEq(user2Treasuries.length, 2);
        assertTrue(
            (user2Treasuries[0] == treasury1 && user2Treasuries[1] == treasury2) ||
            (user2Treasuries[0] == treasury2 && user2Treasuries[1] == treasury1)
        );
    }

    function test_GetActiveTreasuries() public {
        // Create two treasuries
        address treasury1 = _createTestTreasury(user1, "Group 1");
        address treasury2 = _createTestTreasury(user2, "Group 2");

        // Both should be active initially
        address[] memory activeTreasuries = factory.getActiveTreasuries();
        assertEq(activeTreasuries.length, 2);

        // Deactivate one treasury
        vm.prank(user1);
        factory.updateTreasuryStatus(treasury1, false);

        // Should only have one active treasury
        activeTreasuries = factory.getActiveTreasuries();
        assertEq(activeTreasuries.length, 1);
        assertEq(activeTreasuries[0], treasury2);
    }

    function test_GetTreasuriesPagination() public {
        // Create multiple treasuries
        for (uint256 i = 0; i < 5; i++) {
            _createTestTreasury(user1, string.concat("Group ", vm.toString(i)));
        }

        // Test pagination
        (address[] memory page1, uint256 total) = factory.getTreasuries(0, 3);
        assertEq(page1.length, 3);
        assertEq(total, 5);

        (address[] memory page2, ) = factory.getTreasuries(3, 3);
        assertEq(page2.length, 2); // Only 2 remaining

        (address[] memory page3, ) = factory.getTreasuries(10, 3);
        assertEq(page3.length, 0); // Beyond available treasuries
    }

    function test_UpdateTreasuryStatus() public {
        address treasury = _createTestTreasury(user1, "Test Group");

        // Creator can update status
        vm.prank(user1);
        factory.updateTreasuryStatus(treasury, false);

        GroupFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(treasury);
        assertFalse(info.isActive);

        // Owner can also update status
        vm.prank(owner);
        factory.updateTreasuryStatus(treasury, true);

        info = factory.getTreasuryInfo(treasury);
        assertTrue(info.isActive);
    }

    function test_UpdateTreasuryStatus_Unauthorized() public {
        address treasury = _createTestTreasury(user1, "Test Group");

        // Non-creator/non-owner cannot update status
        vm.prank(user2);
        vm.expectRevert(GroupFiFactory.UnauthorizedAccess.selector);
        factory.updateTreasuryStatus(treasury, false);
    }

    function test_UpdateCreationFee() public {
        uint256 newFee = 0.002 ether;
        
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit GroupFiFactory.CreationFeeUpdated(CREATION_FEE, newFee);
        factory.updateCreationFee(newFee);

        assertEq(factory.creationFee(), newFee);
    }

    function test_UpdateCreationFee_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        factory.updateCreationFee(0.002 ether);
    }

    function test_UpdateMemberLimits() public {
        vm.prank(owner);
        factory.updateMemberLimits(3, 100);

        assertEq(factory.minMembers(), 3);
        assertEq(factory.maxMembers(), 100);
    }

    function test_UpdateMemberLimits_InvalidLimits() public {
        vm.prank(owner);
        vm.expectRevert("Invalid limits");
        factory.updateMemberLimits(0, 10); // Min members cannot be 0

        vm.expectRevert("Invalid limits");
        factory.updateMemberLimits(10, 5); // Max must be >= min
    }

    function test_WithdrawFees() public {
        // Create a treasury to generate fees
        _createTestTreasury(user1, "Test Group");

        uint256 ownerBalanceBefore = owner.balance;
        uint256 contractBalance = address(factory).balance;

        vm.prank(owner);
        factory.withdrawFees();

        assertEq(address(factory).balance, 0);
        assertEq(owner.balance, ownerBalanceBefore + contractBalance);
    }

    function test_WithdrawFees_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        factory.withdrawFees();
    }

    function test_GetStats() public {
        // Create some treasuries
        address treasury1 = _createTestTreasury(user1, "Group 1");
        _createTestTreasury(user2, "Group 2");
        _createTestTreasury(user3, "Group 3");

        // Deactivate one
        vm.prank(user1);
        factory.updateTreasuryStatus(treasury1, false);

        (
            uint256 totalTreasuries,
            uint256 activeTreasuries,
            uint256 totalMembers,
            uint256 totalFeesCollected
        ) = factory.getStats();

        assertEq(totalTreasuries, 3);
        assertEq(activeTreasuries, 2); // One was deactivated
        assertEq(totalMembers, 4); // 2 active treasuries * 2 members each
        assertGt(totalFeesCollected, 0);
    }

    function test_HelperContract_GetTreasuryDetails() public {
        address treasury = _createTestTreasury(user1, "Test Group");

        address[] memory treasuries = new address[](1);
        treasuries[0] = treasury;

        GroupFiHelper.TreasuryDetails[] memory details = helper.getTreasuryDetails(treasuries);
        
        assertEq(details.length, 1);
        assertEq(details[0].treasuryAddress, treasury);
        assertEq(details[0].name, "Test Group");
        assertEq(details[0].memberCount, 2);
        assertTrue(details[0].isActive);
    }

    function test_HelperContract_CanUserVote() public {
        address treasury = _createTestTreasury(user1, "Test Group");
        
        // Create a proposal to test voting eligibility
        GroupFiTreasury treasuryContract = GroupFiTreasury(treasury);
        
        vm.prank(user1);
        uint256 proposalId = treasuryContract.createProposal(
            GroupFiTreasury.ProposalType.DEPOSIT_AAVE,
            1000 * 1e6,
            address(0),
            "",
            "Test proposal"
        );

        // Check if user1 can vote (should be able to)
        (bool canVote, string memory reason) = helper.canUserVote(treasury, proposalId, user1);
        assertTrue(canVote);
        assertEq(reason, "Can vote");

        // Check if non-member can vote (should not be able to)
        (canVote, reason) = helper.canUserVote(treasury, proposalId, user4);
        assertFalse(canVote);
        assertEq(reason, "User has no voting power");
    }

    function test_GasOptimization() public {
        address[] memory members = new address[](10);
        uint256[] memory votingPowers = new uint256[](10);
        
        // Create a larger group to test gas usage
        for (uint256 i = 0; i < 10; i++) {
            members[i] = address(uint160(i + 100));
            votingPowers[i] = 10; // Each member gets 10% voting power
        }

        vm.prank(user1);
        uint256 gasBefore = gasleft();
        factory.createTreasury{value: CREATION_FEE}(
            "Large Group",
            "A group with 10 members",
            members,
            votingPowers
        );
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for creating 10-member treasury:", gasUsed);
        
        // Gas usage should be reasonable (less than 3M gas)
        assertLt(gasUsed, 3_000_000);
    }

    function test_TreasuryNotFound() public {
        address nonExistentTreasury = address(0x999);
        
        vm.expectRevert(GroupFiFactory.TreasuryNotFound.selector);
        factory.getTreasuryInfo(nonExistentTreasury);
    }

    // Helper function to create a standard test treasury
    function _createTestTreasury(address creator, string memory name) internal returns (address) {
        address[] memory members = new address[](2);
        uint256[] memory votingPowers = new uint256[](2);
        
        members[0] = creator;
        members[1] = user2;
        votingPowers[0] = 60;
        votingPowers[1] = 40;

        vm.prank(creator);
        return factory.createTreasury{value: CREATION_FEE}(
            name,
            string.concat("Description for ", name),
            members,
            votingPowers
        );
    }

    // Fuzz testing
    function testFuzz_CreateTreasury_ValidVotingPowers(uint8 memberCount, uint256 seed) public {
        // Bound member count to valid range
        memberCount = uint8(bound(memberCount, 2, 20));
        
        address[] memory members = new address[](memberCount);
        uint256[] memory votingPowers = new uint256[](memberCount);
        
        // Generate members
        for (uint256 i = 0; i < memberCount; i++) {
            members[i] = address(uint160(seed + i + 1));
        }
        
        // Distribute voting power to sum to 100
        uint256 remaining = 100;
        for (uint256 i = 0; i < memberCount - 1; i++) {
            uint256 power = bound(seed + i, 1, remaining - (memberCount - i - 1));
            votingPowers[i] = power;
            remaining -= power;
            seed = uint256(keccak256(abi.encode(seed))); // Update seed
        }
        votingPowers[memberCount - 1] = remaining; // Last member gets remainder

        vm.prank(user1);
        address treasury = factory.createTreasury{value: CREATION_FEE}(
            "Fuzz Test Group",
            "Fuzz testing",
            members,
            votingPowers
        );

        assertTrue(treasury != address(0));
        
        GroupFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(treasury);
        assertEq(info.memberCount, memberCount);
        assertEq(info.totalVotingPower, 100);
    }
}