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
 * @title EchoFiTreasury - FIXED VERSION
 * @dev Multi-signature treasury contract with Aave V3 integration for group investment coordination
 */
contract EchoFiTreasury is AccessControl, ReentrancyGuard, Pausable {
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
    
    // aUSDC token (received from Aave when supplying)
    address public immutable aUSDC;

    // Proposal types
    enum ProposalType {
        DEPOSIT_AAVE,
        WITHDRAW_AAVE,
        TRANSFER,
        EMERGENCY_WITHDRAW,
        ADD_MEMBER,
        REMOVE_MEMBER
    }

    // Use struct for proposal data to reduce stack usage
    struct ProposalData {
        uint256 id;
        address proposer;
        ProposalType proposalType;
        uint256 amount;
        address target;
        string description;
    }

    // Use struct for voting data
    struct VotingData {
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
        bool cancelled;
    }

    // Split proposal struct to avoid stack depth
    struct Proposal {
        ProposalData data;
        VotingData voting;
        bytes executionData;
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteChoice;
    }

    // Configuration struct for XMTP integration
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
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public memberVotingPower;
    
    uint256 public proposalCount;
    uint256 public totalVotingPower;
    uint256 public quorumPercentage = 51;
    uint256 public votingPeriod = 3 days;
    uint256 public minProposalAmount = 10 * 1e6; // 10 USDC
    uint256 public maxProposalAmount = 1_000_000 * 1e6; // 1M USDC

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, ProposalType proposalType, uint256 amount, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votingPower);
    event ProposalExecuted(uint256 indexed proposalId, bool success);
    event SuppliedToAave(uint256 amount, uint256 aTokensReceived);
    event WithdrawnFromAave(uint256 aTokenAmount, uint256 underlyingReceived);
    event MemberAdded(address indexed member, uint256 votingPower);
    event MemberRemoved(address indexed member);

    // Errors
    error InvalidProposalId();
    error NotAuthorized();
    error ProposalAlreadyExecuted();
    error ProposalCancelled();
    error VotingStillActive();
    error VotingEnded();
    error AlreadyVoted();
    error QuorumNotReached();
    error ProposalRejected();
    error InsufficientBalance();
    error InvalidAmount();
    error InvalidAddress();

    /**
     * @dev Constructor
     */
    constructor(
        address _aUSDC,
        address[] memory _initialMembers,
        uint256[] memory _votingPowers
    ) {
        require(_aUSDC != address(0), "Invalid aUSDC address");
        require(_initialMembers.length == _votingPowers.length, "Array length mismatch");
        require(_initialMembers.length > 0, "No initial members");
        
        aUSDC = _aUSDC;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        //Optimize member setup to reduce local variables
        _setupMembers(_initialMembers, _votingPowers);
    }

    /**
     * @dev  Extract member setup to separate function
     */
    function _setupMembers(address[] memory _members, uint256[] memory _powers) internal {
        uint256 totalPower = 0;
        for (uint256 i = 0; i < _members.length; i++) {
            require(_members[i] != address(0), "Invalid member address");
            require(_powers[i] > 0, "Voting power must be > 0");
            
            _addMember(_members[i], _powers[i]);
            totalPower += _powers[i];
        }
        
        require(totalPower == 100, "Total voting power must equal 100");
        totalVotingPower = totalPower;
    }

    /**
     * @dev Create a new proposal
     */
    function createProposal(
        ProposalType _proposalType,
        uint256 _amount,
        address _target,
        bytes calldata _data,
        string calldata _description
    ) external returns (uint256) {
        if (!hasRole(PROPOSER_ROLE, msg.sender)) revert NotAuthorized();
        if (_amount < minProposalAmount) revert InvalidAmount();
        if (_amount > maxProposalAmount) revert InvalidAmount();
        if (bytes(_description).length == 0) revert InvalidAmount();
        
        uint256 proposalId = proposalCount++;
        
        //  Use struct assignment to reduce stack usage
        Proposal storage proposal = proposals[proposalId];
        proposal.data = ProposalData({
            id: proposalId,
            proposer: msg.sender,
            proposalType: _proposalType,
            amount: _amount,
            target: _target,
            description: _description
        });
        
        proposal.voting = VotingData({
            votesFor: 0,
            votesAgainst: 0,
            deadline: block.timestamp + votingPeriod,
            executed: false,
            cancelled: false
        });
        
        proposal.executionData = _data;
        
        emit ProposalCreated(proposalId, msg.sender, _proposalType, _amount, _description);
        return proposalId;
    }

    /**
     * @dev Vote on a proposal
     */
    function vote(uint256 _proposalId, bool _support) external {
        if (!hasRole(VOTER_ROLE, msg.sender)) revert NotAuthorized();
        if (_proposalId >= proposalCount) revert InvalidProposalId();
        
        Proposal storage proposal = proposals[_proposalId];
        if (block.timestamp > proposal.voting.deadline) revert VotingEnded();
        if (proposal.voting.executed) revert ProposalAlreadyExecuted();
        if (proposal.voting.cancelled) revert ProposalCancelled();
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();
        
        uint256 votingPower = memberVotingPower[msg.sender];
        require(votingPower > 0, "No voting power");
        
        proposal.hasVoted[msg.sender] = true;
        proposal.voteChoice[msg.sender] = _support;
        
        if (_support) {
            proposal.voting.votesFor += votingPower;
        } else {
            proposal.voting.votesAgainst += votingPower;
        }
        
        emit VoteCast(_proposalId, msg.sender, _support, votingPower);
    }

    /**
     * @dev Execute a proposal
     */
    function executeProposal(uint256 _proposalId) external nonReentrant {
        if (!hasRole(EXECUTOR_ROLE, msg.sender)) revert NotAuthorized();
        if (_proposalId >= proposalCount) revert InvalidProposalId();
        
        Proposal storage proposal = proposals[_proposalId];
        if (block.timestamp <= proposal.voting.deadline) revert VotingStillActive();
        if (proposal.voting.executed) revert ProposalAlreadyExecuted();
        if (proposal.voting.cancelled) revert ProposalCancelled();
        
        //  Extract voting validation
        _validateProposalPassing(proposal.voting);
        
        proposal.voting.executed = true;
        bool success = _executeProposalAction(proposal);
        emit ProposalExecuted(_proposalId, success);
    }

    /**
     * @dev  Extract voting validation logic
     */
    function _validateProposalPassing(VotingData storage voting) internal view {
        uint256 totalVotes = voting.votesFor + voting.votesAgainst;
        uint256 quorumRequired = (totalVotingPower * quorumPercentage) / 100;
        
        if (totalVotes < quorumRequired) revert QuorumNotReached();
        if (voting.votesFor <= voting.votesAgainst) revert ProposalRejected();
    }

    /**
     * @dev Simplified execution logic
     */
    function _executeProposalAction(Proposal storage proposal) internal returns (bool) {
        ProposalType pType = proposal.data.proposalType;
        uint256 amount = proposal.data.amount;
        
        if (pType == ProposalType.DEPOSIT_AAVE) {
            return _executeAaveDeposit(amount);
        } else if (pType == ProposalType.WITHDRAW_AAVE) {
            return _executeAaveWithdrawal(amount);
        } else if (pType == ProposalType.TRANSFER) {
            return _executeTransfer(proposal.data.target, amount);
        }
        return false;
    }

    /**
     * @dev Execute Aave deposit
     */
    function _executeAaveDeposit(uint256 amount) internal returns (bool) {
        IERC20 usdc = IERC20(USDC);
        uint256 balance = usdc.balanceOf(address(this));
        
        if (balance < amount) return false;
        
        usdc.forceApprove(address(AAVE_POOL), amount);
        
        try AAVE_POOL.supply(USDC, amount, address(this), 0) {
            emit SuppliedToAave(amount, 0);
            return true;
        } catch {
            usdc.forceApprove(address(AAVE_POOL), 0);
            return false;
        }
    }

    /**
     * @dev Execute Aave withdrawal
     */
    function _executeAaveWithdrawal(uint256 amount) internal returns (bool) {
        try AAVE_POOL.withdraw(USDC, amount, address(this)) returns (uint256 withdrawn) {
            emit WithdrawnFromAave(amount, withdrawn);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Execute transfer
     */
    function _executeTransfer(address to, uint256 amount) internal returns (bool) {
        if (to == address(0)) return false;
        
        IERC20 usdc = IERC20(USDC);
        uint256 balance = usdc.balanceOf(address(this));
        
        if (balance < amount) return false;
        
        usdc.safeTransfer(to, amount);
        return true;
    }

    /**
     * @dev Return simplified proposal data instead of all fields
     */
    function getProposalBasic(uint256 _proposalId) external view returns (
        ProposalData memory data,
        VotingData memory voting
    ) {
        if (_proposalId >= proposalCount) revert InvalidProposalId();
        
        Proposal storage proposal = proposals[_proposalId];
        return (proposal.data, proposal.voting);
    }

    /**
     * @dev  Separate function for execution data
     */
    function getProposalExecutionData(uint256 _proposalId) external view returns (bytes memory) {
        if (_proposalId >= proposalCount) revert InvalidProposalId();
        return proposals[_proposalId].executionData;
    }

    /**
     * @dev  Legacy compatibility - return minimal data
     */
    function getProposal(uint256 _proposalId) external view returns (
        uint256 id,
        address proposer,
        ProposalType proposalType,
        uint256 amount,
        address target,
        bytes memory data,
        string memory description,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 deadline,
        bool executed,
        bool cancelled
    ) {
        if (_proposalId >= proposalCount) revert InvalidProposalId();
        
        Proposal storage proposal = proposals[_proposalId];
        ProposalData memory pData = proposal.data;
        VotingData memory vData = proposal.voting;
        
        return (
            pData.id,
            pData.proposer,
            pData.proposalType,
            pData.amount,
            pData.target,
            proposal.executionData,
            pData.description,
            vData.votesFor,
            vData.votesAgainst,
            vData.deadline,
            vData.executed,
            vData.cancelled
        );
    }

    /**
     * @dev Get treasury balance (both USDC and aUSDC)
     */
    function getTreasuryBalance() external view returns (uint256 usdcBalance, uint256 aUsdcBalance) {
        IERC20 usdc = IERC20(USDC);
        IERC20 aUsdc = IERC20(aUSDC);
        
        usdcBalance = usdc.balanceOf(address(this));
        aUsdcBalance = aUsdc.balanceOf(address(this));
    }

    /**
    * @dev Check if a user has voted on a specific proposal
    */
    function hasVoted(uint256 _proposalId, address _voter) 
        external 
        view 
        returns (bool) 
    {
        if (_proposalId >= proposalCount) {
            return false;
        }
        
        return proposals[_proposalId].hasVoted[_voter];
    }

    /**
    * @dev Get the vote choice for a user on a specific proposal
    */
    function getVoteChoice(uint256 _proposalId, address _voter) 
        external 
        view 
        returns (bool) 
    {
        if (_proposalId >= proposalCount) {
            return false;
        }
        
        return proposals[_proposalId].voteChoice[_voter];
    }

    /**
     * @dev Add member with voting power (internal)
     */
    function _addMember(address member, uint256 votingPower) internal {
        if (member == address(0)) revert InvalidAddress();
        if (votingPower == 0) revert InvalidAmount();
        
        // Grant all necessary roles
        _grantRole(PROPOSER_ROLE, member);
        _grantRole(VOTER_ROLE, member);
        _grantRole(EXECUTOR_ROLE, member);
        
        // Set voting power
        memberVotingPower[member] = votingPower;
        
        emit MemberAdded(member, votingPower);
    }

    /**
     * @dev Emergency withdraw function (only admin)
     */
    function emergencyWithdraw(address token, uint256 amount) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotAuthorized();
        
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /**
     * @dev Pause contract (only admin)
     */
    function pause() external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotAuthorized();
        _pause();
    }

    /**
     * @dev Unpause contract (only admin)
     */
    function unpause() external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotAuthorized();
        _unpause();
    }
}