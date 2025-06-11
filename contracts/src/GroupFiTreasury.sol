// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title GroupFiTreasury
 * @dev Smart contract for managing group investment decisions and treasury
 * Integrates with XMTP messaging and AgentKit for automated execution
 */
contract GroupFiTreasury is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant MEMBER_ROLE = keccak256("MEMBER_ROLE");

    // Proposal status enum
    enum ProposalStatus {
        Active,
        Approved,
        Rejected,
        Executed,
        Expired
    }

    // Investment strategy types
    enum StrategyType {
        Lending,      // Aave, Compound
        Staking,      // Liquid staking
        LP,           // Uniswap LPs
        YieldFarm,    // Yield farming
        Custom        // AI agent custom strategy
    }

    struct Member {
        address wallet;
        uint256 contributedAmount;
        uint256 votingPower;
        bool isActive;
        uint256 joinedAt;
        string xmtpAddress; // For XMTP integration
    }

    struct Proposal {
        string id;                    // Matches database ID
        string xmtpGroupId;          // XMTP group ID for messaging
        string title;
        string description;
        string strategy;             // Natural language strategy
        StrategyType strategyType;
        address proposer;
        address targetToken;
        uint256 amount;
        uint256 deadline;
        uint256 requiredVotes;
        uint256 approvalVotes;
        uint256 rejectionVotes;
        ProposalStatus status;
        uint256 createdAt;
        bytes32 strategyHash;        // Hash for strategy verification
        address executionTarget;     // Contract to execute strategy
        bytes executionData;         // Encoded function call
    }

    struct GroupConfig {
        string xmtpGroupId;
        uint256 minVotingPower;
        uint256 votingDuration;
        uint256 executionDelay;
        uint256 quorumPercentage;
        bool autoExecute;
        uint256 maxProposalAmount;
    }

    // State variables
    string public groupId;           // Matches database group ID
    GroupConfig public config;
    uint256 public totalFunds;
    uint256 public totalMembers;
    
    mapping(address => Member) public members;
    mapping(string => Proposal) public proposals;
    mapping(string => mapping(address => bool)) public hasVoted;
    mapping(address => uint256) public tokenBalances;
    mapping(address => bool) public approvedTokens;
    
    address[] public memberList;
    string[] public proposalList;
    address[] public approvedTokenList;

    // Events for XMTP and frontend integration
    event GroupInitialized(string indexed groupId, string xmtpGroupId, address creator);
    event MemberAdded(address indexed member, uint256 votingPower, string xmtpAddress);
    event MemberRemoved(address indexed member);
    event FundsDeposited(address indexed member, address indexed token, uint256 amount);
    event FundsWithdrawn(address indexed member, address indexed token, uint256 amount);
    
    event ProposalCreated(
        string indexed proposalId,
        address indexed proposer,
        string title,
        uint256 amount,
        uint256 deadline
    );
    
    event VoteCast(
        string indexed proposalId,
        address indexed voter,
        bool approval,
        uint256 votingPower
    );
    
    event ProposalStatusChanged(
        string indexed proposalId,
        ProposalStatus oldStatus,
        ProposalStatus newStatus
    );
    
    event ProposalExecuted(
        string indexed proposalId,
        bool success,
        uint256 amount,
        address executor
    );

    event AgentExecutionRequested(
        string indexed proposalId,
        string strategy,
        uint256 amount,
        address token
    );

    modifier onlyMember() {
        require(hasRole(MEMBER_ROLE, msg.sender), "Not a group member");
        require(members[msg.sender].isActive, "Member not active");
        _;
    }

    modifier proposalExists(string memory proposalId) {
        require(bytes(proposals[proposalId].id).length > 0, "Proposal does not exist");
        _;
    }

    modifier proposalActive(string memory proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp <= proposal.deadline, "Proposal expired");
        _;
    }

    constructor(
        string memory _groupId,
        string memory _xmtpGroupId,
        address _creator,
        string memory _creatorXmtpAddress,
        GroupConfig memory _config
    ) {
        groupId = _groupId;
        config = _config;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _creator);
        _grantRole(ADMIN_ROLE, _creator);
        _grantRole(MEMBER_ROLE, _creator);

        // Add creator as first member
        members[_creator] = Member({
            wallet: _creator,
            contributedAmount: 0,
            votingPower: 100, // Creator gets 100 voting power initially
            isActive: true,
            joinedAt: block.timestamp,
            xmtpAddress: _creatorXmtpAddress
        });
        
        memberList.push(_creator);
        totalMembers = 1;

        // Approve common tokens (USDC, USDT, WETH, DAI)
        _approveToken(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913); // USDC on Base
        _approveToken(0x4200000000000000000000000000000000000006); // WETH on Base

        emit GroupInitialized(_groupId, _xmtpGroupId, _creator);
        emit MemberAdded(_creator, 100, _creatorXmtpAddress);
    }

    /**
     * @dev Add a new member to the group
     */
    function addMember(
        address memberAddress,
        uint256 votingPower,
        string memory xmtpAddress
    ) external onlyRole(ADMIN_ROLE) {
        require(!hasRole(MEMBER_ROLE, memberAddress), "Already a member");
        require(votingPower > 0, "Voting power must be positive");

        _grantRole(MEMBER_ROLE, memberAddress);
        
        members[memberAddress] = Member({
            wallet: memberAddress,
            contributedAmount: 0,
            votingPower: votingPower,
            isActive: true,
            joinedAt: block.timestamp,
            xmtpAddress: xmtpAddress
        });
        
        memberList.push(memberAddress);
        totalMembers++;

        emit MemberAdded(memberAddress, votingPower, xmtpAddress);
    }

    /**
     * @dev Remove a member from the group
     */
    function removeMember(address memberAddress) external onlyRole(ADMIN_ROLE) {
        require(hasRole(MEMBER_ROLE, memberAddress), "Not a member");
        require(memberAddress != getRoleMember(DEFAULT_ADMIN_ROLE, 0), "Cannot remove creator");

        _revokeRole(MEMBER_ROLE, memberAddress);
        members[memberAddress].isActive = false;
        totalMembers--;

        emit MemberRemoved(memberAddress);
    }

    /**
     * @dev Deposit funds to the group treasury
     */
    function depositFunds(address token, uint256 amount) 
        external 
        onlyMember 
        nonReentrant 
    {
        require(approvedTokens[token], "Token not approved");
        require(amount > 0, "Amount must be positive");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        tokenBalances[token] += amount;
        members[msg.sender].contributedAmount += amount;
        totalFunds += amount;

        emit FundsDeposited(msg.sender, token, amount);
    }

    /**
     * @dev Create an investment proposal
     */
    function createProposal(
        string memory proposalId,
        string memory title,
        string memory description,
        string memory strategy,
        StrategyType strategyType,
        address targetToken,
        uint256 amount,
        uint256 votingDuration,
        address executionTarget,
        bytes memory executionData
    ) external onlyMember {
        require(bytes(proposals[proposalId].id).length == 0, "Proposal already exists");
        require(amount <= tokenBalances[targetToken], "Insufficient funds");
        require(amount <= config.maxProposalAmount, "Amount exceeds maximum");
        require(votingDuration <= config.votingDuration, "Voting duration too long");

        uint256 deadline = block.timestamp + votingDuration;
        bytes32 strategyHash = keccak256(abi.encodePacked(strategy, amount, targetToken));

        proposals[proposalId] = Proposal({
            id: proposalId,
            xmtpGroupId: config.xmtpGroupId,
            title: title,
            description: description,
            strategy: strategy,
            strategyType: strategyType,
            proposer: msg.sender,
            targetToken: targetToken,
            amount: amount,
            deadline: deadline,
            requiredVotes: _calculateRequiredVotes(),
            approvalVotes: 0,
            rejectionVotes: 0,
            status: ProposalStatus.Active,
            createdAt: block.timestamp,
            strategyHash: strategyHash,
            executionTarget: executionTarget,
            executionData: executionData
        });

        proposalList.push(proposalId);

        emit ProposalCreated(proposalId, msg.sender, title, amount, deadline);
    }

    /**
     * @dev Vote on a proposal
     */
    function vote(string memory proposalId, bool approval) 
        external 
        onlyMember 
        proposalExists(proposalId) 
        proposalActive(proposalId) 
    {
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        uint256 votingPower = members[msg.sender].votingPower;
        hasVoted[proposalId][msg.sender] = true;

        Proposal storage proposal = proposals[proposalId];
        
        if (approval) {
            proposal.approvalVotes += votingPower;
        } else {
            proposal.rejectionVotes += votingPower;
        }

        emit VoteCast(proposalId, msg.sender, approval, votingPower);

        // Check if proposal should be executed
        _checkProposalExecution(proposalId);
    }

    /**
     * @dev Execute a proposal (can be called by agent or admin)
     */
    function executeProposal(string memory proposalId) 
        external 
        proposalExists(proposalId) 
        nonReentrant 
    {
        require(
            hasRole(AGENT_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized to execute"
        );

        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Approved, "Proposal not approved");

        // Mark as executed first to prevent reentrancy
        proposal.status = ProposalStatus.Executed;

        bool success = false;
        
        if (proposal.executionTarget != address(0) && proposal.executionData.length > 0) {
            // Execute custom strategy through target contract
            (success,) = proposal.executionTarget.call(proposal.executionData);
        } else {
            // For AgentKit integration - emit event for off-chain execution
            emit AgentExecutionRequested(
                proposalId,
                proposal.strategy,
                proposal.amount,
                proposal.targetToken
            );
            success = true; // AgentKit will handle the actual execution
        }

        if (success) {
            // Update balances
            tokenBalances[proposal.targetToken] -= proposal.amount;
            totalFunds -= proposal.amount;
        }

        emit ProposalExecuted(proposalId, success, proposal.amount, msg.sender);
        emit ProposalStatusChanged(proposalId, ProposalStatus.Approved, ProposalStatus.Executed);
    }

    /**
     * @dev Emergency withdraw function (admin only, when paused)
     */
    function emergencyWithdraw(address token, uint256 amount, address to) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenPaused 
    {
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @dev Approve a token for deposits
     */
    function approveToken(address token) external onlyRole(ADMIN_ROLE) {
        _approveToken(token);
    }

    /**
     * @dev Add agent address for automated execution
     */
    function addAgent(address agent) external onlyRole(ADMIN_ROLE) {
        _grantRole(AGENT_ROLE, agent);
    }

    // Internal functions
    function _calculateRequiredVotes() internal view returns (uint256) {
        uint256 totalVotingPower = 0;
        for (uint256 i = 0; i < memberList.length; i++) {
            if (members[memberList[i]].isActive) {
                totalVotingPower += members[memberList[i]].votingPower;
            }
        }
        return (totalVotingPower * config.quorumPercentage) / 100;
    }

    function _checkProposalExecution(string memory proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.approvalVotes >= proposal.requiredVotes) {
            proposal.status = ProposalStatus.Approved;
            emit ProposalStatusChanged(proposalId, ProposalStatus.Active, ProposalStatus.Approved);
            
            if (config.autoExecute) {
                // Auto-execute if enabled
                this.executeProposal(proposalId);
            }
        } else if (block.timestamp > proposal.deadline) {
            if (proposal.approvalVotes >= proposal.requiredVotes) {
                proposal.status = ProposalStatus.Approved;
                emit ProposalStatusChanged(proposalId, ProposalStatus.Active, ProposalStatus.Approved);
            } else {
                proposal.status = ProposalStatus.Expired;
                emit ProposalStatusChanged(proposalId, ProposalStatus.Active, ProposalStatus.Expired);
            }
        }
    }

    function _approveToken(address token) internal {
        if (!approvedTokens[token]) {
            approvedTokens[token] = true;
            approvedTokenList.push(token);
        }
    }

    // View functions
    function getProposal(string memory proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function getMember(address memberAddress) external view returns (Member memory) {
        return members[memberAddress];
    }

    function getAllMembers() external view returns (address[] memory) {
        return memberList;
    }

    function getAllProposals() external view returns (string[] memory) {
        return proposalList;
    }

    function getTokenBalance(address token) external view returns (uint256) {
        return tokenBalances[token];
    }

    function getApprovedTokens() external view returns (address[] memory) {
        return approvedTokenList;
    }

    function hasVotedOnProposal(string memory proposalId, address voter) 
        external 
        view 
        returns (bool) 
    {
        return hasVoted[proposalId][voter];
    }

    // Admin functions
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function updateConfig(GroupConfig memory newConfig) external onlyRole(ADMIN_ROLE) {
        config = newConfig;
    }
}