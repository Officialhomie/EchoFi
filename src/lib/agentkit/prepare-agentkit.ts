// src/lib/agentkit/prepare-agentkit.ts
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
 *
 * @returns {Promise<{ agentkit: AgentKit, walletProvider: WalletProvider }>} The initialized AI agent and wallet provider
 */
export async function prepareAgentkitAndWalletProvider(): Promise<{
  agentkit: AgentKit;
  walletProvider: WalletProvider;
}> {
  try {
    console.log("🔐 Starting EchoFi AgentKit initialization...");
    
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

    // Initialize Smart Wallet Provider with proper error handling
    console.log("🔧 Configuring SmartWalletProvider...");
    let walletProvider: WalletProvider;
    
    try {
      walletProvider = await SmartWalletProvider.configureWithWallet({
        networkId,
        signer,
        smartWalletAddress: walletData?.smartWalletAddress as `0x${string}` | undefined,
        paymasterUrl: undefined, // Add paymaster URL for sponsored transactions if needed
      });
    } catch (walletError) {
      console.error("❌ SmartWalletProvider configuration failed:", getErrorMessage(walletError));
      throw new Error(
        `Failed to configure SmartWalletProvider: ${getErrorMessage(walletError)}. ` +
        `Please check your network configuration and API credentials.`
      );
    }

    // Get real wallet information
    const smartWalletAddress = walletProvider.getAddress();
    const network = walletProvider.getNetwork();
    
    console.log("✅ Smart Wallet Provider initialized successfully");
    console.log(`   Smart wallet address: ${smartWalletAddress}`);
    console.log(`   Network ID: ${network.networkId}`);
    console.log(`   Chain ID: ${network.chainId}`);

    // Try to get wallet balance for display
    try {
      const balance = await walletProvider.getBalance();
      const formattedBalance = formatEther(BigInt(balance));
      console.log(`   Current balance: ${formattedBalance} ETH`);
    } catch (balanceError) {
      console.log(`   Balance: Unable to fetch (${getErrorMessage(balanceError)})`);
    }

    // Initialize AgentKit action providers with real configuration
    console.log("🛠️ Configuring AgentKit action providers...");
    
    const actionProviders: ActionProvider[] = [
      pythActionProvider(),
      walletActionProvider(),
      erc20ActionProvider(),
      wethActionProvider(),
      cdpApiActionProvider({
        apiKeyId: process.env.CDP_API_KEY_NAME!,
        apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!,
      }),
    ];

    console.log(`📦 Configured ${actionProviders.length} action providers:`);
    console.log(`   - Pyth (price feeds)`);
    console.log(`   - Wallet (balance, transfers)`);
    console.log(`   - ERC20 (token operations)`);
    console.log(`   - WETH (wrapped ETH)`);
    console.log(`   - CDP API (advanced operations)`);

    // Create AgentKit instance with proper error handling
    console.log("🤖 Initializing AgentKit...");
    let agentkit: AgentKit;
    
    try {
      agentkit = await AgentKit.from({
        walletProvider,
        actionProviders,
      });
    } catch (agentkitError) {
      console.error("❌ AgentKit initialization failed:", getErrorMessage(agentkitError));
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

    console.log("✅ AgentKit initialization complete");
    console.log(`   Total capabilities: ${actionProviders.length} action providers`);
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
    } else if (errorContains(error, 'network')) {
      throw new Error(
        `Network configuration error: ${getErrorMessage(error)}. ` +
        `Please verify your NETWORK_ID setting and internet connection.`
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
      `Please check your configuration and try again.`
    );
  }
}