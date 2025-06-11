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
   * Prepares the AgentKit and WalletProvider with real values and configuration
   *
   * @returns {Promise<{ agentkit: AgentKit, walletProvider: WalletProvider }>} The initialized AI agent and wallet provider
   */
  export async function prepareAgentkitAndWalletProvider(): Promise<{
    agentkit: AgentKit;
    walletProvider: WalletProvider;
  }> {
    // Validate required environment variables
    if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_PRIVATE_KEY) {
      throw new Error(
        "CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY are required in environment variables for AgentKit functionality"
      );
    }
  
    try {
      console.log("🔐 Initializing EchoFi wallet provider...");
  
      let walletData: WalletData | null = null;
      let privateKey: Hex | null = null;
      let isExistingWallet = false;
  
      // Read existing wallet data if available
      if (fs.existsSync(WALLET_DATA_FILE)) {
        try {
          walletData = JSON.parse(fs.readFileSync(WALLET_DATA_FILE, 'utf8')) as WalletData;
          privateKey = walletData.privateKey as Hex;
          isExistingWallet = true;
          console.log("✅ Found existing wallet configuration");
          console.log(`   Wallet file: ${WALLET_DATA_FILE}`);
          if (walletData.smartWalletAddress) {
            console.log(`   Smart wallet: ${walletData.smartWalletAddress}`);
          }
        } catch (error) {
          console.error('❌ Error reading wallet data:', error);
        }
      }
  
      // Get private key from environment or generate new one
      if (!privateKey) {
        if (walletData?.smartWalletAddress) {
          throw new Error(
            `Found smart wallet ${walletData.smartWalletAddress} but cannot access private key. Please provide PRIVATE_KEY in your .env file or delete ${WALLET_DATA_FILE} to create a new wallet.`,
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
  
      // Initialize Smart Wallet Provider with real configuration
      const walletProvider = await SmartWalletProvider.configureWithWallet({
        networkId,
        signer,
        smartWalletAddress: walletData?.smartWalletAddress as `0x${string}`,
        paymasterUrl: undefined, // Add paymaster URL for sponsored transactions if needed
      });
  
      // Get real wallet information
      const smartWalletAddress = walletProvider.getAddress();
      const network = walletProvider.getNetwork();
      
      console.log("✅ Smart Wallet Provider initialized successfully");
      console.log(`   Smart wallet address: ${smartWalletAddress}`);
      console.log(`   Network ID: ${network.networkId}`);
      console.log(`   Chain ID: ${network.chainId}`);
    //   console.log(`   RPC URL: ${network.r}`);
  
      // Try to get wallet balance for display
      try {
        const balance = await walletProvider.getBalance();
        const formattedBalance = formatEther(BigInt(balance));
        console.log(`   Current balance: ${formattedBalance} ETH`);
      } catch (error) {
        console.log(`   Balance: Unable to fetch (${error instanceof Error ? error.message : 'Unknown error'})`);
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
  
      // Create AgentKit instance
      console.log("🤖 Initializing AgentKit...");
      const agentkit = await AgentKit.from({
        walletProvider,
        actionProviders,
      });
  
      // Save wallet data for future use
      const walletDataToSave: WalletData = {
        privateKey,
        smartWalletAddress,
      };
      
      fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(walletDataToSave, null, 2));
      
      if (!isExistingWallet) {
        console.log(`💾 Wallet configuration saved to ${WALLET_DATA_FILE}`);
      }
  
      console.log("✅ AgentKit initialization complete");
      console.log(`   Total capabilities: ${actionProviders.length} action providers`);
      console.log(`   Ready for ${isTestnet ? 'testing' : 'production'} operations`);
  
      return { agentkit, walletProvider };
    } catch (error) {
      console.error("❌ Error initializing AgentKit:", error);
      
      // Provide specific error context
      if (error instanceof Error) {
        if (error.message.includes('CDP_API_KEY')) {
          throw new Error(`CDP API credentials error: ${error.message}. Please check your environment variables.`);
        } else if (error.message.includes('network')) {
          throw new Error(`Network configuration error: ${error.message}. Please verify NETWORK_ID setting.`);
        } else if (error.message.includes('private key')) {
          throw new Error(`Wallet configuration error: ${error.message}. Please check your private key setup.`);
        }
      }
      
      throw new Error(`Failed to initialize AgentKit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }