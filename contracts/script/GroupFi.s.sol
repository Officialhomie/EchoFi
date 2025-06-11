// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@forge-std/Script.sol";
import "@forge-std/console.sol";
import "../src/GroupFiTreasury.sol";

/**
 * @title Deploy Script for GroupFiTreasury
 * @dev Deploys GroupFiTreasury contract with network-specific configurations
 * @notice Run with: forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast --verify
 */
contract DeployScript is Script {
    // Network-specific configurations
    struct NetworkConfig {
        address aavePool;
        address usdc;
        address aUsdc;
        uint256 deployerKey;
        address[] initialMembers;
        uint256[] votingPowers;
    }

    // Network configurations
    mapping(uint256 => NetworkConfig) public networkConfigs;

    function setUp() public {
        // Base Mainnet (Chain ID: 8453)
        networkConfigs[8453] = NetworkConfig({
            aavePool: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5,
            usdc: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,
            aUsdc: 0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB, // aUSDC on Base
            deployerKey: vm.envUint("PRIVATE_KEY"),
            initialMembers: _getMainnetMembers(),
            votingPowers: _getMainnetVotingPowers()
        });

        // Base Sepolia (Chain ID: 84532)
        networkConfigs[84532] = NetworkConfig({
            aavePool: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5, // Using same for testnet
            usdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e,
            aUsdc: 0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB, // Placeholder - update with actual testnet address
            deployerKey: vm.envUint("PRIVATE_KEY"),
            initialMembers: _getTestnetMembers(),
            votingPowers: _getTestnetVotingPowers()
        });
    }

    function run() external {
        uint256 chainId = block.chainid;
        NetworkConfig memory config = networkConfigs[chainId];
        
        require(config.aavePool != address(0), "Unsupported network");
        require(config.deployerKey != 0, "Private key not set");
        
        console.log("Deploying on chain ID:", chainId);
        console.log("Aave Pool:", config.aavePool);
        console.log("USDC:", config.usdc);
        console.log("aUSDC:", config.aUsdc);

        vm.startBroadcast(config.deployerKey);

        // Deploy GroupFiTreasury
        GroupFiTreasury treasury = new GroupFiTreasury(
            config.initialMembers,
            config.votingPowers,
            config.aUsdc
        );

        vm.stopBroadcast();

        // Log deployment info
        console.log("=== DEPLOYMENT SUCCESSFUL ===");
        console.log("GroupFiTreasury deployed at:", address(treasury));
        console.log("Deployer:", vm.addr(config.deployerKey));
        console.log("Initial members:", config.initialMembers.length);
        console.log("Total voting power:", treasury.totalVotingPower());
        
        // Verify deployment
        _verifyDeployment(treasury, config);
        
        // Save deployment info
        _saveDeploymentInfo(chainId, address(treasury), config);
    }

    function _getMainnetMembers() internal pure returns (address[] memory) {
        address[] memory members = new address[](3);
        // Replace with actual mainnet addresses
        members[0] = 0x1234567890123456789012345678901234567890; // Member 1
        members[1] = 0x2345678901234567890123456789012345678901; // Member 2  
        members[2] = 0x3456789012345678901234567890123456789012; // Member 3
        return members;
    }

    function _getMainnetVotingPowers() internal pure returns (uint256[] memory) {
        uint256[] memory powers = new uint256[](3);
        powers[0] = 40; // 40%
        powers[1] = 35; // 35%
        powers[2] = 25; // 25%
        return powers;
    }

    function _getTestnetMembers() internal pure returns (address[] memory) {
        address[] memory members = new address[](3);
        // Testnet addresses - replace with actual test addresses
        members[0] = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // Default anvil address 1
        members[1] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // Default anvil address 2
        members[2] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // Default anvil address 3
        return members;
    }

    function _getTestnetVotingPowers() internal pure returns (uint256[] memory) {
        uint256[] memory powers = new uint256[](3);
        powers[0] = 40;
        powers[1] = 35; 
        powers[2] = 25;
        return powers;
    }

    function _verifyDeployment(GroupFiTreasury treasury, NetworkConfig memory config) internal view {
        console.log("=== DEPLOYMENT VERIFICATION ===");
        
        // Check basic contract state
        require(treasury.totalVotingPower() == 100, "Total voting power mismatch");
        require(treasury.quorumPercentage() == 51, "Default quorum mismatch");
        require(treasury.votingPeriod() == 3 days, "Default voting period mismatch");
        
        // Check member roles
        for (uint256 i = 0; i < config.initialMembers.length; i++) {
            address member = config.initialMembers[i];
            require(treasury.hasRole(treasury.PROPOSER_ROLE(), member), "Missing proposer role");
            require(treasury.hasRole(treasury.VOTER_ROLE(), member), "Missing voter role");
            require(treasury.hasRole(treasury.EXECUTOR_ROLE(), member), "Missing executor role");
            require(treasury.memberVotingPower(member) == config.votingPowers[i], "Voting power mismatch");
        }
        
        console.log("✓ All deployment verifications passed");
    }

    function _saveDeploymentInfo(uint256 chainId, address treasuryAddress, NetworkConfig memory config) internal {
        string memory chainName = _getChainName(chainId);
        
        console.log("=== DEPLOYMENT INFO ===");
        console.log("Network:", chainName);
        console.log("Chain ID:", chainId);
        console.log("Treasury Address:", treasuryAddress);
        console.log("Block Number:", block.number);
        console.log("Block Timestamp:", block.timestamp);
        
        // Write to file for frontend integration
        string memory json = string.concat(
            '{\n',
            '  "network": "', chainName, '",\n',
            '  "chainId": ', vm.toString(chainId), ',\n',
            '  "treasuryAddress": "', vm.toString(treasuryAddress), '",\n',
            '  "aavePool": "', vm.toString(config.aavePool), '",\n',
            '  "usdc": "', vm.toString(config.usdc), '",\n',
            '  "aUsdc": "', vm.toString(config.aUsdc), '",\n',
            '  "deploymentBlock": ', vm.toString(block.number), ',\n',
            '  "deploymentTimestamp": ', vm.toString(block.timestamp), '\n',
            '}'
        );
        
        string memory filename = string.concat("deployments/", chainName, ".json");
        vm.writeFile(filename, json);
        console.log("Deployment info saved to:", filename);
    }

    function _getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 8453) return "base-mainnet";
        if (chainId == 84532) return "base-sepolia";
        if (chainId == 31337) return "localhost";
        return "unknown";
    }
}

/**
 * @title Setup Script for Initial Treasury Configuration
 * @dev Sets up the treasury with initial funding and agent roles
 */
contract SetupScript is Script {
    function run() external {
        uint256 chainId = block.chainid;
        string memory chainName = _getChainName(chainId);
        string memory deploymentFile = string.concat("deployments/", chainName, ".json");
        
        // Read deployment info
        string memory json = vm.readFile(deploymentFile);
        address treasuryAddress = vm.parseJsonAddress(json, ".treasuryAddress");
        address usdcAddress = vm.parseJsonAddress(json, ".usdc");
        
        console.log("Setting up treasury at:", treasuryAddress);
        
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        
        vm.startBroadcast(deployerKey);
        
        GroupFiTreasury treasury = GroupFiTreasury(treasuryAddress);
        IERC20 usdc = IERC20(usdcAddress);
        
        // Add agent role for automation (optional)
        address agentAddress = vm.envOr("AGENT_ADDRESS", address(0));
        if (agentAddress != address(0)) {
            treasury.grantRole(treasury.AGENT_ROLE(), agentAddress);
            console.log("Agent role granted to:", agentAddress);
        }
        
        // Fund treasury if deployer has USDC
        uint256 deployerBalance = usdc.balanceOf(deployer);
        if (deployerBalance > 0) {
            uint256 fundAmount = deployerBalance / 2; // Fund with 50% of deployer balance
            usdc.transfer(treasuryAddress, fundAmount);
            console.log("Treasury funded with USDC:", fundAmount);
        }
        
        vm.stopBroadcast();
        
        console.log("=== SETUP COMPLETE ===");
        (uint256 usdcBalance, uint256 aUsdcBalance) = treasury.getTreasuryBalance();
        console.log("Treasury USDC balance:", usdcBalance);
        console.log("Treasury aUSDC balance:", aUsdcBalance);
    }
    
    function _getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 8453) return "base-mainnet";
        if (chainId == 84532) return "base-sepolia";
        if (chainId == 31337) return "localhost";
        return "unknown";
    }
}

/**
 * @title Verify Script for Post-Deployment Verification
 * @dev Comprehensive verification of deployed contract functionality
 */
contract VerifyScript is Script {
    function run() external view {
        uint256 chainId = block.chainid;
        string memory chainName = _getChainName(chainId);
        string memory deploymentFile = string.concat("deployments/", chainName, ".json");
        
        string memory json = vm.readFile(deploymentFile);
        address treasuryAddress = vm.parseJsonAddress(json, ".treasuryAddress");
        
        console.log("=== VERIFYING DEPLOYMENT ===");
        console.log("Treasury Address:", treasuryAddress);
        
        GroupFiTreasury treasury = GroupFiTreasury(treasuryAddress);
        
        // Verify contract state
        console.log("Total Voting Power:", treasury.totalVotingPower());
        console.log("Quorum Percentage:", treasury.quorumPercentage());
        console.log("Voting Period:", treasury.votingPeriod());
        console.log("Min Proposal Amount:", treasury.minProposalAmount());
        console.log("Max Proposal Amount:", treasury.maxProposalAmount());
        console.log("Proposal Count:", treasury.proposalCount());
        
        // Check treasury balances
        (uint256 usdcBalance, uint256 aUsdcBalance) = treasury.getTreasuryBalance();
        console.log("USDC Balance:", usdcBalance);
        console.log("aUSDC Balance:", aUsdcBalance);
        
        // Check if contract is paused
        bool isPaused = treasury.paused();
        console.log("Contract Paused:", isPaused);
        
        console.log("✓ Verification complete");
    }
    
    function _getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 8453) return "base-mainnet";
        if (chainId == 84532) return "base-sepolia";
        if (chainId == 31337) return "localhost";
        return "unknown";
    }
}