import fs from 'fs';
import { AgentKit, erc20ActionProvider, pythActionProvider, walletActionProvider, cdpApiActionProvider } from '@coinbase/agentkit';
// The following imports may need to be adjusted based on the actual package structure
// If these are not correct, please update them to match your node_modules
import { SmartWalletProvider } from '@coinbase/agentkit';
import { Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Define WalletData type
export type WalletData = {
  privateKey: string;
  smartWalletAddress?: string;
};

// Path to store wallet data
export const WALLET_DATA_FILE = './wallet.json';



/**
 * Prepares the AgentKit and WalletProvider.
 *
 * @function prepareAgentkitAndWalletProvider
 * @returns {Promise<{ agentkit: AgentKit, walletProvider: any }>} The initialized AI agent.
 *
 * @description Handles agent setup
 *
 * @throws {Error} If the agent initialization fails.
 */
export async function prepareAgentkitAndWalletProvider(): Promise<{
  agentkit: AgentKit;
  walletProvider: any;
}> {
  if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_PRIVATE_KEY) {
    throw new Error(
      'I need both CDP_API_KEY_ID and CDP_API_KEY_SECRET in your .env file to connect to the Coinbase Developer Platform.',
    );
  }

  let walletData: WalletData | null = null;
  let privateKey: Hex | null = null;

  // Read existing wallet data if available
  if (fs.existsSync(WALLET_DATA_FILE)) {
    try {
      walletData = JSON.parse(fs.readFileSync(WALLET_DATA_FILE, 'utf8')) as WalletData;
      privateKey = walletData.privateKey as Hex;
    } catch (error) {
      console.error('Error reading wallet data:', error);
    }
  }

  if (!privateKey) {
    if (walletData?.smartWalletAddress) {
      throw new Error(
        `I found your smart wallet but can't access your private key. Please either provide the private key in your .env, or delete ${WALLET_DATA_FILE} to create a new wallet.`,
      );
    }
    privateKey = (process.env.PRIVATE_KEY || generatePrivateKey()) as Hex;
  }

  try {
    const signer = privateKeyToAccount(privateKey);

    // Initialize WalletProvider
    const walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId: process.env.NETWORK_ID || 'base-sepolia',
      signer,
      smartWalletAddress: walletData?.smartWalletAddress as `0x${string}`,
      paymasterUrl: undefined, // Sponsor transactions: https://docs.cdp.coinbase.com/paymaster/docs/welcome
    });
    console.log("this is my wallet Provider:", walletProvider)

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        // If you have wethActionProvider, import and add it here
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyId: process.env.CDP_API_KEY_NAME!,
          apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!,
        }),
      ],
    });

    // Save wallet data
    const smartWalletAddress = walletProvider.getAddress();
    fs.writeFileSync(
      WALLET_DATA_FILE,
      JSON.stringify({
        privateKey,
        smartWalletAddress,
      } as WalletData),
    );

    return { agentkit, walletProvider };
  } catch (error) {
    console.error('Error initializing agent:', error);
    throw new Error('Failed to initialize agent');
  }
} 