// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./GroupFiTreasury.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GroupFiFactory
 * @dev Factory contract for deploying and managing GroupFi treasury instances
 * @notice Enables easy creation of new investment groups with standardized configurations
 */
contract GroupFiFactory is Ownable, ReentrancyGuard {
    // Treasury registry
    struct TreasuryInfo {
        address treasuryAddress;
        address creator;
        string name;
        string description;
        uint256 memberCount;
        uint256 totalVotingPower;
        uint256 createdAt;
        bool isActive;
    }

    mapping(address => TreasuryInfo) public treasuries;
    mapping(address => address[]) public userTreasuries; // User -> list of treasuries they're in
    address[] public allTreasuries;

    // Configuration
    address public immutable aUSDC;
    uint256 public treasuryCount;
    uint256 public creationFee = 0.001 ether; // Small fee to prevent spam
    uint256 public minMembers = 2;
    uint256 public maxMembers = 50;

    // Events
    event TreasuryCreated(
        address indexed treasury,
        address indexed creator,
        string name,
        uint256 memberCount,
        uint256 indexed treasuryId
    );
    
    event TreasuryStatusUpdated(address indexed treasury, bool isActive);
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);

    // Errors
    error InvalidMemberCount();
    error InvalidVotingPowers();
    error InsufficientFee();
    error TreasuryNotFound();
    error UnauthorizedAccess();

    constructor(address _aUSDC, address _initialOwner) Ownable(_initialOwner) {
        require(_aUSDC != address(0), "Invalid aUSDC address");
        aUSDC = _aUSDC;
    }

    /**
     * @dev Create a new GroupFi treasury
     * @param _name Name of the investment group
     * @param _description Description of the group's purpose
     * @param _members Array of member addresses
     * @param _votingPowers Array of voting powers corresponding to members
     */
    function createTreasury(
        string calldata _name,
        string calldata _description,
        address[] calldata _members,
        uint256[] calldata _votingPowers
    ) external payable nonReentrant returns (address) {
        // Validate input
        if (msg.value < creationFee) revert InsufficientFee();
        if (_members.length < minMembers || _members.length > maxMembers) revert InvalidMemberCount();
        if (_members.length != _votingPowers.length) revert InvalidVotingPowers();
        
        // Validate voting powers sum to 100
        uint256 totalPower = 0;
        for (uint256 i = 0; i < _votingPowers.length; i++) {
            totalPower += _votingPowers[i];
        }
        if (totalPower != 100) revert InvalidVotingPowers();

        // Deploy new treasury
        GroupFiTreasury treasury = new GroupFiTreasury(
            _members,
            _votingPowers,
            aUSDC
        );

        address treasuryAddress = address(treasury);
        
        // Store treasury info
        treasuries[treasuryAddress] = TreasuryInfo({
            treasuryAddress: treasuryAddress,
            creator: msg.sender,
            name: _name,
            description: _description,
            memberCount: _members.length,
            totalVotingPower: totalPower,
            createdAt: block.timestamp,
            isActive: true
        });

        // Update registries
        allTreasuries.push(treasuryAddress);
        
        // Add to each member's treasury list
        for (uint256 i = 0; i < _members.length; i++) {
            userTreasuries[_members[i]].push(treasuryAddress);
        }

        uint256 treasuryId = treasuryCount++;
        
        emit TreasuryCreated(treasuryAddress, msg.sender, _name, _members.length, treasuryId);
        
        return treasuryAddress;
    }

    /**
     * @dev Get all treasuries for a specific user
     */
    function getUserTreasuries(address _user) external view returns (address[] memory) {
        return userTreasuries[_user];
    }

    /**
     * @dev Get treasury information
     */
    function getTreasuryInfo(address _treasury) external view returns (TreasuryInfo memory) {
        if (treasuries[_treasury].treasuryAddress == address(0)) revert TreasuryNotFound();
        return treasuries[_treasury];
    }

    /**
     * @dev Get all active treasuries
     */
    function getActiveTreasuries() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // Count active treasuries
        for (uint256 i = 0; i < allTreasuries.length; i++) {
            if (treasuries[allTreasuries[i]].isActive) {
                activeCount++;
            }
        }
        
        // Build active treasury array
        address[] memory activeTreasuries = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allTreasuries.length; i++) {
            if (treasuries[allTreasuries[i]].isActive) {
                activeTreasuries[index] = allTreasuries[i];
                index++;
            }
        }
        
        return activeTreasuries;
    }

    /**
     * @dev Get paginated list of treasuries
     */
    function getTreasuries(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (address[] memory, uint256) 
    {
        uint256 totalCount = allTreasuries.length;
        if (_offset >= totalCount) {
            return (new address[](0), totalCount);
        }
        
        uint256 end = _offset + _limit;
        if (end > totalCount) {
            end = totalCount;
        }
        
        address[] memory result = new address[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            result[i - _offset] = allTreasuries[i];
        }
        
        return (result, totalCount);
    }

    /**
     * @dev Update treasury status (only owner or treasury creator)
     */
    function updateTreasuryStatus(address _treasury, bool _isActive) external {
        TreasuryInfo storage info = treasuries[_treasury];
        if (info.treasuryAddress == address(0)) revert TreasuryNotFound();
        if (msg.sender != owner() && msg.sender != info.creator) revert UnauthorizedAccess();
        
        info.isActive = _isActive;
        emit TreasuryStatusUpdated(_treasury, _isActive);
    }

    /**
     * @dev Update creation fee (only owner)
     */
    function updateCreationFee(uint256 _newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = _newFee;
        emit CreationFeeUpdated(oldFee, _newFee);
    }

    /**
     * @dev Update member limits (only owner)
     */
    function updateMemberLimits(uint256 _minMembers, uint256 _maxMembers) external onlyOwner {
        require(_minMembers > 0 && _maxMembers >= _minMembers, "Invalid limits");
        minMembers = _minMembers;
        maxMembers = _maxMembers;
    }

    /**
     * @dev Withdraw collected fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Fee withdrawal failed");
    }

    /**
     * @dev Get total statistics
     */
    function getStats() external view returns (
        uint256 totalTreasuries,
        uint256 activeTreasuries,
        uint256 totalMembers,
        uint256 totalFeesCollected
    ) {
        totalTreasuries = allTreasuries.length;
        totalFeesCollected = address(this).balance;
        
        uint256 activeCount = 0;
        uint256 memberCount = 0;
        
        for (uint256 i = 0; i < allTreasuries.length; i++) {
            TreasuryInfo memory info = treasuries[allTreasuries[i]];
            if (info.isActive) {
                activeCount++;
                memberCount += info.memberCount;
            }
        }
        
        activeTreasuries = activeCount;
        totalMembers = memberCount;
    }
}

/**
 * @title GroupFiHelper
 * @dev Helper contract for frontend integration and treasury management
 * @notice Provides utility functions for easier frontend integration
 */
contract GroupFiHelper {
    struct TreasuryDetails {
        address treasuryAddress;
        string name;
        uint256 memberCount;
        uint256 totalVotingPower;
        uint256 usdcBalance;
        uint256 aUsdcBalance;
        uint256 activeProposals;
        bool isActive;
    }

    struct ProposalDetails {
        uint256 id;
        address proposer;
        GroupFiTreasury.ProposalType proposalType;
        uint256 amount;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
        bool cancelled;
        bool canExecute;
        string status;
    }

    struct MemberInfo {
        address memberAddress;
        uint256 votingPower;
        bool hasProposerRole;
        bool hasVoterRole;
        bool hasExecutorRole;
    }

    GroupFiFactory public immutable factory;

    constructor(address _factory) {
        factory = GroupFiFactory(_factory);
    }

    /**
     * @dev Get detailed information about multiple treasuries
     */
    function getTreasuryDetails(address[] calldata _treasuries) 
        external 
        view 
        returns (TreasuryDetails[] memory) 
    {
        TreasuryDetails[] memory details = new TreasuryDetails[](_treasuries.length);
        
        for (uint256 i = 0; i < _treasuries.length; i++) {
            details[i] = _getTreasuryDetail(_treasuries[i]);
        }
        
        return details;
    }

    /**
     * @dev Get detailed information about a single treasury
     */
    function _getTreasuryDetail(address _treasury) internal view returns (TreasuryDetails memory) {
        GroupFiTreasury treasury = GroupFiTreasury(_treasury);
        GroupFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(_treasury);
        
        (uint256 usdcBalance, uint256 aUsdcBalance) = treasury.getTreasuryBalance();
        
        // Count active proposals
        uint256 proposalCount = treasury.proposalCount();
        uint256 activeProposals = 0;
        
        for (uint256 i = 0; i < proposalCount; i++) {
            (, , , , , , , , uint256 deadline, bool executed, bool cancelled) = treasury.getProposal(i);
            if (!executed && !cancelled && block.timestamp <= deadline) {
                activeProposals++;
            }
        }
        
        return TreasuryDetails({
            treasuryAddress: _treasury,
            name: info.name,
            memberCount: info.memberCount,
            totalVotingPower: info.totalVotingPower,
            usdcBalance: usdcBalance,
            aUsdcBalance: aUsdcBalance,
            activeProposals: activeProposals,
            isActive: info.isActive
        });
    }

    /**
     * @dev Get detailed proposal information with status
     */
    function getProposalDetails(address _treasury, uint256[] calldata _proposalIds) 
        external 
        view 
        returns (ProposalDetails[] memory) 
    {
        GroupFiTreasury treasury = GroupFiTreasury(_treasury);
        ProposalDetails[] memory details = new ProposalDetails[](_proposalIds.length);
        
        for (uint256 i = 0; i < _proposalIds.length; i++) {
            details[i] = _getProposalDetail(treasury, _proposalIds[i]);
        }
        
        return details;
    }

    function _getProposalDetail(GroupFiTreasury treasury, uint256 proposalId) 
        internal 
        view 
        returns (ProposalDetails memory) 
    {
        (
            uint256 id,
            address proposer,
            GroupFiTreasury.ProposalType proposalType,
            uint256 amount,
            ,
            string memory description,
            uint256 votesFor,
            uint256 votesAgainst,
            uint256 deadline,
            bool executed,
            bool cancelled
        ) = treasury.getProposal(proposalId);

        string memory status;
        bool canExecute = false;

        if (cancelled) {
            status = "Cancelled";
        } else if (executed) {
            status = "Executed";
        } else if (block.timestamp <= deadline) {
            status = "Active";
        } else {
            uint256 totalVotes = votesFor + votesAgainst;
            uint256 requiredQuorum = (treasury.totalVotingPower() * treasury.quorumPercentage()) / 100;
            
            if (totalVotes >= requiredQuorum && votesFor > votesAgainst) {
                status = "Ready for Execution";
                canExecute = true;
            } else {
                status = "Failed";
            }
        }

        return ProposalDetails({
            id: id,
            proposer: proposer,
            proposalType: proposalType,
            amount: amount,
            description: description,
            votesFor: votesFor,
            votesAgainst: votesAgainst,
            deadline: deadline,
            executed: executed,
            cancelled: cancelled,
            canExecute: canExecute,
            status: status
        });
    }

    /**
     * @dev Get member information for a treasury
     */
    function getMemberInfo(address _treasury, address[] calldata _members) 
        external 
        view 
        returns (MemberInfo[] memory) 
    {
        GroupFiTreasury treasury = GroupFiTreasury(_treasury);
        MemberInfo[] memory members = new MemberInfo[](_members.length);
        
        for (uint256 i = 0; i < _members.length; i++) {
            members[i] = MemberInfo({
                memberAddress: _members[i],
                votingPower: treasury.memberVotingPower(_members[i]),
                hasProposerRole: treasury.hasRole(treasury.PROPOSER_ROLE(), _members[i]),
                hasVoterRole: treasury.hasRole(treasury.VOTER_ROLE(), _members[i]),
                hasExecutorRole: treasury.hasRole(treasury.EXECUTOR_ROLE(), _members[i])
            });
        }
        
        return members;
    }

    /**
     * @dev Check if user can vote on proposal
     */
    function canUserVote(address _treasury, uint256 _proposalId, address _user) 
        external 
        view 
        returns (bool canVote, string memory reason) 
    {
        GroupFiTreasury treasury = GroupFiTreasury(_treasury);
        
        if (!treasury.hasRole(treasury.VOTER_ROLE(), _user)) {
            return (false, "User does not have voter role");
        }
        
        if (treasury.memberVotingPower(_user) == 0) {
            return (false, "User has no voting power");
        }
        
        (, , , , , , , , uint256 deadline, bool executed, bool cancelled) = treasury.getProposal(_proposalId);
        
        if (executed) {
            return (false, "Proposal already executed");
        }
        
        if (cancelled) {
            return (false, "Proposal cancelled");
        }
        
        if (block.timestamp > deadline) {
            return (false, "Voting period ended");
        }
        
        return (true, "Can vote");
    }
}