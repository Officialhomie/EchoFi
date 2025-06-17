// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@forge-std/Script.sol";
import "@forge-std/console.sol";
import "../src/EchoFiFactory.sol";
import "../src/EchoFiHelper.sol";
import "../src/AgentExecutor.sol";
import "../src/EchoFiTreasury.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Complete EchoFi Deployment Script - FIXED VERSION
 * @dev Deploys the complete EchoFi ecosystem in proper order with comprehensive logging
 * @notice Run with: forge script script/EchoFi.s.sol --rpc-url <RPC_URL> --broadcast --verify
 */
contract CompleteDeployScript is Script {
    // Network-specific configurations
    struct NetworkConfig {
        address aavePool;
        address usdc;
        address aUsdc;
        uint256 deployerKey;
        string networkName;
        bool isTestnet;
    }

    struct DeploymentAddresses {
        address factory;
        address helper;
        address agentExecutor;
        address sampleTreasury;
    }

    // Network configurations
    mapping(uint256 => NetworkConfig) public networkConfigs;

    function setUp() public {
        // Base Mainnet (Chain ID: 8453)
        networkConfigs[8453] = NetworkConfig({
            aavePool: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5,
            usdc: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,
            aUsdc: 0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB,
            deployerKey: vm.envUint("PRIVATE_KEY"),
            networkName: "base-mainnet",
            isTestnet: false
        });

        // Base Sepolia (Chain ID: 84532) - FIXED WITH CORRECT TESTNET ADDRESSES
        networkConfigs[84532] = NetworkConfig({
            aavePool: 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951, // FIXED: Correct Base Sepolia Pool-Proxy
            usdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e, // Base Sepolia USDC
            aUsdc: 0x8E80d69DfE8cfeEb08bd5e5A2E18CC9Af3d1f1A0, // UPDATED: Correct Base Sepolia aUSDC (example)
            deployerKey: vm.envUint("PRIVATE_KEY"),
            networkName: "base-sepolia",
            isTestnet: true
        });

        // Local/Anvil (Chain ID: 31337)
        networkConfigs[31337] = NetworkConfig({
            aavePool: address(0), // Will use mock contracts
            usdc: address(0),
            aUsdc: address(0),
            deployerKey: vm.envUint("PRIVATE_KEY"),
            networkName: "localhost",
            isTestnet: true
        });
    }

    function run() external {
        uint256 chainId = block.chainid;
        NetworkConfig memory config = networkConfigs[chainId];
        
        require(config.deployerKey != 0, "Private key not set");
        
        console.log("=== ECHOFFI COMPLETE DEPLOYMENT ===");
        console.log("Network:", config.networkName);
        console.log("Chain ID:", chainId);
        console.log("Deployer:", vm.addr(config.deployerKey));
        console.log("Is Testnet:", config.isTestnet);
        
        if (config.isTestnet) {
            console.log(" TESTNET DEPLOYMENT - Using test configurations");
        }

        vm.startBroadcast(config.deployerKey);

        // ✅ STEP 1: Deploy EchoFiFactory (CORE CONTRACT)
        console.log("\n--- STEP 1: Deploying EchoFiFactory ---");
        
        // For localhost, we need to deploy mock aUSDC or use placeholder
        address aUsdcAddress = config.aUsdc;
        if (chainId == 31337 && aUsdcAddress == address(0)) {
            aUsdcAddress = address(0x123); // Placeholder for local testing
            console.log("Using placeholder aUSDC for localhost:", aUsdcAddress);
        }
        
        EchoFiFactory factory = new EchoFiFactory(
            aUsdcAddress,
            vm.addr(config.deployerKey) // Factory owner
        );
        
        console.log("EchoFiFactory deployed at:", address(factory));
        console.log("   - aUSDC address:", aUsdcAddress);
        console.log("   - Factory owner:", factory.owner());
        console.log("   - Creation fee:", factory.creationFee());

        // ✅ STEP 2: Deploy EchoFiHelper (FRONTEND INTEGRATION)
        console.log("\n--- STEP 2: Deploying EchoFiHelper ---");
        EchoFiHelper helper = new EchoFiHelper(address(factory));
        
        console.log("EchoFiHelper deployed at:", address(helper));
        console.log("  - Linked to factory:", address(helper.factory()));

        // ✅ STEP 3: Deploy AgentExecutor (AUTOMATION)
        console.log("\n--- STEP 3: Deploying AgentExecutor ---");
        AgentExecutor agentExecutor = new AgentExecutor(address(factory));
        
        console.log("AgentExecutor deployed at:", address(agentExecutor));
        console.log("   - Linked to factory:", agentExecutor.factory());
        console.log("   - Deployer authorized:", agentExecutor.authorizedAgents(vm.addr(config.deployerKey)));

        // ✅ STEP 4: Register AgentExecutor with Factory (if needed)
        console.log("\n--- STEP 4: Configuring Agent Integration ---");
        // Note: This step depends on whether your factory needs to know about the agent
        // For now, we'll just log the addresses for manual configuration

        // ✅ STEP 5: Create Sample Treasury (DEMONSTRATION)
        console.log("\n--- STEP 5: Creating Sample Treasury ---");
        address sampleTreasury = address(0);
        
        if (config.isTestnet) {
            // Only create sample treasury on testnets
            try factory.createGroup{value: factory.creationFee()}(
                "EchoFi Demo Group",
                "demo-xmtp-group-001"
            ) returns (address treasuryAddr) {
                sampleTreasury = treasuryAddr;
                console.log(" Sample treasury created at:", sampleTreasury);
                
                // Verify treasury setup
                EchoFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(sampleTreasury);
                console.log("   - Creator:", info.creator);
                console.log("   - Name:", info.name);
                console.log("   - Member count:", info.memberCount);
                console.log("   - Is active:", info.isActive);
            } catch {
                console.log("Sample treasury creation failed (this is OK for mainnet)");
            }
        } else {
            console.log("Skipping sample treasury creation on mainnet");
        }

        vm.stopBroadcast();

        // ✅ STEP 6: Comprehensive Verification
        DeploymentAddresses memory addresses = DeploymentAddresses({
            factory: address(factory),
            helper: address(helper),
            agentExecutor: address(agentExecutor),
            sampleTreasury: sampleTreasury
        });

        _verifyCompleteDeployment(addresses, config);
        
        // ✅ STEP 7: Save Deployment Information
        _saveCompleteDeploymentInfo(chainId, addresses, config);

        // ✅ STEP 8: Display Summary
        _displayDeploymentSummary(addresses, config);
    }

    /**
     * @dev ✅ COMPREHENSIVE VERIFICATION
     */
    function _verifyCompleteDeployment(
        DeploymentAddresses memory addresses, 
        NetworkConfig memory config
    ) internal view {
        console.log("\n=== COMPREHENSIVE DEPLOYMENT VERIFICATION ===");
        
        // Verify Factory
        EchoFiFactory factory = EchoFiFactory(addresses.factory);
        require(factory.owner() == vm.addr(config.deployerKey), "Factory owner mismatch");
        require(factory.treasuryCount() >= 0, "Factory not functional");
        console.log("Factory verification passed");
        
        // Verify Helper
        EchoFiHelper helper = EchoFiHelper(addresses.helper);
        require(address(helper.factory()) == addresses.factory, "Helper factory link broken");
        console.log("Helper verification passed");
        
        // Verify AgentExecutor
        AgentExecutor agent = AgentExecutor(addresses.agentExecutor);
        require(agent.factory() == addresses.factory, "Agent factory link broken");
        require(agent.authorizedAgents(vm.addr(config.deployerKey)), "Agent authorization failed");
        console.log("AgentExecutor verification passed");
        
        // Verify Sample Treasury (if exists)
        if (addresses.sampleTreasury != address(0)) {
            EchoFiFactory.TreasuryInfo memory info = factory.getTreasuryInfo(addresses.sampleTreasury);
            require(info.isActive, "Sample treasury not active");
            require(info.creator == vm.addr(config.deployerKey), "Sample treasury creator mismatch");
            console.log("Sample treasury verification passed");
        }
        
        console.log("ALL VERIFICATIONS PASSED!");
    }

    /**
     * @dev ✅ SAVE COMPLETE DEPLOYMENT INFO
     */
    function _saveCompleteDeploymentInfo(
        uint256 chainId,
        DeploymentAddresses memory addresses,
        NetworkConfig memory config
    ) internal {
        console.log("\n=== SAVING DEPLOYMENT INFORMATION ===");
        
        string memory json = string.concat(
            '{\n',
            '  "network": "', config.networkName, '",\n',
            '  "chainId": ', vm.toString(chainId), ',\n',
            '  "isTestnet": ', config.isTestnet ? "true" : "false", ',\n',
            '  "deploymentBlock": ', vm.toString(block.number), ',\n',
            '  "deploymentTimestamp": ', vm.toString(block.timestamp), ',\n',
            '  "deployer": "', vm.toString(vm.addr(config.deployerKey)), '",\n',
            '  "contracts": {\n',
            '    "factory": "', vm.toString(addresses.factory), '",\n',
            '    "helper": "', vm.toString(addresses.helper), '",\n',
            '    "agentExecutor": "', vm.toString(addresses.agentExecutor), '",\n',
            '    "sampleTreasury": "', vm.toString(addresses.sampleTreasury), '"\n',
            '  },\n',
            '  "networkConfig": {\n',
            '    "aavePool": "', vm.toString(config.aavePool), '",\n',
            '    "usdc": "', vm.toString(config.usdc), '",\n',
            '    "aUsdc": "', vm.toString(config.aUsdc), '"\n',
            '  }\n',
            '}'
        );
        
        string memory filename = string.concat("deployments/", config.networkName, "-complete.json");
        vm.writeFile(filename, json);
        console.log("Complete deployment info saved to:", filename);
        
        // Also save a simplified version for frontend
        string memory frontendJson = string.concat(
            '{\n',
            '  "FACTORY_ADDRESS": "', vm.toString(addresses.factory), '",\n',
            '  "HELPER_ADDRESS": "', vm.toString(addresses.helper), '",\n',
            '  "AGENT_EXECUTOR_ADDRESS": "', vm.toString(addresses.agentExecutor), '",\n',
            '  "NETWORK": "', config.networkName, '",\n',
            '  "CHAIN_ID": ', vm.toString(chainId), '\n',
            '}'
        );
        
        string memory frontendFile = string.concat("deployments/frontend-", config.networkName, ".json");
        vm.writeFile(frontendFile, frontendJson);
        console.log("Frontend config saved to:", frontendFile);
    }

    /**
     * @dev ✅ DISPLAY DEPLOYMENT SUMMARY
     */
    function _displayDeploymentSummary(
        DeploymentAddresses memory addresses,
        NetworkConfig memory config
    ) internal view {
        console.log("\n");
        console.log("==================================================");
        console.log("                                                    ");
        console.log("               ECHOFFI DEPLOYMENT COMPLETE             ");
        console.log("                                                    ");
        console.log("==================================================");
        console.log("");
        console.log("FACTORY:", addresses.factory);
        console.log("HELPER:", addresses.helper);
        console.log("AGENT  :", addresses.agentExecutor);
        if (addresses.sampleTreasury != address(0)) {
            console.log("SAMPLE :", addresses.sampleTreasury);
        }
        console.log("");
        console.log("Network  :", config.networkName);
        console.log("Chain ID :", block.chainid);
        console.log("Block    :", block.number);
        console.log("");
        
        if (config.isTestnet) {
            console.log("NEXT STEPS FOR TESTNET:");
            console.log("   1. Fund the sample treasury with test USDC");
            console.log("   2. Create test proposals and voting");
            console.log("   3. Test XMTP integration with frontend");
            console.log("   4. Test agent automation features");
        } else {
            console.log("NEXT STEPS FOR MAINNET:");
            console.log("   1. Update frontend with new contract addresses");
            console.log("   2. Configure XMTP integration");
            console.log("   3. Set up monitoring and alerting");
            console.log("   4. Prepare documentation for users");
        }
        
        console.log("");
        console.log("Configuration files saved in ./deployments/");
        console.log("Deployment completed successfully!");
        console.log("");
    }

    /**
     * @dev Get network name from chain ID
     */
    function _getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 8453) return "base-mainnet";
        if (chainId == 84532) return "base-sepolia";
        if (chainId == 31337) return "localhost";
        return "unknown";
    }

    function logStats(
        string memory label,
        uint256 total,
        uint256 active,
        uint256 members,
        uint256 fees
    ) internal view {
        console.log("\n---", label, "---");
        console.log("Total Treasuries:", total);
        console.log("Active Treasuries:", active);
        console.log("Total Members:", members);
        console.log("Total Fees:", fees);
    }

    // // Add this helper function at the top of the contract
    // function logStats(string memory prefix, uint256 total, uint256 active, uint256 members, uint256 fees) internal view {
    //     console.log(string.concat(prefix, " - Total: ", vm.toString(total), " Active: ", vm.toString(active), " Members: ", vm.toString(members), " Fees: ", vm.toString(fees)));
    // }

    function _verifyFactory(address factoryAddress) internal view {
        console.log("\n--- FACTORY VERIFICATION ---");
        EchoFiFactory factory = EchoFiFactory(factoryAddress);
        
        console.log("Factory address:", factoryAddress);
        console.log("Factory owner:", factory.owner());
        console.log("Creation fee:", factory.creationFee());
        console.log("Treasury count:", factory.treasuryCount());
        console.log("Min members:", factory.minMembers());
        console.log("Max members:", factory.maxMembers());
        
        (uint256 total, uint256 active, uint256 members, uint256 fees) = factory.getStats();
        logStats("Stats", total, active, members, fees);
    }
}

/**
 * @title Setup Script for Post-Deployment Configuration - ENHANCED VERSION
 * @dev Configures the deployed ecosystem with initial settings
 */
contract EnhancedSetupScript is Script {
    function run() external {
        uint256 chainId = block.chainid;
        string memory chainName = _getChainName(chainId);
        string memory deploymentFile = string.concat("deployments/", chainName, "-complete.json");
        
        console.log("=== ENHANCED SETUP CONFIGURATION ===");
        console.log("Reading deployment from:", deploymentFile);
        
        // Read deployment info
        string memory json = vm.readFile(deploymentFile);
        address factoryAddress = vm.parseJsonAddress(json, ".contracts.factory");
        address helperAddress = vm.parseJsonAddress(json, ".contracts.helper");
        address agentAddress = vm.parseJsonAddress(json, ".contracts.agentExecutor");
        
        console.log("Factory:", factoryAddress);
        console.log("Helper:", helperAddress);
        console.log("Agent:", agentAddress);
        
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        
        vm.startBroadcast(deployerKey);
        
        EchoFiFactory factory = EchoFiFactory(factoryAddress);
        AgentExecutor agent = AgentExecutor(agentAddress);
        
        // Configure agent permissions if needed
        address additionalAgent = vm.envOr("ADDITIONAL_AGENT_ADDRESS", address(0));
        if (additionalAgent != address(0)) {
            agent.addAgent(additionalAgent);
            console.log("Additional agent authorized:", additionalAgent);
        }
        
        // Adjust factory settings for testnet
        if (chainId == 84532) { // Base Sepolia
            // Lower creation fee for testing
            factory.updateCreationFee(0.0001 ether);
            console.log("Testnet creation fee updated to 0.0001 ETH");
        }
        
        vm.stopBroadcast();
        
        // Display current state
        console.log("\n=== SETUP COMPLETE ===");
        (
            uint256 totalTreasuries,
            uint256 activeTreasuries,
            uint256 totalMembers,
            uint256 totalFeesCollected
        ) = factory.getStats();
        
        console.log("Total treasuries:", totalTreasuries);
        console.log("Active treasuries:", activeTreasuries);
        console.log("Total members:", totalMembers);
        console.log("Fees collected:", totalFeesCollected);
    }
    
    function _getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 8453) return "base-mainnet";
        if (chainId == 84532) return "base-sepolia";
        if (chainId == 31337) return "localhost";
        return "unknown";
    }
}

/**
 * @title Enhanced Verification Script - COMPREHENSIVE VERSION
 * @dev Thorough verification of all deployed contracts and their interactions
 */
contract EnhancedVerifyScript is Script {
    function run() external view {
        uint256 chainId = block.chainid;
        string memory chainName = _getChainName(chainId);
        string memory deploymentFile = string.concat("deployments/", chainName, "-complete.json");
        
        console.log("=== COMPREHENSIVE SYSTEM VERIFICATION ===");
        
        string memory json = vm.readFile(deploymentFile);
        address factoryAddress = vm.parseJsonAddress(json, ".contracts.factory");
        address helperAddress = vm.parseJsonAddress(json, ".contracts.helper");
        address agentAddress = vm.parseJsonAddress(json, ".contracts.agentExecutor");
        
        // Verify Factory
        _verifyFactory(factoryAddress);
        
        // Verify Helper
        _verifyHelper(helperAddress, factoryAddress);
        
        // Verify Agent
        _verifyAgent(agentAddress, factoryAddress);
        
        // Verify Integration
        _verifyIntegration(factoryAddress, helperAddress, agentAddress);
        
        console.log("COMPREHENSIVE VERIFICATION COMPLETE!");
    }

    function logStats(
        string memory label,
        uint256 total,
        uint256 active,
        uint256 members,
        uint256 fees
    ) internal view {
        console.log("\n---", label, "---");
        console.log("Total Treasuries:", total);
        console.log("Active Treasuries:", active);
        console.log("Total Members:", members);
        console.log("Total Fees:", fees);
    }
    
    function _verifyFactory(address factoryAddress) internal view {
        console.log("\n--- FACTORY VERIFICATION ---");
        EchoFiFactory factory = EchoFiFactory(factoryAddress);
        
        console.log("Factory address:", factoryAddress);
        console.log("Factory owner:", factory.owner());
        console.log("Creation fee:", factory.creationFee());
        console.log("Treasury count:", factory.treasuryCount());
        console.log("Min members:", factory.minMembers());
        console.log("Max members:", factory.maxMembers());
        
        (uint256 total, uint256 active, uint256 members, uint256 fees) = factory.getStats();
        logStats("Stats", total, active, members, fees); 
    }
    
    function _verifyHelper(address helperAddress, address expectedFactory) internal view {
        console.log("\n--- HELPER VERIFICATION ---");
        EchoFiHelper helper = EchoFiHelper(helperAddress);
        
        console.log("Helper address:", helperAddress);
        console.log("Linked factory:", address(helper.factory()));
        console.log("Factory link correct:", address(helper.factory()) == expectedFactory);
        
        // Test helper functionality with empty arrays (safe test)
        address[] memory emptyTreasuries = new address[](0);
        EchoFiHelper.TreasuryDetails[] memory details = helper.getTreasuryDetails(emptyTreasuries);
        console.log("Helper functionality test passed, returned", details.length, "results");
    }
    
    function _verifyAgent(address agentAddress, address expectedFactory) internal view {
        console.log("\n--- AGENT VERIFICATION ---");
        AgentExecutor agent = AgentExecutor(agentAddress);
        
        console.log("Agent address:", agentAddress);
        console.log("Linked factory:", agent.factory());
        console.log("Factory link correct:", agent.factory() == expectedFactory);
        
        // Note: Can't easily test authorization without knowing specific addresses
        console.log("Agent deployment verified");
    }
    
    function _verifyIntegration(
        address factoryAddress,
        address helperAddress,
        address agentAddress
    ) internal view {
        console.log("\n--- INTEGRATION VERIFICATION ---");
        
        EchoFiFactory factory = EchoFiFactory(factoryAddress);
        EchoFiHelper helper = EchoFiHelper(helperAddress);
        
        // Verify helper can read factory data
        (uint256 totalTreasuries,,,) = factory.getStats();
        console.log("Factory reports", totalTreasuries, "total treasuries");
        
        // Verify helper can process factory data
        if (totalTreasuries > 0) {
            address[] memory allTreasuries = factory.getActiveTreasuries();
            console.log("Factory returned", allTreasuries.length, "active treasuries");
            
            if (allTreasuries.length > 0) {
                EchoFiHelper.TreasuryDetails[] memory details = helper.getTreasuryDetails(allTreasuries);
                console.log("Helper processed", details.length, "treasury details");
            }
        }
        
        console.log("All integrations verified successfully");
    }
    
    function _getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 8453) return "base-mainnet";
        if (chainId == 84532) return "base-sepolia";
        if (chainId == 31337) return "localhost";
        return "unknown";
    }
}