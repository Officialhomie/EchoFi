// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./EchoFiFactory.sol";
import "./EchoFiTreasury.sol";

/**
 * @title EchoFiHelper - FULLY OPTIMIZED VERSION
 * @dev Helper contract for frontend integration and treasury management
 * @notice All warnings eliminated and stack depth optimized
 */
contract EchoFiHelper {
    // ✅ Simplified treasury details struct to reduce stack usage
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

    // ✅ Split proposal details into smaller structs to reduce stack depth
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

    // ✅ Member info struct for treasury member enumeration
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
     * @dev ✅ OPTIMIZED: Reduced function complexity to avoid stack depth issues
     */
    function getTreasuryDetails(address[] calldata _treasuries) 
        external 
        view 
        returns (TreasuryDetails[] memory) 
    {
        TreasuryDetails[] memory details = new TreasuryDetails[](_treasuries.length);
        
        for (uint256 i = 0; i < _treasuries.length; i++) {
            details[i] = _getTreasuryDetailOptimized(_treasuries[i]);
        }
        
        return details;
    }

    /**
     * @dev ✅ OPTIMIZED: Simplified treasury detail fetching to reduce stack variables
     */
    function _getTreasuryDetailOptimized(address _treasury) internal view returns (TreasuryDetails memory) {
        EchoFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(_treasury);
        
        // ✅ FIX: Split balance fetching to reduce stack usage
        (uint256 usdcBal, uint256 aUsdcBal) = _getTreasuryBalances(_treasury);
        
        // ✅ FIX: Calculate active proposals in separate call to reduce stack depth
        uint256 activeProp = _getActiveProposalCount(_treasury);
        
        return TreasuryDetails({
            treasuryAddress: _treasury,
            name: info.name,
            memberCount: info.memberCount,
            totalVotingPower: info.totalVotingPower,
            usdcBalance: usdcBal,
            aUsdcBalance: aUsdcBal,
            activeProposals: activeProp,
            isActive: info.isActive
        });
    }

    /**
     * @dev ✅ EXTRACTED: Separate function for balance fetching to reduce stack depth
     */
    function _getTreasuryBalances(address _treasury) internal view returns (uint256, uint256) {
        try EchoFiTreasury(_treasury).getTreasuryBalance() returns (uint256 usdc, uint256 aUsdc) {
            return (usdc, aUsdc);
        } catch {
            return (0, 0);
        }
    }

    /**
     * @dev ✅ EXTRACTED: Separate function for counting active proposals
     */
    function _getActiveProposalCount(address _treasury) internal view returns (uint256) {
        try EchoFiTreasury(_treasury).proposalCount() returns (uint256 count) {
            uint256 active = 0;
            for (uint256 i = 0; i < count; i++) {
                if (_isProposalActive(_treasury, i)) {
                    active++;
                }
            }
            return active;
        } catch {
            return 0;
        }
    }

    /**
     * @dev ✅ EXTRACTED: Check if individual proposal is active
     */
    function _isProposalActive(address _treasury, uint256 _proposalId) internal view returns (bool) {
        try EchoFiTreasury(_treasury).getProposalBasic(_proposalId) returns (
            EchoFiTreasury.ProposalData memory,
            EchoFiTreasury.VotingData memory voting
        ) {
            return !voting.executed && !voting.cancelled;
        } catch {
            return false;
        }
    }

    /**
     * @dev ✅ OPTIMIZED: Simplified proposal fetching with reduced stack usage
     */
    function getTreasuryProposals(address _treasury, uint256 _limit) 
        external 
        view 
        returns (ProposalDetails[] memory) 
    {
        uint256 proposalCount = _getProposalCount(_treasury);
        
        if (proposalCount == 0) {
            return new ProposalDetails[](0);
        }
        
        uint256 limit = (_limit > 0 && _limit < proposalCount) ? _limit : proposalCount;
        ProposalDetails[] memory proposals = new ProposalDetails[](limit);
        
        for (uint256 i = 0; i < limit; i++) {
            uint256 proposalId = proposalCount - 1 - i; // Get newest first
            proposals[i] = _getProposalDetailSimplified(_treasury, proposalId);
        }
        
        return proposals;
    }

    /**
     * @dev ✅ HELPER: Get proposal count safely
     */
    function _getProposalCount(address _treasury) internal view returns (uint256) {
        try EchoFiTreasury(_treasury).proposalCount() returns (uint256 count) {
            return count;
        } catch {
            return 0;
        }
    }

    /**
     * @dev ✅ OPTIMIZED: Simplified proposal detail function with minimal stack usage
     */
    function _getProposalDetailSimplified(address _treasury, uint256 _proposalId) 
        internal 
        view 
        returns (ProposalDetails memory) 
    {
        try EchoFiTreasury(_treasury).getProposalBasic(_proposalId) returns (
            EchoFiTreasury.ProposalData memory data,
            EchoFiTreasury.VotingData memory voting
        ) {
            // ✅ FIX: Calculate status in separate function to reduce stack usage
            string memory status = _calculateProposalStatus(_treasury, voting);
            bool canExecute = _calculateCanExecute(_treasury, voting);
            
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
            // Return safe empty struct for invalid proposals
            return _getEmptyProposalDetails(_proposalId);
        }
    }

    /**
     * @dev ✅ EXTRACTED: Separate function for status calculation
     */
    function _calculateProposalStatus(address _treasury, EchoFiTreasury.VotingData memory voting) 
        internal 
        view 
        returns (string memory) 
    {
        if (voting.executed) return "Executed";
        if (voting.cancelled) return "Cancelled";
        if (block.timestamp <= voting.deadline) return "Active";
        
        // Check if proposal passes
        try EchoFiTreasury(_treasury).quorumPercentage() returns (uint256 quorum) {
            try EchoFiTreasury(_treasury).totalVotingPower() returns (uint256 totalPower) {
                uint256 totalVotes = voting.votesFor + voting.votesAgainst;
                uint256 requiredQuorum = (totalPower * quorum) / 100;
                
                if (totalVotes >= requiredQuorum && voting.votesFor > voting.votesAgainst) {
                    return "Passed - Ready to Execute";
                }
            } catch {}
        } catch {}
        
        return "Failed";
    }

    /**
     * @dev ✅ EXTRACTED: Separate function for execution eligibility
     */
    function _calculateCanExecute(address _treasury, EchoFiTreasury.VotingData memory voting) 
        internal 
        view 
        returns (bool) 
    {
        if (voting.executed || voting.cancelled || block.timestamp <= voting.deadline) {
            return false;
        }
        
        // Check quorum and majority
        try EchoFiTreasury(_treasury).quorumPercentage() returns (uint256 quorum) {
            try EchoFiTreasury(_treasury).totalVotingPower() returns (uint256 totalPower) {
                uint256 totalVotes = voting.votesFor + voting.votesAgainst;
                uint256 requiredQuorum = (totalPower * quorum) / 100;
                
                return totalVotes >= requiredQuorum && voting.votesFor > voting.votesAgainst;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }

    /**
     * @dev ✅ HELPER: Create empty proposal details for error cases
     */
    function _getEmptyProposalDetails(uint256 _proposalId) internal pure returns (ProposalDetails memory) {
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

    /**
     * @dev ✅ FIXED: Get member information for a treasury - WARNING ELIMINATED
     * @notice This function is marked as pure since it returns empty data for MVP
     * @dev Future implementation would require treasury contract modifications for member enumeration
     */
    function getTreasuryMembers(address /* _treasury */) 
        external 
        pure  // ✅ FIXED: Changed from view to pure to eliminate warning
        returns (MemberInfo[] memory) 
    {
        // ✅ FIXED: Removed unused variable to eliminate warning
        // EchoFiTreasury treasury = EchoFiTreasury(_treasury); // Removed this line
        
        // ✅ IMPLEMENTATION NOTE: For MVP, we return empty array
        // Full implementation requires architectural decisions:
        
        // OPTION 1: Modify EchoFiTreasury to store member addresses
        // OPTION 2: Index role events off-chain for member discovery  
        // OPTION 3: Use factory registry to track treasury membership
        
        MemberInfo[] memory emptyMembers = new MemberInfo[](0);
        return emptyMembers;
        
        // ✅ FUTURE ENHANCEMENT: When treasury supports member enumeration:
        /*
        EchoFiTreasury treasury = EchoFiTreasury(_treasury);
        address[] memory memberAddresses = treasury.getMembers(); // Would need this function
        MemberInfo[] memory members = new MemberInfo[](memberAddresses.length);
        
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            address member = memberAddresses[i];
            members[i] = MemberInfo({
                memberAddress: member,
                votingPower: treasury.memberVotingPower(member),
                hasProposerRole: treasury.hasRole(treasury.PROPOSER_ROLE(), member),
                hasVoterRole: treasury.hasRole(treasury.VOTER_ROLE(), member),
                hasExecutorRole: treasury.hasRole(treasury.EXECUTOR_ROLE(), member)
            });
        }
        
        return members;
        */
    }

    /**
     * @dev ✅ OPTIMIZED: Simplified voting eligibility check
     */
    function canUserVote(address _treasury, uint256 _proposalId, address _user) 
        external 
        view 
        returns (bool canVote, string memory reason) 
    {
        EchoFiTreasury treasury = EchoFiTreasury(_treasury);
        
        // ✅ FIX: Simplified checks to reduce stack depth
        return _checkVotingEligibility(treasury, _proposalId, _user);
    }

    /**
     * @dev ✅ EXTRACTED: Voting eligibility logic in separate function
     */
    function _checkVotingEligibility(EchoFiTreasury treasury, uint256 _proposalId, address _user) 
        internal 
        view 
        returns (bool, string memory) 
    {
        // Check voting power first
        uint256 userVotingPower = treasury.memberVotingPower(_user);
        if (userVotingPower == 0) {
            return (false, "User has no voting power");
        }
        
        // Check if proposal exists
        try treasury.proposalCount() returns (uint256 count) {
            if (_proposalId >= count) {
                return (false, "Proposal does not exist");
            }
        } catch {
            return (false, "Failed to retrieve proposal count");
        }
        
        // Check if already voted
        if (treasury.hasVoted(_proposalId, _user)) {
            return (false, "User has already voted");
        }
        
        // Check proposal status
        try treasury.getProposalBasic(_proposalId) returns (
            EchoFiTreasury.ProposalData memory,
            EchoFiTreasury.VotingData memory voting
        ) {
            if (voting.executed) return (false, "Proposal already executed");
            if (voting.cancelled) return (false, "Proposal was cancelled");
            if (block.timestamp > voting.deadline) return (false, "Voting period has ended");
            
            return (true, "Can vote");
        } catch {
            return (false, "Failed to retrieve proposal details");
        }
    }

    /**
     * @dev ✅ OPTIMIZED: Simplified treasury statistics
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
        
        // ✅ FIX: Get basic stats first
        totalProposals = _getProposalCount(_treasury);
        totalVotingPower = _getTotalVotingPower(treasury);
        
        // ✅ FIX: Get treasury value
        (uint256 usdcBalance, uint256 aUsdcBalance) = _getTreasuryBalances(_treasury);
        treasuryValue = usdcBalance + aUsdcBalance;
        
        // ✅ FIX: Get proposal counts separately to avoid stack depth
        (activeProposals, executedProposals) = _getProposalStatistics(_treasury, totalProposals);
    }

    /**
     * @dev ✅ EXTRACTED: Get total voting power safely
     */
    function _getTotalVotingPower(EchoFiTreasury treasury) internal view returns (uint256) {
        try treasury.totalVotingPower() returns (uint256 power) {
            return power;
        } catch {
            return 0;
        }
    }

    /**
     * @dev ✅ EXTRACTED: Get proposal statistics to reduce stack depth
     */
    function _getProposalStatistics(address _treasury, uint256 totalProposals) 
        internal 
        view 
        returns (uint256 active, uint256 executed) 
    {
        active = 0;
        executed = 0;
        
        for (uint256 i = 0; i < totalProposals; i++) {
            try EchoFiTreasury(_treasury).getProposalBasic(i) returns (
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
                continue;
            }
        }
    }

    /**
     * @dev ✅ OPTIMIZED: Batch function to get user's treasury details
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
     * @dev Get detailed information about a single treasury (public wrapper)
     */
    function getTreasuryDetail(address _treasury) external view returns (TreasuryDetails memory) {
        return _getTreasuryDetailOptimized(_treasury);
    }

    /**
     * @dev Get detailed information about a specific proposal (public wrapper)
     */
    function getProposalDetail(address _treasury, uint256 _proposalId) 
        external 
        view 
        returns (ProposalDetails memory) 
    {
        return _getProposalDetailSimplified(_treasury, _proposalId);
    }
}