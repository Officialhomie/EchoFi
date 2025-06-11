// src/lib/agentkit/prepare-agentkit.ts
import {
    ActionProvider,
    AgentKit,
    cdpApiActionProvider,
    erc20ActionProvider,
    pythActionProvider,
    ViemWalletProvider,
    WalletProvider,
    walletActionProvider,
    wethActionProvider,
  } from "@coinbase/agentkit";
  import fs from "fs";
  import { createWalletClient, http } from "viem";
  import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
  import { base, baseSepolia } from "viem/chains";
  
  /**
   * WalletData type for persisting wallet information
   */
  export type WalletData = {
    privateKey: string;
    address?: string;
  };
  
  // Path to store wallet data
  const WALLET_DATA_FILE = "./wallet_data.json";
  
  /**
   * Prepares the AgentKit and WalletProvider following the official example pattern
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
        "CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY are required in environment variables"
      );
    }
  
    try {
      // Initialize WalletProvider with proper private key handling
      let privateKey: `0x${string}` | undefined;
      
      // First, try to get from environment variable
      if (process.env.PRIVATE_KEY) {
        const envKey = process.env.PRIVATE_KEY.trim();
        // Ensure proper hex format
        if (envKey.startsWith('0x') && envKey.length === 66) {
          privateKey = envKey as `0x${string}`;
          console.log("✅ Using private key from environment variable");
        } else {
          console.warn("⚠️ PRIVATE_KEY in environment is not in correct format (should be 0x... and 66 characters)");
        }
      }
      
      // If no valid private key from env, check wallet data file
      if (!privateKey && fs.existsSync(WALLET_DATA_FILE)) {
        try {
          const walletData: WalletData = JSON.parse(fs.readFileSync(WALLET_DATA_FILE, "utf8"));
          if (walletData.privateKey) {
            const fileKey = walletData.privateKey.trim();
            if (fileKey.startsWith('0x') && fileKey.length === 66) {
              privateKey = fileKey as `0x${string}`;
              console.log("✅ Using private key from wallet_data.json");
            } else {
              console.warn("⚠️ Private key in wallet_data.json is not in correct format");
            }
          }
        } catch (error) {
          console.warn("⚠️ Failed to read wallet_data.json:", error);
        }
      }
      
      // Generate new private key if none exists or is valid
      if (!privateKey) {
        privateKey = generatePrivateKey();
        const walletData: WalletData = { 
          privateKey,
          address: undefined // Will be set after creating account
        };
        
        try {
          fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(walletData, null, 2));
          console.log("🔑 Generated new private key and saved to wallet_data.json");
          console.log("💡 Consider saving this private key to your .env.local file as PRIVATE_KEY");
          console.log(`   PRIVATE_KEY=${privateKey}`);
        } catch (error) {
          console.warn("⚠️ Could not save wallet data to file:", error);
        }
      }
  
      // Validate private key format before using
      if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
        throw new Error(`Invalid private key format. Expected 0x followed by 64 hex characters, got: ${privateKey ? privateKey.substring(0, 10) + '...' : 'undefined'}`);
      }
  
      // Create account from private key
      let account;
      try {
        account = privateKeyToAccount(privateKey);
        console.log(`✅ Created account: ${account.address}`);
      } catch (error) {
        throw new Error(`Failed to create account from private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
  
      // Determine chain based on environment
      const networkId = process.env.NETWORK_ID || "base-sepolia";
      const isMainnet = networkId === "base-mainnet";
      const chain = isMainnet ? base : baseSepolia;
      const rpcUrl = isMainnet 
        ? "https://mainnet.base.org" 
        : "https://sepolia.base.org";
  
      // Create wallet client
      const client = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      });
  
      // Create wallet provider
      const walletProvider = new ViemWalletProvider(client);
  
      // Initialize AgentKit with action providers
      const actionProviders: ActionProvider[] = [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
      ];
  
      // Add CDP API action provider if credentials are available
      const canUseCdpApi = process.env.CDP_API_KEY_NAME && process.env.CDP_API_KEY_PRIVATE_KEY;
      if (canUseCdpApi) {
        actionProviders.push(
          cdpApiActionProvider({
            apiKeyId: process.env.CDP_API_KEY_NAME,
            apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY,
          })
        );
      }
  
      // Create AgentKit instance
      const agentkit = await AgentKit.from({
        walletProvider,
        actionProviders,
      });
  
      console.log("✅ AgentKit initialized successfully");
      console.log(`   Network: ${chain.name}`);
      console.log(`   Address: ${account.address}`);
      console.log(`   Action Providers: ${actionProviders.length}`);
  
      return { agentkit, walletProvider };
    } catch (error) {
      console.error("Error initializing AgentKit:", error);
      throw new Error(`Failed to initialize AgentKit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }