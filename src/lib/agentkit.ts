import fs from 'fs';
import { 
  AgentKit, 
  erc20ActionProvider, 
  pythActionProvider, 
  walletActionProvider, 
  cdpApiActionProvider,
  SmartWalletProvider,
  WalletProvider
} from '@coinbase/agentkit';
import { Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Define WalletData type
export type WalletData = {
  privateKey: string;
  smartWalletAddress?: string;
};

// Path to store wallet data
export const WALLET_DATA_FILE = './wallet.json';

// Define proper return type for the function using the library's WalletProvider
interface PrepareAgentkitResult {
  agentkit: AgentKit;
  walletProvider: WalletProvider;
}

/**
 * Prepares the AgentKit and WalletProvider.
 *
 * @function prepareAgentkitAndWalletProvider
 * @returns {Promise<PrepareAgentkitResult>} The initialized AI agent and wallet provider.
 *
 * @description Handles agent setup with proper TypeScript typing for better code safety.
 * This function initializes both the AgentKit for AI operations and the SmartWalletProvider
 * for blockchain interactions, ensuring they work together seamlessly.
 *
 * @throws {Error} If the agent initialization fails or required environment variables are missing.
 */
export async function prepareAgentkitAndWalletProvider(): Promise<PrepareAgentkitResult> {
  // Validate required environment variables with clear error messages
  if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_PRIVATE_KEY) {
    throw new Error(
      'I need both CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY in your .env file to connect to the Coinbase Developer Platform. ' +
      'Please check your environment configuration and ensure these values are properly set.'
    );
  }

  let walletData: WalletData | null = null;
  let privateKey: Hex | null = null;

  // Read existing wallet data if available
  if (fs.existsSync(WALLET_DATA_FILE)) {
    try {
      const fileContent = fs.readFileSync(WALLET_DATA_FILE, 'utf8');
      walletData = JSON.parse(fileContent) as WalletData;
      privateKey = walletData.privateKey as Hex;
      
      console.log('📖 Found existing wallet data, using stored private key');
    } catch (fileReadError) {
      console.error('Error reading wallet data file:', fileReadError);
      console.log('📝 Will generate new wallet data');
    }
  }

  if (!privateKey) {
    if (walletData?.smartWalletAddress) {
      throw new Error(
        `I found your smart wallet address (${walletData.smartWalletAddress}) but can't access your private key. ` +
        `Please either provide the private key in your .env file as PRIVATE_KEY, or delete ${WALLET_DATA_FILE} to create a new wallet.`
      );
    }
    
    // Generate new private key if none exists
    privateKey = (process.env.PRIVATE_KEY || generatePrivateKey()) as Hex;
    console.log('🔑 Generated new private key for wallet operations');
  }

  try {
    // Create account from private key with proper typing
    const signer = privateKeyToAccount(privateKey);
    console.log('👤 Created wallet account from private key');

    // Initialize WalletProvider with proper configuration
    const walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId: process.env.NETWORK_ID || 'base-sepolia',
      signer,
      smartWalletAddress: walletData?.smartWalletAddress as `0x${string}` | undefined,
      paymasterUrl: undefined, // Using default paymaster configuration
    });

    console.log("✅ Wallet Provider initialized:", {
      address: walletProvider.getAddress(),
      network: process.env.NETWORK_ID || 'base-sepolia'
    });

    // Initialize AgentKit with comprehensive action providers
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        pythActionProvider(),           // Price and market data
        walletActionProvider(),         // Basic wallet operations
        erc20ActionProvider(),          // ERC-20 token operations
        cdpApiActionProvider({          // Coinbase Developer Platform integration
          apiKeyId: process.env.CDP_API_KEY_NAME!,
          apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!,
        }),
      ],
    });

    console.log('🤖 AgentKit initialized with action providers');

    // Save wallet data for future use
    const smartWalletAddress = walletProvider.getAddress();
    const walletDataToSave: WalletData = {
      privateKey,
      smartWalletAddress,
    };

    fs.writeFileSync(
      WALLET_DATA_FILE,
      JSON.stringify(walletDataToSave, null, 2) // Pretty-print JSON for readability
    );

    console.log('💾 Wallet data saved to:', WALLET_DATA_FILE);
    console.log('🎉 AgentKit and WalletProvider setup completed successfully');

    return { 
      agentkit, 
      walletProvider 
    };

  } catch (initializationError) {
    console.error('❌ Error initializing agent and wallet provider:', initializationError);
    
    // Provide more specific error context
    if (initializationError instanceof Error) {
      if (initializationError.message.includes('network')) {
        throw new Error(
          `Network connection failed during wallet initialization: ${initializationError.message}. ` +
          'Please check your internet connection and the NETWORK_ID environment variable.'
        );
      } else if (initializationError.message.includes('CDP')) {
        throw new Error(
          `Coinbase Developer Platform authentication failed: ${initializationError.message}. ` +
          'Please verify your CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY are correct.'
        );
      }
    }
    
    throw new Error(
      `Failed to initialize agent and wallet provider: ${
        initializationError instanceof Error ? initializationError.message : String(initializationError)
      }`
    );
  }
}