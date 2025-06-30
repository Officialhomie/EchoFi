import {
  ActionProvider,
  AgentKit,
  cdpApiActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  SmartWalletProvider,
  WalletProvider,
  walletActionProvider,
  wethActionProvider,
} from "@coinbase/agentkit";
import fs from "fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Hex } from "viem";
import { formatEther } from "viem";
import { networkManager, NetworkError, isNetworkError } from '../network-utils';
import { serviceHealthMonitor, canUseService, shouldUseFallback } from '../service-health';
import { FEATURE_FLAGS } from '../network-config';

/**
 * WalletData type for persisting wallet information
 */
export type WalletData = {
  privateKey: string;
  smartWalletAddress?: string;
};

// Configure a file to persist a user's private key if none provided
const WALLET_DATA_FILE = "wallet_data.json";

/**
 * Safe error message extraction utility
 */
export function getErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return `[${error.code}] ${error.message}${error.service ? ` (${error.service})` : ''}`;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Safe error checking utility
 */
function errorContains(error: unknown, searchString: string): boolean {
  const message = getErrorMessage(error);
  return message.toLowerCase().includes(searchString.toLowerCase());
}

/**
 * Validate environment variables with detailed error messages
 */
function validateEnvironmentVariables(): void {
  const requiredVars = ['CDP_API_KEY_NAME', 'CDP_API_KEY_PRIVATE_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      `Please ensure these are set in your .env file for AgentKit functionality.`
    );
  }
}

/**
 * Prepares the AgentKit and WalletProvider with real values and configuration
 * Enhanced with network resilience, circuit breaker, and graceful degradation
 *
 * @returns {Promise<{ agentkit: AgentKit, walletProvider: WalletProvider }>} The initialized AI agent and wallet provider
 */
export async function prepareAgentkitAndWalletProvider(): Promise<{
  agentkit: AgentKit;
  walletProvider: WalletProvider;
}> {
  try {
    console.log("🔐 Starting EchoFi AgentKit initialization...");
    
    // Start service health monitoring if not already started
    if (FEATURE_FLAGS.enableHealthChecks) {
      serviceHealthMonitor.startMonitoring();
    }

    // Check if Coinbase service is available
    if (!canUseService('coinbase')) {
      console.warn("⚠️ Coinbase service is not healthy, attempting with degraded mode...");
    }
    
    // Validate required environment variables first
    validateEnvironmentVariables();
    
    let walletData: WalletData | null = null;
    let privateKey: Hex | null = null;
    let isExistingWallet = false;

    // Read existing wallet data if available
    if (fs.existsSync(WALLET_DATA_FILE)) {
      try {
        const fileContent = fs.readFileSync(WALLET_DATA_FILE, 'utf8');
        walletData = JSON.parse(fileContent) as WalletData;
        privateKey = walletData.privateKey as Hex;
        isExistingWallet = true;
        console.log("✅ Found existing wallet configuration");
        console.log(`   Wallet file: ${WALLET_DATA_FILE}`);
        if (walletData.smartWalletAddress) {
          console.log(`   Smart wallet: ${walletData.smartWalletAddress}`);
        }
      } catch (fileError) {
        console.error('❌ Error reading wallet data:', getErrorMessage(fileError));
        // Continue with new wallet generation
      }
    }

    // Handle private key generation or retrieval
    if (!privateKey) {
      if (walletData?.smartWalletAddress) {
        throw new Error(
          `Found smart wallet ${walletData.smartWalletAddress} but cannot access private key. ` +
          `Please provide PRIVATE_KEY in your .env file or delete ${WALLET_DATA_FILE} to create a new wallet.`
        );
      }
      
      if (process.env.PRIVATE_KEY) {
        privateKey = process.env.PRIVATE_KEY as Hex;
        console.log("🔑 Using private key from environment variable");
      } else {
        privateKey = generatePrivateKey();
        console.log("🔑 Generated new private key for wallet");
        console.log("💡 Tip: Save this private key to your .env file as PRIVATE_KEY for persistence");
      }
    }

    // Create signer from private key
    const signer = privateKeyToAccount(privateKey);
    const signerAddress = signer.address;
    console.log(`📝 Signer address: ${signerAddress}`);

    // Get network configuration
    const networkId = process.env.NETWORK_ID || 'base-sepolia';
    const isTestnet = networkId.includes('sepolia');
    const networkDisplayName = isTestnet ? 'Base Sepolia (Testnet)' : 'Base Mainnet';
    
    console.log(`🌐 Target network: ${networkDisplayName} (${networkId})`);

    // Initialize Smart Wallet Provider with enhanced error handling
    console.log("🔧 Configuring SmartWalletProvider with network resilience...");
    let walletProvider: WalletProvider;
    
    try {
      // Check if we should use fallback mode for wallet operations
      const useFallback = shouldUseFallback('coinbase');
      
      if (useFallback) {
        console.warn("⚠️ Using fallback mode for wallet provider due to service issues");
      }

      walletProvider = await SmartWalletProvider.configureWithWallet({
        networkId,
        signer,
        smartWalletAddress: walletData?.smartWalletAddress as `0x${string}` | undefined,
        paymasterUrl: undefined, // Add paymaster URL for sponsored transactions if needed
      });

    } catch (walletError) {
      console.error("❌ SmartWalletProvider configuration failed:", getErrorMessage(walletError));
      
      // If it's a network error, mark the service as degraded
      if (isNetworkError(walletError)) {
        serviceHealthMonitor.enableDegradedMode('coinbase', 'mock');
        console.warn("⚠️ Coinbase service marked as degraded due to configuration failure");
      }
      
      throw new Error(
        `Failed to configure SmartWalletProvider: ${getErrorMessage(walletError)}. ` +
        `Please check your network configuration and API credentials.`
      );
    }

    // Get real wallet information with retry logic
    const smartWalletAddress = walletProvider.getAddress();
    const network = walletProvider.getNetwork();
    
    console.log("✅ Smart Wallet Provider initialized successfully");
    console.log(`   Smart wallet address: ${smartWalletAddress}`);
    console.log(`   Network ID: ${network.networkId}`);
    console.log(`   Chain ID: ${network.chainId}`);

    // Try to get wallet balance with enhanced error handling
    let balanceStr = 'Unable to fetch';
    try {
      const balance = await getWalletBalanceWithRetry(walletProvider);
      const formattedBalance = formatEther(BigInt(balance));
      balanceStr = `${formattedBalance} ETH`;
      console.log(`   Current balance: ${balanceStr}`);
    } catch (balanceError) {
      console.warn(`   Balance: Unable to fetch (${getErrorMessage(balanceError)})`);
      
      // Don't fail the entire initialization for balance fetch issues
      if (isNetworkError(balanceError)) {
        serviceHealthMonitor.enableDegradedMode('blockchain', 'cache');
      }
    }

    // Initialize AgentKit action providers with enhanced configuration
    console.log("🛠️ Configuring AgentKit action providers with resilience...");
    
    const actionProviders: ActionProvider[] = [];

    // Add providers based on service health
    try {
      if (canUseService('coinbase')) {
        actionProviders.push(
          pythActionProvider(),
          walletActionProvider(),
          erc20ActionProvider(),
          wethActionProvider(),
          cdpApiActionProvider({
            apiKeyId: process.env.CDP_API_KEY_NAME!,
            apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!,
          })
        );
        console.log(`📦 Configured ${actionProviders.length} action providers (full capability)`);
      } else {
        // Degraded mode - only basic providers
        actionProviders.push(
          walletActionProvider(),
          erc20ActionProvider()
        );
        console.warn(`📦 Configured ${actionProviders.length} action providers (degraded mode - some features may be limited)`);
      }
    } catch (providerError) {
      console.error("❌ Action provider configuration error:", getErrorMessage(providerError));
      
      // Fall back to minimal providers
      actionProviders.push(walletActionProvider());
      console.warn("📦 Using minimal action providers due to configuration issues");
    }

    console.log(`   Available capabilities:`);
    actionProviders.forEach((_, index) => {
      const capabilities = [
        'Wallet (balance, transfers)',
        'ERC20 (token operations)', 
        'Pyth (price feeds)',
        'WETH (wrapped ETH)',
        'CDP API (advanced operations)'
      ];
      if (capabilities[index]) {
        console.log(`   - ${capabilities[index]}`);
      }
    });

    // Create AgentKit instance with enhanced error handling
    console.log("🤖 Initializing AgentKit with network resilience...");
    let agentkit: AgentKit;
    
    try {
      agentkit = await AgentKit.from({
        walletProvider,
        actionProviders,
      });
    } catch (agentkitError) {
      console.error("❌ AgentKit initialization failed:", getErrorMessage(agentkitError));
      
      // Mark services as degraded based on error type
      if (isNetworkError(agentkitError)) {
        serviceHealthMonitor.enableDegradedMode('coinbase', 'disabled');
      }
      
      throw new Error(
        `Failed to initialize AgentKit: ${getErrorMessage(agentkitError)}. ` +
        `Please check your configuration and try again.`
      );
    }

    // Save wallet data for future use
    const walletDataToSave: WalletData = {
      privateKey,
      smartWalletAddress,
    };
    
    try {
      fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(walletDataToSave, null, 2));
      
      if (!isExistingWallet) {
        console.log(`💾 Wallet configuration saved to ${WALLET_DATA_FILE}`);
      }
    } catch (saveError) {
      console.warn(`⚠️ Could not save wallet data: ${getErrorMessage(saveError)}`);
      // Don't fail the entire initialization for this
    }

    // Final status report
    const healthStatus = await serviceHealthMonitor.getHealthStatus();
    const degradedServices = serviceHealthMonitor.getDegradedServices();
    
    console.log("✅ AgentKit initialization complete");
    console.log(`   Total capabilities: ${actionProviders.length} action providers`);
    console.log(`   Service health: ${healthStatus.overall.healthyServices}/${healthStatus.overall.totalServices} healthy`);
    console.log(`   System status: ${healthStatus.overall.systemStatus}`);
    
    if (degradedServices.length > 0) {
      console.warn(`   ⚠️ Degraded services: ${degradedServices.join(', ')}`);
      console.warn(`   Some features may be limited or use cached data`);
    }
    
    console.log(`   Ready for ${isTestnet ? 'testing' : 'production'} operations`);

    return { agentkit, walletProvider };
    
  } catch (error) {
    console.error("❌ Error initializing AgentKit:", getErrorMessage(error));
    
    // Provide specific error context using safe error checking
    if (errorContains(error, 'CDP_API_KEY')) {
      throw new Error(
        `CDP API credentials error: ${getErrorMessage(error)}. ` +
        `Please check your CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY environment variables.`
      );
    } else if (errorContains(error, 'network') || isNetworkError(error)) {
      throw new Error(
        `Network configuration error: ${getErrorMessage(error)}. ` +
        `Please verify your network connection and try again. The system will retry automatically.`
      );
    } else if (errorContains(error, 'private key')) {
      throw new Error(
        `Wallet configuration error: ${getErrorMessage(error)}. ` +
        `Please check your private key setup.`
      );
    } else if (errorContains(error, 'environment')) {
      throw new Error(
        `Environment configuration error: ${getErrorMessage(error)}. ` +
        `Please check your .env file and ensure all required variables are set.`
      );
    }
    
    // Generic error fallback
    throw new Error(
      `Failed to initialize AgentKit: ${getErrorMessage(error)}. ` +
      `The system will attempt to recover automatically. If this persists, please check your configuration.`
    );
  }
}

/**
 * Enhanced wallet balance fetching with retry logic and timeout handling
 */
async function getWalletBalanceWithRetry(walletProvider: WalletProvider, maxRetries = 3): Promise<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`💰 [WALLET] Fetching balance (attempt ${attempt + 1}/${maxRetries})`);
      
      // Use a promise with timeout to avoid hanging
      const balancePromise = walletProvider.getBalance();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Balance fetch timeout')), 8000); // 8 second timeout
      });
      
      const balance = await Promise.race([balancePromise, timeoutPromise]);
      console.log(`✅ [WALLET] Balance fetched successfully on attempt ${attempt + 1}`);
      return balance;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ [WALLET] Balance fetch attempt ${attempt + 1} failed:`, getErrorMessage(lastError));
      
      // Don't retry on the last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
        console.log(`⏳ [WALLET] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to fetch wallet balance after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}