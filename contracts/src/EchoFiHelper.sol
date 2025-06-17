// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./EchoFiFactory.sol";
import "./EchoFiTreasury.sol";

/**
 * @title EchoFiHelper - FIXED VERSION
 * @dev Helper contract for frontend integration and treasury management
 * @notice FIXES: Stack too deep errors by simplifying function returns and using structs
 */
contract EchoFiHelper {
    //  Simplified treasury details struct
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

    //  Split proposal details into smaller structs
    struct ProposalBasicInfo {
        uint256 id;
        address proposer;
        EchoFiTreasury.ProposalType proposalType;
        uint256 amount;
        string description;
    }

    struct ProposalVotingInfo {
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
        bool cancelled;
        bool canExecute;
        string status;
    }

    // Combined proposal details using smaller structs
    struct ProposalDetails {
        ProposalBasicInfo basic;
        ProposalVotingInfo voting;
    }

    struct MemberInfo {
        address memberAddress;
        uint256 votingPower;
        bool hasProposerRole;
        bool hasVoterRole;
        bool hasExecutorRole;
    }

    EchoFiFactory public immutable factory;

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory address");
        factory = EchoFiFactory(_factory);
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
    function getTreasuryDetail(address _treasury) external view returns (TreasuryDetails memory) {
        return _getTreasuryDetail(_treasury);
    }

    /**
     * @dev Optimized internal function with reduced local variables
     */
    function _getTreasuryDetail(address _treasury) internal view returns (TreasuryDetails memory) {
        EchoFiTreasury treasury = EchoFiTreasury(_treasury);
        EchoFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(_treasury);
        
        (uint256 usdcBalance, uint256 aUsdcBalance) = treasury.getTreasuryBalance();
        
        //  Calculate active proposals in separate function
        uint256 activeCount = _countActiveProposals(treasury);
        
        return TreasuryDetails({
            treasuryAddress: _treasury,
            name: info.name,
            memberCount: info.memberCount,
            totalVotingPower: info.totalVotingPower,
            usdcBalance: usdcBalance,
            aUsdcBalance: aUsdcBalance,
            activeProposals: activeCount,
            isActive: info.isActive
        });
    }

    /**
     * @dev  Extract active proposal counting to separate function
     */
    function _countActiveProposals(EchoFiTreasury treasury) internal view returns (uint256) {
        uint256 proposalCount = treasury.proposalCount();
        uint256 activeProposals = 0;
        
        for (uint256 i = 0; i < proposalCount; i++) {
            try treasury.getProposalBasic(i) returns (
                EchoFiTreasury.ProposalData memory,
                EchoFiTreasury.VotingData memory voting
            ) {
                if (!voting.executed && !voting.cancelled) {
                    activeProposals++;
                }
            } catch {
                // Skip invalid proposals
            }
        }
        
        return activeProposals;
    }

    /**
     * @dev  Simplified proposal fetching with new treasury functions
     */
    function getTreasuryProposals(address _treasury, uint256 _limit) 
        external 
        view 
        returns (ProposalDetails[] memory) 
    {
        EchoFiTreasury treasury = EchoFiTreasury(_treasury);
        uint256 proposalCount = treasury.proposalCount();
        
        if (proposalCount == 0) {
            return new ProposalDetails[](0);
        }
        
        uint256 limit = _limit > 0 && _limit < proposalCount ? _limit : proposalCount;
        ProposalDetails[] memory proposals = new ProposalDetails[](limit);
        
        for (uint256 i = 0; i < limit; i++) {
            uint256 proposalId = proposalCount - 1 - i; // Get newest first
            proposals[i] = _getProposalDetailOptimized(treasury, proposalId);
        }
        
        return proposals;
    }

    /**
     * @dev Get detailed information about a specific proposal
     */
    function getProposalDetail(address _treasury, uint256 _proposalId) 
        external 
        view 
        returns (ProposalDetails memory) 
    {
        EchoFiTreasury treasury = EchoFiTreasury(_treasury);
        return _getProposalDetailOptimized(treasury, _proposalId);
    }

    /**
     * @dev  Optimized proposal detail function using new treasury methods
     */
    function _getProposalDetailOptimized(EchoFiTreasury treasury, uint256 _proposalId) 
        internal 
        view 
        returns (ProposalDetails memory) 
    {
        try treasury.getProposalBasic(_proposalId) returns (
            EchoFiTreasury.ProposalData memory data,
            EchoFiTreasury.VotingData memory voting
        ) {
            // Calculate execution eligibility in separate function
            bool canExecute = _canExecuteProposal(treasury, voting);
            string memory status = _getProposalStatus(voting, treasury);
            
            return ProposalDetails({
                basic: ProposalBasicInfo({
                    id: data.id,
                    proposer: data.proposer,
                    proposalType: data.proposalType,
                    amount: data.amount,
                    description: data.description
                }),
                voting: ProposalVotingInfo({
                    votesFor: voting.votesFor,
                    votesAgainst: voting.votesAgainst,
                    deadline: voting.deadline,
                    executed: voting.executed,
                    cancelled: voting.cancelled,
                    canExecute: canExecute,
                    status: status
                })
            });
        } catch {
            // Return empty struct for invalid proposals
            return ProposalDetails({
                basic: ProposalBasicInfo({
                    id: _proposalId,
                    proposer: address(0),
                    proposalType: EchoFiTreasury.ProposalType.DEPOSIT_AAVE,
                    amount: 0,
                    description: "Invalid proposal"
                }),
                voting: ProposalVotingInfo({
                    votesFor: 0,
                    votesAgainst: 0,
                    deadline: 0,
                    executed: false,
                    cancelled: false,
                    canExecute: false,
                    status: "Invalid"
                })
            });
        }
    }

    /**
     * @dev ✅ FIX #10: Extract execution eligibility check
     */
    function _canExecuteProposal(EchoFiTreasury treasury, EchoFiTreasury.VotingData memory voting) 
        internal 
        view 
        returns (bool) 
    {
        return !voting.executed && 
               !voting.cancelled && 
               block.timestamp > voting.deadline && 
               _calculateVoteResult(treasury, voting.votesFor, voting.votesAgainst);
    }

    /**
     * @dev Get member information for a treasury - TO-DO
     */
    function getTreasuryMembers(address _treasury) 
        external 
        view 
        returns (MemberInfo[] memory) 
    {
        // For MVP, return empty array as member enumeration isn't implemented
        // In production, you'd need to track members in the treasury contract
        return new MemberInfo[](0);
    }

    /**
     * @dev Calculate if a proposal passes based on votes
     */
    function _calculateVoteResult(EchoFiTreasury treasury, uint256 votesFor, uint256 votesAgainst) 
        internal 
        view 
        returns (bool) 
    {
        uint256 totalVotes = votesFor + votesAgainst;
        uint256 quorum = treasury.quorumPercentage();
        uint256 totalPower = treasury.totalVotingPower();
        
        // Check if quorum is met and majority supports
        return (totalVotes * 100 >= totalPower * quorum) && (votesFor > votesAgainst);
    }

    /**
    * @dev  Optimized user voting eligibility check
    */
    function canUserVote(address _treasury, uint256 _proposalId, address _user) 
        external 
        view 
        returns (bool canVote, string memory reason) 
    {
        EchoFiTreasury treasury = EchoFiTreasury(_treasury);
        
        // Check 1: Does user have voting power?
        uint256 userVotingPower = treasury.memberVotingPower(_user);
        if (userVotingPower == 0) {
            return (false, "User has no voting power");
        }
        
        // Check 2: Does the proposal exist?
        if (_proposalId >= treasury.proposalCount()) {
            return (false, "Proposal does not exist");
        }
        
        // Check 3: Has user already voted?
        if (treasury.hasVoted(_proposalId, _user)) {
            return (false, "User has already voted");
        }
        
        //  Use new optimized treasury function
        try treasury.getProposalBasic(_proposalId) returns (
            EchoFiTreasury.ProposalData memory,
            EchoFiTreasury.VotingData memory voting
        ) {
            // Check proposal status
            if (voting.executed) {
                return (false, "Proposal already executed");
            }
            
            if (voting.cancelled) {
                return (false, "Proposal was cancelled");
            }
            
            if (block.timestamp > voting.deadline) {
                return (false, "Voting period has ended");
            }
            
            // All checks passed
            return (true, "Can vote");
            
        } catch {
            return (false, "Failed to retrieve proposal details");
        }
    }

    /**
     * @dev Simplified proposal status function
     */
    function _getProposalStatus(
        EchoFiTreasury.VotingData memory voting,
        EchoFiTreasury treasury
    ) internal view returns (string memory) {
        if (voting.executed) return "Executed";
        if (voting.cancelled) return "Cancelled";
        if (block.timestamp <= voting.deadline) return "Active";
        
        bool passes = _calculateVoteResult(treasury, voting.votesFor, voting.votesAgainst);
        return passes ? "Passed - Ready to Execute" : "Failed";
    }

    /**
     * @dev Batch function to get user's treasury details
     */
    function getUserTreasuryDetails(address _user) 
        external 
        view 
        returns (TreasuryDetails[] memory) 
    {
        address[] memory userTreasuries = factory.getUserTreasuries(_user);
        return this.getTreasuryDetails(userTreasuries);
    }

    /**
     * @dev Optimized treasury statistics
     */
    function getTreasuryStats(address _treasury) 
        external 
        view 
        returns (
            uint256 totalProposals,
            uint256 activeProposals,
            uint256 executedProposals,
            uint256 totalVotingPower,
            uint256 treasuryValue
        ) 
    {
        EchoFiTreasury treasury = EchoFiTreasury(_treasury);
        totalProposals = treasury.proposalCount();
        totalVotingPower = treasury.totalVotingPower();
        
        (uint256 usdcBalance, uint256 aUsdcBalance) = treasury.getTreasuryBalance();
        treasuryValue = usdcBalance + aUsdcBalance;
        
        //  Use optimized counting function
        (activeProposals, executedProposals) = _getProposalCounts(treasury, totalProposals);
    }

    /**
     * @dev Extract proposal counting to separate function
     */
    function _getProposalCounts(EchoFiTreasury treasury, uint256 totalProposals) 
        internal 
        view 
        returns (uint256 active, uint256 executed) 
    {
        active = 0;
        executed = 0;
        
        for (uint256 i = 0; i < totalProposals; i++) {
            try treasury.getProposalBasic(i) returns (
                EchoFiTreasury.ProposalData memory,
                EchoFiTreasury.VotingData memory voting
            ) {
                if (voting.executed) {
                    executed++;
                } else if (!voting.cancelled) {
                    active++;
                }
            } catch {
                // Skip invalid proposals
            }
        }
    }
}