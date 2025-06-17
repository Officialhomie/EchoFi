// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./EchoFiTreasury.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EchoFiFactory
 * @dev Factory contract for deploying and managing EchoFi treasury instances
 * @notice Enables easy creation of new investment groups with standardized configurations
 */
contract EchoFiFactory is Ownable, ReentrancyGuard {
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
     * @dev Create a new EchoFi treasury
     * @param _name Name of the investment group
     * @param _description Description of the group's purpose
     * @param _members Array of member addresses
     * @param _votingPowers Array of voting powers corresponding to members
     */
    function createTreasury(
        string memory _name,
        string memory _description,
        address[] memory _members,
        uint256[] memory _votingPowers
    ) external payable nonReentrant returns (address) {
        // Validate creation fee
        if (msg.value < creationFee) revert InsufficientFee();
        
        // Validate member count
        if (_members.length < minMembers || _members.length > maxMembers) {
            revert InvalidMemberCount();
        }
        
        // Validate voting powers
        if (_members.length != _votingPowers.length) {
            revert InvalidVotingPowers();
        }
        
        uint256 totalVotingPower = 0;
        for (uint256 i = 0; i < _votingPowers.length; i++) {
            totalVotingPower += _votingPowers[i];
        }
        
        if (totalVotingPower != 100) {
            revert InvalidVotingPowers();
        }

        // Deploy new treasury
        EchoFiTreasury treasury = new EchoFiTreasury(
            aUSDC,
            _members,
            _votingPowers
        );
        
        address treasuryAddress = address(treasury);
        
        // Store treasury info
        treasuries[treasuryAddress] = TreasuryInfo({
            treasuryAddress: treasuryAddress,
            creator: msg.sender,
            name: _name,
            description: _description,
            memberCount: _members.length,
            totalVotingPower: totalVotingPower,
            createdAt: block.timestamp,
            isActive: true
        });
        
        // Update registries
        allTreasuries.push(treasuryAddress);
        
        for (uint256 i = 0; i < _members.length; i++) {
            userTreasuries[_members[i]].push(treasuryAddress);
        }
        
        emit TreasuryCreated(
            treasuryAddress,
            msg.sender,
            _name,
            _members.length,
            treasuryCount
        );
        
        treasuryCount++;
        
        return treasuryAddress;
    }

    /**
     * @dev ✅ FIX: Alternative createGroup function for test compatibility - CLEANED UP WARNINGS
     * @param _name Name of the group
     * @param _xmtpGroupId XMTP group identifier (for future use)
     * @param _creatorXmtp Creator's XMTP identifier (for future use)
     * @param _config Group configuration (for future use)
     */
    function createGroup(
        string memory _name,
        string memory _xmtpGroupId,
        string memory /* _creatorXmtp */, // ✅ FIX: Commented out unused parameter
        EchoFiTreasury.GroupConfig memory /* _config */ // ✅ FIX: Commented out unused parameter
    ) external payable nonReentrant returns (address) {
        // Validate creation fee
        if (msg.value < creationFee) revert InsufficientFee();
        
        // Create single-member treasury initially (can add members later)
        address[] memory initialMembers = new address[](1);
        uint256[] memory initialVotingPowers = new uint256[](1);
        initialMembers[0] = msg.sender;
        initialVotingPowers[0] = 100;

        // Deploy new treasury with config
        EchoFiTreasury treasury = new EchoFiTreasury(
            aUSDC,
            initialMembers,
            initialVotingPowers
        );
        
        address treasuryAddress = address(treasury);
        
        // Store treasury info
        treasuries[treasuryAddress] = TreasuryInfo({
            treasuryAddress: treasuryAddress,
            creator: msg.sender,
            name: _name,
            description: string(abi.encodePacked("XMTP Group: ", _xmtpGroupId)),
            memberCount: 1,
            totalVotingPower: 100,
            createdAt: block.timestamp,
            isActive: true
        });
        
        // Update registries
        allTreasuries.push(treasuryAddress);
        userTreasuries[msg.sender].push(treasuryAddress);
        
        emit TreasuryCreated(
            treasuryAddress,
            msg.sender,
            _name,
            1,
            treasuryCount
        );
        
        treasuryCount++;
        
        return treasuryAddress;
    }

    /**
     * @dev Get treasury information
     */
    function getTreasuryInfo(address _treasury) external view returns (TreasuryInfo memory) {
        return treasuries[_treasury];
    }

    /**
     * @dev Get user's treasuries
     */
    function getUserTreasuries(address _user) external view returns (address[] memory) {
        return userTreasuries[_user];
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
        
        // Build active treasuries array
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
     * @dev Update treasury status (only treasury creator)
     */
    function updateTreasuryStatus(address _treasury, bool _isActive) external {
        TreasuryInfo storage info = treasuries[_treasury];
        if (info.treasuryAddress == address(0)) revert TreasuryNotFound();
        if (info.creator != msg.sender) revert UnauthorizedAccess();
        
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