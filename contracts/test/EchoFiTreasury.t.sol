// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@forge-std/Test.sol";
import "@forge-std/console.sol";
import "../src/EchoFiTreasury.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock USDC token for testing
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1_000_000 * 1e6); // 1M USDC
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// Mock aUSDC token
contract MockAUSDC is ERC20 {
    address public immutable UNDERLYING_ASSET_ADDRESS;

    constructor(address underlying) ERC20("Aave USDC", "aUSDC") {
        UNDERLYING_ASSET_ADDRESS = underlying;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// Mock Aave Pool
contract MockAavePool {
    MockUSDC public usdc;
    MockAUSDC public aUsdc;
    
    constructor(address _usdc, address _aUsdc) {
        usdc = MockUSDC(_usdc);
        aUsdc = MockAUSDC(_aUsdc);
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        require(asset == address(usdc), "Unsupported asset");
        
        // Transfer USDC from user
        usdc.transferFrom(msg.sender, address(this), amount);
        
        // Mint aUSDC tokens (1:1 ratio for simplicity)
        aUsdc.mint(onBehalfOf, amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        require(asset == address(usdc), "Unsupported asset");
        
        uint256 withdrawAmount = amount;
        if (amount == type(uint256).max) {
            withdrawAmount = aUsdc.balanceOf(msg.sender);
        }
        
        // Burn aUSDC tokens
        aUsdc.transferFrom(msg.sender, address(this), withdrawAmount);
        
        // Transfer USDC back
        usdc.transfer(to, withdrawAmount);
        
        return withdrawAmount;
    }

    function getUserAccountData(address user) external view returns (
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256 availableBorrowsBase,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    ) {
        uint256 aUsdcBalance = aUsdc.balanceOf(user);
        return (aUsdcBalance, 0, 0, 8000, 7500, type(uint256).max);
    }
}

// Custom EchoFi Treasury for testing with mock contracts
contract TestEchoFiTreasury is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Role definitions (same as main contract)
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant VOTER_ROLE = keccak256("VOTER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    // Mock contract addresses
    MockAavePool public aavePool;
    MockUSDC public usdc;
    MockAUSDC public aUSDC;

    // Same struct and enums as main contract
    struct Proposal {
        uint256 id;
        address proposer;
        ProposalType proposalType;
        uint256 amount;
        address target;
        bytes data;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteChoice;
    }

    enum ProposalType {
        DEPOSIT_AAVE,
        WITHDRAW_AAVE,
        TRANSFER,
        EMERGENCY_WITHDRAW,
        ADD_MEMBER,
        REMOVE_MEMBER
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public memberVotingPower;
    
    uint256 public proposalCount;
    uint256 public totalVotingPower;
    uint256 public quorumPercentage = 51;
    uint256 public votingPeriod = 3 days;
    uint256 public minProposalAmount = 10 * 1e6;
    uint256 public maxProposalAmount = 1_000_000 * 1e6;

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, ProposalType proposalType, uint256 amount, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votingPower);
    event ProposalExecuted(uint256 indexed proposalId, bool success);
    event SuppliedToAave(uint256 amount, uint256 aTokensReceived);
    event WithdrawnFromAave(uint256 aTokenAmount, uint256 underlyingReceived);

    constructor(
        address[] memory _initialMembers,
        uint256[] memory _votingPowers,
        address _aavePool,
        address _usdc,
        address _aUSDC
    ) {
        require(_initialMembers.length == _votingPowers.length, "Array length mismatch");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        for (uint256 i = 0; i < _initialMembers.length; i++) {
            _addMember(_initialMembers[i], _votingPowers[i]);
        }

        aavePool = MockAavePool(_aavePool);
        usdc = MockUSDC(_usdc);
        aUSDC = MockAUSDC(_aUSDC);
    }

    function _addMember(address member, uint256 votingPower) internal {
        memberVotingPower[member] = votingPower;
        totalVotingPower += votingPower;
        _grantRole(PROPOSER_ROLE, member);
        _grantRole(VOTER_ROLE, member);
        _grantRole(EXECUTOR_ROLE, member);
    }

    function createProposal(
        ProposalType _type,
        uint256 _amount,
        address _target,
        bytes calldata _data,
        string calldata _description
    ) external onlyRole(PROPOSER_ROLE) returns (uint256) {
        require(_amount >= minProposalAmount && _amount <= maxProposalAmount, "Invalid amount");
        
        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.proposalType = _type;
        proposal.amount = _amount;
        proposal.target = _target;
        proposal.data = _data;
        proposal.description = _description;
        proposal.deadline = block.timestamp + votingPeriod;

        emit ProposalCreated(proposalId, msg.sender, _type, _amount, _description);
        return proposalId;
    }

    function vote(uint256 _proposalId, bool _support) external onlyRole(VOTER_ROLE) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.proposer != address(0), "Proposal not found");
        require(!proposal.executed && !proposal.cancelled, "Proposal already processed");
        require(block.timestamp <= proposal.deadline, "Voting period ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");

        uint256 votingPower = memberVotingPower[msg.sender];
        proposal.hasVoted[msg.sender] = true;
        proposal.voteChoice[msg.sender] = _support;

        if (_support) {
            proposal.votesFor += votingPower;
        } else {
            proposal.votesAgainst += votingPower;
        }

        emit VoteCast(_proposalId, msg.sender, _support, votingPower);
    }

    function executeProposal(uint256 _proposalId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.proposer != address(0), "Proposal not found");
        require(!proposal.executed && !proposal.cancelled, "Already processed");
        require(block.timestamp > proposal.deadline, "Voting still active");

        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        uint256 requiredQuorum = (totalVotingPower * quorumPercentage) / 100;
        require(totalVotes >= requiredQuorum && proposal.votesFor > proposal.votesAgainst, "Insufficient support");

        proposal.executed = true;
        bool success = _executeProposalAction(proposal);
        emit ProposalExecuted(_proposalId, success);
    }

    function _executeProposalAction(Proposal storage proposal) internal returns (bool) {
        if (proposal.proposalType == ProposalType.DEPOSIT_AAVE) {
            return _supplyToAave(proposal.amount);
        } else if (proposal.proposalType == ProposalType.WITHDRAW_AAVE) {
            return _withdrawFromAave(proposal.amount);
        } else if (proposal.proposalType == ProposalType.TRANSFER) {
            return _transferTokens(proposal.target, proposal.amount);
        }
        return false;
    }

    function _supplyToAave(uint256 amount) internal returns (bool) {
        try usdc.approve(address(aavePool), amount) {
            uint256 balanceBefore = aUSDC.balanceOf(address(this));
            aavePool.supply(address(usdc), amount, address(this), 0);
            uint256 balanceAfter = aUSDC.balanceOf(address(this));
            emit SuppliedToAave(amount, balanceAfter - balanceBefore);
            return true;
        } catch {
            return false;
        }
    }

    function _withdrawFromAave(uint256 amount) internal returns (bool) {
        try aUSDC.approve(address(aavePool), amount) {
            uint256 withdrawn = aavePool.withdraw(address(usdc), amount, address(this));
            emit WithdrawnFromAave(amount, withdrawn);
            return true;
        } catch {
            return false;
        }
    }

    function _transferTokens(address to, uint256 amount) internal returns (bool) {
        try usdc.transfer(to, amount) {
            return true;
        } catch {
            return false;
        }
    }

    // View functions
    function getProposal(uint256 _proposalId) external view returns (
        uint256 id, address proposer, ProposalType proposalType, uint256 amount,
        address target, string memory description, uint256 votesFor, uint256 votesAgainst,
        uint256 deadline, bool executed, bool cancelled
    ) {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.id, proposal.proposer, proposal.proposalType, proposal.amount,
            proposal.target, proposal.description, proposal.votesFor, proposal.votesAgainst,
            proposal.deadline, proposal.executed, proposal.cancelled
        );
    }

    function getTreasuryBalance() external view returns (uint256 usdcBalance, uint256 aUsdcBalance) {
        usdcBalance = usdc.balanceOf(address(this));
        aUsdcBalance = aUSDC.balanceOf(address(this));
    }
}

contract EchoFiTreasuryTest is Test {
    TestEchoFiTreasury public treasury;
    MockUSDC public usdc;
    MockAUSDC public aUsdc;
    MockAavePool public aavePool;

    address public admin = address(1);
    address public member1 = address(2);
    address public member2 = address(3);
    address public member3 = address(4);
    address public nonMember = address(5);

    uint256 public constant INITIAL_USDC = 100_000 * 1e6; // 100k USDC

    function setUp() public {
        // Deploy mock contracts
        vm.startPrank(admin);
        
        usdc = new MockUSDC();
        aUsdc = new MockAUSDC(address(usdc));
        aavePool = new MockAavePool(address(usdc), address(aUsdc));

        // Setup initial members and voting powers
        address[] memory initialMembers = new address[](3);
        uint256[] memory votingPowers = new uint256[](3);
        
        initialMembers[0] = member1;
        initialMembers[1] = member2;
        initialMembers[2] = member3;
        
        votingPowers[0] = 40; // 40%
        votingPowers[1] = 35; // 35% 
        votingPowers[2] = 25; // 25%

        treasury = new TestEchoFiTreasury(
            initialMembers,
            votingPowers,
            address(aavePool),
            address(usdc),
            address(aUsdc)
        );

        // Fund treasury with USDC
        usdc.transfer(address(treasury), INITIAL_USDC);
        
        vm.stopPrank();
    }

    function test_InitialSetup() public {
        // Check initial member setup
        assertEq(treasury.memberVotingPower(member1), 40);
        assertEq(treasury.memberVotingPower(member2), 35);
        assertEq(treasury.memberVotingPower(member3), 25);
        assertEq(treasury.totalVotingPower(), 100);
        
        // Check treasury balance
        (uint256 usdcBalance, uint256 aUsdcBalance) = treasury.getTreasuryBalance();
        assertEq(usdcBalance, INITIAL_USDC);
        assertEq(aUsdcBalance, 0);

        // Check roles
        assertTrue(treasury.hasRole(treasury.PROPOSER_ROLE(), member1));
        assertTrue(treasury.hasRole(treasury.VOTER_ROLE(), member1));
        assertTrue(treasury.hasRole(treasury.EXECUTOR_ROLE(), member1));
    }

    function test_CreateProposal() public {
        vm.startPrank(member1);
        
        uint256 proposalId = treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            50_000 * 1e6, // 50k USDC
            address(0),
            "",
            "Deposit 50k USDC to Aave for yield"
        );

        (
            uint256 id,
            address proposer,
            TestEchoFiTreasury.ProposalType proposalType,
            uint256 amount,
            address target,
            string memory description,
            uint256 votesFor,
            uint256 votesAgainst,
            uint256 deadline,
            bool executed,
            bool cancelled
        ) = treasury.getProposal(proposalId);

        assertEq(id, 0);
        assertEq(proposer, member1);
        assertTrue(proposalType == TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE);
        assertEq(amount, 50_000 * 1e6);
        assertEq(description, "Deposit 50k USDC to Aave for yield");
        assertEq(votesFor, 0);
        assertEq(votesAgainst, 0);
        assertGt(deadline, block.timestamp);
        assertFalse(executed);
        assertFalse(cancelled);

        vm.stopPrank();
    }

    function test_VotingProcess() public {
        // Create proposal
        vm.startPrank(member1);
        uint256 proposalId = treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            30_000 * 1e6,
            address(0),
            "",
            "Deposit to Aave"
        );
        vm.stopPrank();

        // Member 1 votes for (40 power)
        vm.prank(member1);
        treasury.vote(proposalId, true);

        // Member 2 votes for (35 power)
        vm.prank(member2);
        treasury.vote(proposalId, true);

        // Member 3 votes against (25 power)
        vm.prank(member3);
        treasury.vote(proposalId, false);

        // Check vote results
        (, , , , , , uint256 votesFor, uint256 votesAgainst, , , ) = treasury.getProposal(proposalId);
        assertEq(votesFor, 75); // 40 + 35
        assertEq(votesAgainst, 25);
    }

    function test_ProposalExecution_AaveDeposit() public {
        // Create and pass proposal
        vm.startPrank(member1);
        uint256 proposalId = treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            30_000 * 1e6,
            address(0),
            "",
            "Deposit to Aave"
        );
        
        // Vote to pass
        treasury.vote(proposalId, true);
        vm.stopPrank();

        vm.prank(member2);
        treasury.vote(proposalId, true);

        // Fast forward past voting deadline
        vm.warp(block.timestamp + 4 days);

        // Execute proposal
        vm.prank(member1);
        treasury.executeProposal(proposalId);

        // Check results
        (uint256 usdcBalance, uint256 aUsdcBalance) = treasury.getTreasuryBalance();
        assertEq(usdcBalance, INITIAL_USDC - 30_000 * 1e6); // 70k remaining
        assertEq(aUsdcBalance, 30_000 * 1e6); // 30k aUSDC received

        // Check proposal is marked as executed
        (, , , , , , , , , bool executed, ) = treasury.getProposal(proposalId);
        assertTrue(executed);
    }

    function test_ProposalExecution_AaveWithdraw() public {
        // First deposit some funds to Aave
        test_ProposalExecution_AaveDeposit();

        // Create withdrawal proposal
        vm.startPrank(member1);
        uint256 proposalId = treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            15_000 * 1e6, // Withdraw 15k
            address(0),
            "",
            "Withdraw from Aave"
        );

        treasury.vote(proposalId, true);
        vm.stopPrank();

        vm.prank(member2);
        treasury.vote(proposalId, true);

        // Execute
        vm.warp(block.timestamp + 4 days);
        vm.prank(member1);
        treasury.executeProposal(proposalId);

        // Check balances
        (uint256 usdcBalance, uint256 aUsdcBalance) = treasury.getTreasuryBalance();
        assertEq(usdcBalance, INITIAL_USDC - 30_000 * 1e6 + 15_000 * 1e6); // 85k USDC
        assertEq(aUsdcBalance, 30_000 * 1e6 - 15_000 * 1e6); // 15k aUSDC remaining
    }

    function test_QuorumRequirement() public {
        // Create proposal
        vm.startPrank(member1);
        uint256 proposalId = treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            30_000 * 1e6,
            address(0),
            "",
            "Deposit to Aave"
        );
        
        // Only member 3 votes (25% - below 51% quorum)
        vm.stopPrank();
        vm.prank(member3);
        treasury.vote(proposalId, true);

        // Try to execute - should fail due to insufficient quorum
        vm.warp(block.timestamp + 4 days);
        vm.prank(member1);
        vm.expectRevert("Insufficient support");
        treasury.executeProposal(proposalId);
    }

    function test_NonMemberCannotPropose() public {
        vm.prank(nonMember);
        vm.expectRevert();
        treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            30_000 * 1e6,
            address(0),
            "",
            "Should fail"
        );
    }

    function test_NonMemberCannotVote() public {
        vm.prank(member1);
        uint256 proposalId = treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            30_000 * 1e6,
            address(0),
            "",
            "Test proposal"
        );

        vm.prank(nonMember);
        vm.expectRevert();
        treasury.vote(proposalId, true);
    }

    function test_CannotVoteTwice() public {
        vm.prank(member1);
        uint256 proposalId = treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            30_000 * 1e6,
            address(0),
            "",
            "Test proposal"
        );

        vm.startPrank(member1);
        treasury.vote(proposalId, true);
        
        vm.expectRevert("Already voted");
        treasury.vote(proposalId, false);
        vm.stopPrank();
    }

    function test_CannotExecuteBeforeDeadline() public {
        vm.prank(member1);
        uint256 proposalId = treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            30_000 * 1e6,
            address(0),
            "",
            "Test proposal"
        );

        // Vote to pass
        vm.prank(member1);
        treasury.vote(proposalId, true);
        vm.prank(member2);
        treasury.vote(proposalId, true);

        // Try to execute before deadline
        vm.prank(member1);
        vm.expectRevert("Voting still active");
        treasury.executeProposal(proposalId);
    }

    function test_TransferProposal() public {
        address recipient = address(0x123);
        uint256 transferAmount = 10_000 * 1e6;

        vm.startPrank(member1);
        uint256 proposalId = treasury.createProposal(
            TestEchoFiTreasury.ProposalType.TRANSFER,
            transferAmount,
            recipient,
            "",
            "Transfer USDC to external address"
        );
        
        treasury.vote(proposalId, true);
        vm.stopPrank();

        vm.prank(member2);
        treasury.vote(proposalId, true);

        vm.warp(block.timestamp + 4 days);
        vm.prank(member1);
        treasury.executeProposal(proposalId);

        // Check recipient received tokens
        assertEq(usdc.balanceOf(recipient), transferAmount);
        
        // Check treasury balance reduced
        (uint256 usdcBalance, ) = treasury.getTreasuryBalance();
        assertEq(usdcBalance, INITIAL_USDC - transferAmount);
    }

    function test_InvalidProposalAmount() public {
        vm.prank(member1);
        
        // Too small
        vm.expectRevert("Invalid amount");
        treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            5 * 1e6, // 5 USDC - below minimum
            address(0),
            "",
            "Too small"
        );

        // Too large
        vm.expectRevert("Invalid amount");
        treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            2_000_000 * 1e6, // 2M USDC - above maximum
            address(0),
            "",
            "Too large"
        );
    }

    function test_Events() public {
        vm.startPrank(member1);
        
        // Test ProposalCreated event
        vm.expectEmit(true, true, false, true);
        emit EchoFiTreasury.ProposalCreated(
            0,
            member1,
            EchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            30_000 * 1e6,
            "Test proposal"
        );
        
        uint256 proposalId = treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            30_000 * 1e6,
            address(0),
            "",
            "Test proposal"
        );

        // Test VoteCast event
        vm.expectEmit(true, true, false, true);
        emit EchoFiTreasury.VoteCast(proposalId, member1, true, 40);
        treasury.vote(proposalId, true);
        
        vm.stopPrank();

        vm.prank(member2);
        treasury.vote(proposalId, true);

        // Test ProposalExecuted event
        vm.warp(block.timestamp + 4 days);
        
        vm.expectEmit(true, false, false, true);
        emit EchoFiTreasury.ProposalExecuted(proposalId, true);
        
        vm.prank(member1);
        treasury.executeProposal(proposalId);
    }

    // Gas optimization tests
    function test_GasUsage() public {
        vm.startPrank(member1);
        
        // Measure gas for proposal creation
        uint256 gasBefore = gasleft();
        treasury.createProposal(
            TestEchoFiTreasury.ProposalType.DEPOSIT_AAVE,
            30_000 * 1e6,
            address(0),
            "",
            "Gas test"
        );
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas used for proposal creation:", gasUsed);
        
        vm.stopPrank();
    }
}