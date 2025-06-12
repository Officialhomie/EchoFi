// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./EchoFiFactory.sol";
import "./EchoFiTreasury.sol";

/**
 * @title EchoFiHelper
 * @dev Helper contract for frontend integration and treasury management
 * @notice Provides utility functions for easier frontend integration
 */
contract EchoFiHelper {
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
        EchoFiTreasury.ProposalType proposalType;
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
     * @dev Internal function to get treasury details
     */
    function _getTreasuryDetail(address _treasury) internal view returns (TreasuryDetails memory) {
        EchoFiTreasury treasury = EchoFiTreasury(_treasury);
        EchoFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(_treasury);
        
        (uint256 usdcBalance, uint256 aUsdcBalance) = treasury.getTreasuryBalance();
        
        // Count active proposals
        uint256 proposalCount = treasury.proposalCount();
        uint256 activeProposals = 0;
        
        for (uint256 i = 0; i < proposalCount; i++) {
            try treasury.getProposal(i) returns (
                uint256, address, EchoFiTreasury.ProposalType, uint256, address, bytes memory, string memory,
                uint256, uint256, uint256, bool executed, bool cancelled
            ) {
                if (!executed && !cancelled) {
                    activeProposals++;
                }
            } catch {
                // Skip invalid proposals
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
     * @dev Get proposals for a treasury with detailed information
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
            proposals[i] = _getProposalDetail(treasury, proposalId);
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
        return _getProposalDetail(treasury, _proposalId);
    }

    /**
     * @dev Internal function to get proposal details
     */
    function _getProposalDetail(EchoFiTreasury treasury, uint256 _proposalId) 
        internal 
        view 
        returns (ProposalDetails memory) 
    {
        try treasury.getProposal(_proposalId) returns (
            uint256 id,
            address proposer,
            EchoFiTreasury.ProposalType proposalType,
            uint256 amount,
            address,
            bytes memory,
            string memory description,
            uint256 votesFor,
            uint256 votesAgainst,
            uint256 deadline,
            bool executed,
            bool cancelled
        ) {
            bool canExecute = !executed && !cancelled && 
                             block.timestamp > deadline && 
                             _calculateVoteResult(treasury, votesFor, votesAgainst);
            
            string memory status = _getProposalStatus(executed, cancelled, deadline, votesFor, votesAgainst, treasury);
            
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
        } catch {
            // Return empty struct for invalid proposals
            return ProposalDetails({
                id: _proposalId,
                proposer: address(0),
                proposalType: EchoFiTreasury.ProposalType.DEPOSIT_AAVE,
                amount: 0,
                description: "Invalid proposal",
                votesFor: 0,
                votesAgainst: 0,
                deadline: 0,
                executed: false,
                cancelled: false,
                canExecute: false,
                status: "Invalid"
            });
        }
    }

    /**
     * @dev Get member information for a treasury
     */
    function getTreasuryMembers(address _treasury) 
        external 
        view 
        returns (MemberInfo[] memory) 
    {
        EchoFiTreasury treasury = EchoFiTreasury(_treasury);
        EchoFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(_treasury);
        
        // This is a simplified implementation - in reality, you'd need to track members
        // For now, return empty array as member enumeration isn't implemented in the treasury
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
     * @dev Get human-readable proposal status
     */
    function _getProposalStatus(
        bool executed,
        bool cancelled,
        uint256 deadline,
        uint256 votesFor,
        uint256 votesAgainst,
        EchoFiTreasury treasury
    ) internal view returns (string memory) {
        if (executed) return "Executed";
        if (cancelled) return "Cancelled";
        if (block.timestamp <= deadline) return "Active";
        
        bool passes = _calculateVoteResult(treasury, votesFor, votesAgainst);
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
     * @dev Get treasury statistics
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
        
        // Count proposal statuses
        activeProposals = 0;
        executedProposals = 0;
        
        for (uint256 i = 0; i < totalProposals; i++) {
            try treasury.getProposal(i) returns (
                uint256, address, EchoFiTreasury.ProposalType, uint256, address, bytes memory, string memory,
                uint256, uint256, uint256, bool executed, bool cancelled
            ) {
                if (executed) {
                    executedProposals++;
                } else if (!cancelled) {
                    activeProposals++;
                }
            } catch {
                // Skip invalid proposals
            }
        }
    }
}