// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function getUserAccountData(address user) external view returns (
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256 availableBorrowsBase,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    );
}

interface IAToken is IERC20 {
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}

/**
 * @title GroupFiTreasury
 * @dev Multi-signature treasury contract with Aave V3 integration for group investment coordination
 * @notice Manages group proposals, voting, and automated DeFi execution through Aave lending
 */
contract GroupFiTreasury is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Role definitions
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant VOTER_ROLE = keccak256("VOTER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    // Aave V3 Pool address on Base
    IAavePool public constant AAVE_POOL = IAavePool(0xA238Dd80C259a72e81d7e4664a9801593F98d1c5);
    
    // USDC token addresses
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // Base Mainnet
    // address public constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // Base Sepolia
    
    // aUSDC token (received from Aave when supplying)
    address public immutable aUSDC;

    // Proposal structure
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
        mapping(address => bool) voteChoice; // true = for, false = against
    }

    enum ProposalType {
        DEPOSIT_AAVE,      // Supply USDC to Aave
        WITHDRAW_AAVE,     // Withdraw USDC from Aave  
        TRANSFER,          // Transfer tokens to address
        EMERGENCY_WITHDRAW, // Emergency withdrawal
        ADD_MEMBER,        // Add new member
        REMOVE_MEMBER      // Remove member
    }

    // Storage
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public memberVotingPower;
    
    uint256 public proposalCount;
    uint256 public totalVotingPower;
    uint256 public quorumPercentage = 51; // 51% required for approval
    uint256 public votingPeriod = 3 days;
    uint256 public minProposalAmount = 10 * 1e6; // 10 USDC
    uint256 public maxProposalAmount = 1_000_000 * 1e6; // 1M USDC

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType proposalType,
        uint256 amount,
        string description
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 votingPower
    );
    
    event ProposalExecuted(uint256 indexed proposalId, bool success);
    event ProposalCancelled(uint256 indexed proposalId);
    event MemberAdded(address indexed member, uint256 votingPower);
    event MemberRemoved(address indexed member);
    event SuppliedToAave(uint256 amount, uint256 aTokensReceived);
    event WithdrawnFromAave(uint256 aTokenAmount, uint256 underlyingReceived);

    // Errors
    error ProposalNotFound();
    error ProposalAlreadyExecuted();
    error ProposalDeadlinePassed();
    error ProposalStillActive();
    error InsufficientQuorum();
    error AlreadyVoted();
    error InvalidAmount();
    error InvalidProposalType();
    error UnauthorizedAccess();
    error TransferFailed();

    constructor(
        address[] memory _initialMembers,
        uint256[] memory _votingPowers,
        address _aUSDCAddress
    ) {
        require(_initialMembers.length == _votingPowers.length, "Array length mismatch");
        require(_initialMembers.length > 0, "No initial members");
        require(_aUSDCAddress != address(0), "Invalid aUSDC address");

        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // Add initial members
        for (uint256 i = 0; i < _initialMembers.length; i++) {
            _addMember(_initialMembers[i], _votingPowers[i]);
        }

        aUSDC = _aUSDCAddress;
    }

    /**
     * @dev Add a new member to the group
     */
    function _addMember(address member, uint256 votingPower) internal {
        require(member != address(0), "Invalid member address");
        require(votingPower > 0, "Voting power must be positive");
        require(memberVotingPower[member] == 0, "Member already exists");

        memberVotingPower[member] = votingPower;
        totalVotingPower += votingPower;

        _grantRole(PROPOSER_ROLE, member);
        _grantRole(VOTER_ROLE, member);
        _grantRole(EXECUTOR_ROLE, member);

        emit MemberAdded(member, votingPower);
    }

    /**
     * @dev Create a new proposal
     */
    function createProposal(
        ProposalType _type,
        uint256 _amount,
        address _target,
        bytes calldata _data,
        string calldata _description
    ) external onlyRole(PROPOSER_ROLE) whenNotPaused returns (uint256) {
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

    /**
     * @dev Cast a vote on a proposal
     */
    function vote(uint256 _proposalId, bool _support) external onlyRole(VOTER_ROLE) whenNotPaused {
        Proposal storage proposal = proposals[_proposalId];
        
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.executed || proposal.cancelled) revert ProposalAlreadyExecuted();
        if (block.timestamp > proposal.deadline) revert ProposalDeadlinePassed();
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();

        uint256 votingPower = memberVotingPower[msg.sender];
        require(votingPower > 0, "No voting power");

        proposal.hasVoted[msg.sender] = true;
        proposal.voteChoice[msg.sender] = _support;

        if (_support) {
            proposal.votesFor += votingPower;
        } else {
            proposal.votesAgainst += votingPower;
        }

        emit VoteCast(_proposalId, msg.sender, _support, votingPower);
    }

    /**
     * @dev Execute a proposal after voting period
     */
    function executeProposal(uint256 _proposalId) external onlyRole(EXECUTOR_ROLE) nonReentrant whenNotPaused {
        Proposal storage proposal = proposals[_proposalId];
        
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.executed || proposal.cancelled) revert ProposalAlreadyExecuted();
        if (block.timestamp <= proposal.deadline) revert ProposalStillActive();

        // Check quorum
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        uint256 requiredQuorum = (totalVotingPower * quorumPercentage) / 100;
        
        if (totalVotes < requiredQuorum || proposal.votesFor <= proposal.votesAgainst) {
            revert InsufficientQuorum();
        }

        proposal.executed = true;
        bool success = _executeProposalAction(proposal);

        emit ProposalExecuted(_proposalId, success);
    }

    /**
     * @dev Execute the actual proposal action
     */
    function _executeProposalAction(Proposal storage proposal) internal returns (bool) {
        if (proposal.proposalType == ProposalType.DEPOSIT_AAVE) {
            return _supplyToAave(proposal.amount);
        } else if (proposal.proposalType == ProposalType.WITHDRAW_AAVE) {
            return _withdrawFromAave(proposal.amount);
        } else if (proposal.proposalType == ProposalType.TRANSFER) {
            return _transferTokens(proposal.target, proposal.amount);
        } else if (proposal.proposalType == ProposalType.EMERGENCY_WITHDRAW) {
            return _emergencyWithdraw();
        }
        
        return false;
    }

    /**
     * @dev Supply USDC to Aave V3
     */
    function _supplyToAave(uint256 amount) internal returns (bool) {
        try IERC20(USDC).safeApprove(address(AAVE_POOL), amount) {
            uint256 balanceBefore = IERC20(aUSDC).balanceOf(address(this));
            
            AAVE_POOL.supply(USDC, amount, address(this), 0);
            
            uint256 balanceAfter = IERC20(aUSDC).balanceOf(address(this));
            uint256 aTokensReceived = balanceAfter - balanceBefore;
            
            emit SuppliedToAave(amount, aTokensReceived);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Withdraw from Aave V3
     */
    function _withdrawFromAave(uint256 amount) internal returns (bool) {
        try AAVE_POOL.withdraw(USDC, amount, address(this)) returns (uint256 withdrawn) {
            emit WithdrawnFromAave(amount, withdrawn);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Transfer tokens to specified address
     */
    function _transferTokens(address to, uint256 amount) internal returns (bool) {
        try IERC20(USDC).safeTransfer(to, amount) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Emergency withdraw all funds from Aave
     */
    function _emergencyWithdraw() internal returns (bool) {
        uint256 aTokenBalance = IERC20(aUSDC).balanceOf(address(this));
        if (aTokenBalance > 0) {
            try AAVE_POOL.withdraw(USDC, type(uint256).max, address(this)) {
                return true;
            } catch {
                return false;
            }
        }
        return true;
    }

    // Agent role functions for automated execution
    function agentExecuteProposal(uint256 _proposalId) external onlyRole(AGENT_ROLE) nonReentrant {
        // Agents can execute pre-approved proposals with simplified requirements
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.proposer != address(0), "Proposal not found");
        require(!proposal.executed && !proposal.cancelled, "Proposal already processed");
        require(proposal.votesFor > proposal.votesAgainst, "Proposal not approved");
        
        proposal.executed = true;
        _executeProposalAction(proposal);
        
        emit ProposalExecuted(_proposalId, true);
    }

    // View functions
    function getProposal(uint256 _proposalId) external view returns (
        uint256 id,
        address proposer,
        ProposalType proposalType,
        uint256 amount,
        address target,
        string memory description,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 deadline,
        bool executed,
        bool cancelled
    ) {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.id,
            proposal.proposer,
            proposal.proposalType,
            proposal.amount,
            proposal.target,
            proposal.description,
            proposal.votesFor,
            proposal.votesAgainst,
            proposal.deadline,
            proposal.executed,
            proposal.cancelled
        );
    }

    function getTreasuryBalance() external view returns (uint256 usdcBalance, uint256 aUsdcBalance) {
        usdcBalance = IERC20(USDC).balanceOf(address(this));
        aUsdcBalance = IERC20(aUSDC).balanceOf(address(this));
    }

    function getAavePosition() external view returns (
        uint256 totalCollateral,
        uint256 availableLiquidity
    ) {
        (totalCollateral,,,,,) = AAVE_POOL.getUserAccountData(address(this));
        availableLiquidity = IERC20(aUSDC).balanceOf(address(this));
    }

    // Admin functions
    function updateQuorum(uint256 _newQuorum) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newQuorum > 0 && _newQuorum <= 100, "Invalid quorum");
        quorumPercentage = _newQuorum;
    }

    function updateVotingPeriod(uint256 _newPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newPeriod >= 1 hours && _newPeriod <= 30 days, "Invalid period");
        votingPeriod = _newPeriod;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // Emergency function to recover any stuck tokens
    function emergencyRecover(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}