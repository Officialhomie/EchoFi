// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./GroupFiTreasury.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GroupFiFactory
 * @dev Factory contract for creating and managing GroupFi treasury contracts
 */
contract GroupFiFactory is Ownable, ReentrancyGuard {
    
    struct GroupInfo {
        address treasuryAddress;
        string groupId;
        string xmtpGroupId;
        address creator;
        uint256 createdAt;
        bool isActive;
    }

    mapping(string => GroupInfo) public groups; // groupId => GroupInfo
    mapping(address => string[]) public userGroups; // user => groupIds[]
    mapping(string => address) public xmtpGroupToTreasury; // xmtpGroupId => treasury

    string[] public allGroupIds;
    
    uint256 public totalGroups;
    uint256 public creationFee = 0; // Fee in wei (0 for now)
    
    event GroupCreated(
        string indexed groupId,
        string indexed xmtpGroupId,
        address indexed creator,
        address treasuryAddress
    );
    
    event GroupDeactivated(string indexed groupId, address treasuryAddress);
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Create a new investment group with treasury
     */
    function createGroup(
        string memory groupId,
        string memory xmtpGroupId,
        string memory creatorXmtpAddress,
        GroupFiTreasury.GroupConfig memory config
    ) external payable nonReentrant returns (address) {
        require(msg.value >= creationFee, "Insufficient creation fee");
        require(bytes(groupId).length > 0, "Group ID cannot be empty");
        require(bytes(xmtpGroupId).length > 0, "XMTP Group ID cannot be empty");
        require(groups[groupId].treasuryAddress == address(0), "Group already exists");

        // Deploy new treasury contract
        GroupFiTreasury treasury = new GroupFiTreasury(
            groupId,
            xmtpGroupId,
            msg.sender,
            creatorXmtpAddress,
            config
        );

        address treasuryAddress = address(treasury);

        // Store group info
        groups[groupId] = GroupInfo({
            treasuryAddress: treasuryAddress,
            groupId: groupId,
            xmtpGroupId: xmtpGroupId,
            creator: msg.sender,
            createdAt: block.timestamp,
            isActive: true
        });

        // Add to mappings
        userGroups[msg.sender].push(groupId);
        xmtpGroupToTreasury[xmtpGroupId] = treasuryAddress;
        allGroupIds.push(groupId);
        
        totalGroups++;

        emit GroupCreated(groupId, xmtpGroupId, msg.sender, treasuryAddress);

        return treasuryAddress;
    }

    /**
     * @dev Get treasury address for a group
     */
    function getTreasuryAddress(string memory groupId) external view returns (address) {
        return groups[groupId].treasuryAddress;
    }

    /**
     * @dev Get treasury address by XMTP group ID
     */
    function getTreasuryByXMTP(string memory xmtpGroupId) external view returns (address) {
        return xmtpGroupToTreasury[xmtpGroupId];
    }

    /**
     * @dev Get all groups created by a user
     */
    function getUserGroups(address user) external view returns (string[] memory) {
        return userGroups[user];
    }

    /**
     * @dev Get group information
     */
    function getGroupInfo(string memory groupId) external view returns (GroupInfo memory) {
        return groups[groupId];
    }

    /**
     * @dev Get all group IDs
     */
    function getAllGroups() external view returns (string[] memory) {
        return allGroupIds;
    }

    /**
     * @dev Deactivate a group (only owner)
     */
    function deactivateGroup(string memory groupId) external onlyOwner {
        require(groups[groupId].treasuryAddress != address(0), "Group does not exist");
        
        groups[groupId].isActive = false;
        
        emit GroupDeactivated(groupId, groups[groupId].treasuryAddress);
    }

    /**
     * @dev Update creation fee (only owner)
     */
    function setCreationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = newFee;
        
        emit CreationFeeUpdated(oldFee, newFee);
    }

    /**
     * @dev Withdraw collected fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success,) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Check if group exists and is active
     */
    function isActiveGroup(string memory groupId) external view returns (bool) {
        return groups[groupId].treasuryAddress != address(0) && groups[groupId].isActive;
    }

    /**
     * @dev Get group statistics
     */
    function getGroupStats() external view returns (
        uint256 total,
        uint256 active,
        uint256 totalFees
    ) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allGroupIds.length; i++) {
            if (groups[allGroupIds[i]].isActive) {
                activeCount++;
            }
        }
        
        return (totalGroups, activeCount, address(this).balance);
    }
}