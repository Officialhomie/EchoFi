import { Client, DecodedMessage, type ClientOptions } from '@xmtp/browser-sdk';
import { 
  createWalletClient, 
  createPublicClient, 
  http, 
  parseUnits, 
  formatUnits,
  type WalletClient,
  type PublicClient,
  type Transport,
  type Chain,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { 
  EchoFiTreasuryABI, 
  ProposalType,
  validateUSDCAmount 
} from '../../contracts/contracts';

// =============================================================================
// ENHANCED TYPE DEFINITIONS WITH PROPER VIEM CLIENT TYPES
// =============================================================================

interface XMTPSigner {
  walletType: 'EOA';
  getAddress: () => Promise<string>;
  signMessage: (message: string) => Promise<Uint8Array>;
  getChainId: () => bigint;
}

interface GroupConversation {
  id: string;
  name?: string;
  description?: string;
  send: (content: string) => Promise<void>;
  streamMessages?: () => AsyncGenerator<DecodedMessage>;
}

interface AgentConfig {
  privateKey: `0x${string}`;
  xmtpEnv: 'dev' | 'production';
  rpcUrl: string;
  treasuryAddress: `0x${string}`;
  chainId: number;
  minConfirmations: number;
  enableAutoExecution: boolean;
  preferredNetwork: 'base-sepolia' | 'base-mainnet';
  fallbackRpcUrl?: string;
}

interface InvestmentCommand {
  type: 'deposit' | 'withdraw' | 'transfer' | 'status' | 'help';
  amount?: string;
  target?: string;
  description?: string;
  sender: string;
}

// =============================================================================
// ECHOFI AGENT CLASS WITH PROPER VIEM CLIENT SETUP
// =============================================================================

export class EchoFiAgent {
  private xmtpClient: Client | null = null;
  // FIXED: Using separate public and wallet clients for proper type safety
  private walletClient!: WalletClient<Transport, Chain, Account>;
  private publicClient!: PublicClient<Transport, Chain>;
  private account!: Account;
  private config: AgentConfig;
  private isListening = false;
  private encryptionKey: Uint8Array;
  private currentChainId: number;
  private currentChain!: Chain;

  constructor(config: AgentConfig) {
    this.config = config;
    this.currentChainId = config.chainId;
    this.setupWallet();
    this.encryptionKey = this.getOrCreateEncryptionKey();
    
    console.log('🤖 [AGENT] EchoFi Agent created for chain:', this.currentChainId);
  }

  /**
   * FIXED: Enhanced wallet setup with separate public and wallet clients
   */
  private setupWallet(): void {
    this.account = privateKeyToAccount(this.config.privateKey);
    
    // Determine correct chain and RPC URL based on chain ID
    let rpcUrl = this.config.rpcUrl;
    
    switch (this.config.chainId) {
      case 8453: // Base Mainnet
        this.currentChain = base;
        if (!rpcUrl) rpcUrl = 'https://mainnet.base.org';
        break;
      case 84532: // Base Sepolia
        this.currentChain = baseSepolia;
        if (!rpcUrl) rpcUrl = 'https://sepolia.base.org';
        break;
      default:
        console.warn('⚠️ [AGENT] Unsupported chain ID, defaulting to Base Sepolia');
        this.currentChain = baseSepolia;
        rpcUrl = 'https://sepolia.base.org';
        this.currentChainId = 84532;
    }

    console.log('🔗 [AGENT] Setting up wallet client for chain:', {
      chainId: this.currentChainId,
      chainName: this.currentChain.name,
      rpcUrl: rpcUrl
    });

    // FIXED: Create separate public and wallet clients
    const transport = http(rpcUrl);

    // Public client for reading blockchain state and simulating transactions
    this.publicClient = createPublicClient({
      chain: this.currentChain,
      transport,
    });

    // Wallet client for sending transactions
    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.currentChain,
      transport,
    });

    console.log('✅ [AGENT] Wallet clients initialized:', {
      address: this.account.address,
      chain: this.currentChain.name,
      hasPublicClient: !!this.publicClient,
      hasWalletClient: !!this.walletClient
    });
  }

  /**
   * Enhanced encryption key management with Base-specific storage
   */
  private getOrCreateEncryptionKey(): Uint8Array {
    const envKey = process.env.NEXT_PUBLIC_XMTP_ENCRYPTION_KEY;
    
    if (envKey && envKey !== 'your_64_character_hex_key_here') {
      try {
        if (envKey.startsWith('0x')) {
          const hexKey = envKey.slice(2);
          if (hexKey.length === 64) {
            console.log('🔑 [AGENT] Using XMTP encryption key from environment');
            return new Uint8Array(Buffer.from(hexKey, 'hex'));
          }
        }
        
        const keyBytes = Buffer.from(envKey, 'base64');
        if (keyBytes.length === 32) {
          console.log('🔑 [AGENT] Using XMTP encryption key from environment (base64)');
          return new Uint8Array(keyBytes);
        }
        
        console.warn('⚠️ [AGENT] Invalid XMTP_ENCRYPTION_KEY format');
      } catch (error) {
        console.warn('⚠️ [AGENT] Failed to parse XMTP_ENCRYPTION_KEY:', error);
      }
    }

    // Generate session-specific key with Base chain context
    console.warn('⚠️ [AGENT] Generating session encryption key for Base chain');
    const sessionKey = crypto.getRandomValues(new Uint8Array(32));
    
    if (process.env.NODE_ENV === 'development') {
      const hexKey = Array.from(sessionKey, byte => byte.toString(16).padStart(2, '0')).join('');
      console.log('🔑 [AGENT] Generated session key (hex):', `0x${hexKey}`);
      console.log('💡 [AGENT] Add to .env.local: NEXT_PUBLIC_XMTP_ENCRYPTION_KEY=0x' + hexKey);
    }
    
    return sessionKey;
  }

  /**
   * Enhanced XMTP initialization with proper Base chain handling
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 [AGENT] Initializing EchoFi Agent...');
      console.log('🔗 [AGENT] Target chain:', this.currentChainId);
      console.log('📍 [AGENT] Wallet address:', this.account.address);
      
      // Create XMTP signer with proper chain ID reporting
      const adaptedSigner: XMTPSigner = {
        walletType: 'EOA' as const,
        getAddress: () => Promise.resolve(this.account.address),
        signMessage: async (message: string) => {
          console.log('🔐 [AGENT] XMTP requesting signature for agent initialization...');
          try {
            // Add type assertion to ensure signMessage exists
            if (!this.account || typeof this.account.signMessage !== 'function') {
              throw new Error('Account signMessage method not available');
            }
            const signature = await this.account.signMessage({ message });
            return new Uint8Array(Buffer.from(signature.slice(2), 'hex'));
          } catch (error) {
            console.error('❌ [AGENT] Failed to sign message:', error);
            throw new Error('Failed to sign message for XMTP initialization');
          }
        },
        getChainId: () => {
          console.log('🔗 [AGENT] XMTP signer reporting chain ID:', this.currentChainId);
          return BigInt(this.currentChainId);
        },
      };

      // Client options with Base-specific database path
      const clientOptions: ClientOptions = {
        env: this.config.xmtpEnv,
        dbPath: `echofi-agent-base-${this.currentChainId}`,
      };

      console.log('🔐 [AGENT] Creating XMTP client with chain ID:', this.currentChainId);
      
      // Initialize XMTP client - this will request signature once
      this.xmtpClient = await Client.create(adaptedSigner, this.encryptionKey, clientOptions);

      console.log('✅ [AGENT] EchoFi Agent initialized successfully:', {
        address: this.xmtpClient.accountAddress,
        inboxId: this.xmtpClient.inboxId,
        installationId: this.xmtpClient.installationId,
        chainId: this.currentChainId,
        network: this.currentChainId === 8453 ? 'Base Mainnet' : 'Base Sepolia'
      });
      
      // Start listening to group messages
      await this.startListening();
      
    } catch (initError) {
      console.error('❌ [AGENT] Failed to initialize EchoFi Agent:', initError);
      throw initError;
    }
  }

  /**
   * Enhanced message listening with better error handling
   */
  private async startListening(): Promise<void> {
    if (!this.xmtpClient || this.isListening) return;

    this.isListening = true;
    console.log('🎧 [AGENT] Starting to listen for group messages...');

    try {
      const groups = await this.xmtpClient.conversations.listGroups();
      console.log(`📊 [AGENT] Found ${groups.length} groups to monitor`);
      
      for (const group of groups) {
        const typedGroup = group as unknown as GroupConversation;
        
        if (typeof typedGroup.streamMessages === 'function') {
          console.log(`🔄 [AGENT] Starting message stream for group: ${typedGroup.name || typedGroup.id}`);
          
          // Handle streaming in a non-blocking way
          this.handleGroupMessageStream(typedGroup).catch(streamError => {
            console.error(`❌ [AGENT] Stream error for group ${typedGroup.id}:`, streamError);
          });
        } else {
          console.warn(`⚠️ [AGENT] Group ${typedGroup.id} does not support message streaming`);
        }
      }
    } catch (listenError) {
      console.error('❌ [AGENT] Error starting message listener:', listenError);
      this.isListening = false;
    }
  }

  /**
   * Handle message streaming for a specific group
   */
  private async handleGroupMessageStream(group: GroupConversation): Promise<void> {
    try {
      if (!group.streamMessages) return;
      
      const stream = await group.streamMessages();
      for await (const message of stream) {
        if (!this.isListening) break;
        await this.handleMessage(message, group.id);
      }
    } catch (streamError) {
      console.error(`❌ [AGENT] Message stream error for group ${group.id}:`, streamError);
    }
  }

  /**
   * Enhanced message handling with better type safety
   */
  private async handleMessage(message: DecodedMessage, groupId: string): Promise<void> {
    try {
      const messageWithSender = message as DecodedMessage & { 
        sender?: string; 
        senderAddress?: string 
      };
      
      const sender = messageWithSender.sender || messageWithSender.senderAddress;
      
      // Skip our own messages
      if (sender === this.account.address) {
        return;
      }

      console.log(`📨 [AGENT] New message from ${sender}: ${message.content}`);

      if (sender) {
        const command = this.parseInvestmentCommand(message.content, sender);
        
        if (command) {
          await this.executeCommand(command, groupId);
        }
      }

    } catch (messageError) {
      console.error('❌ [AGENT] Error handling message:', messageError);
    }
  }

  /**
   * Parse natural language for investment commands
   */
  private parseInvestmentCommand(content: string, sender: string): InvestmentCommand | null {
    const text = content.toLowerCase().trim();

    // Help command
    if (text.includes('help') || text.includes('commands')) {
      return { type: 'help', sender };
    }

    // Status command
    if (text.includes('status') || text.includes('balance') || text.includes('portfolio')) {
      return { type: 'status', sender };
    }

    // Deposit commands
    if (text.includes('deposit') || text.includes('invest') || text.includes('supply')) {
      const amount = this.extractAmount(text);
      const description = this.extractDescription(text) || `Aave deposit requested by ${sender}`;
      
      if (amount) {
        return {
          type: 'deposit',
          amount,
          description,
          sender
        };
      }
    }

    // Withdraw commands
    if (text.includes('withdraw') || text.includes('exit') || text.includes('redeem')) {
      const amount = this.extractAmount(text);
      const description = this.extractDescription(text) || `Aave withdrawal requested by ${sender}`;
      
      if (amount) {
        return {
          type: 'withdraw',
          amount,
          description,
          sender
        };
      }
    }

    // Transfer commands
    if (text.includes('transfer') || text.includes('send')) {
      const amount = this.extractAmount(text);
      const target = this.extractAddress(text);
      const description = this.extractDescription(text) || `Transfer requested by ${sender}`;
      
      if (amount && target) {
        return {
          type: 'transfer',
          amount,
          target,
          description,
          sender
        };
      }
    }

    return null;
  }

  /**
   * Enhanced command execution with proper chain validation
   */
  private async executeCommand(command: InvestmentCommand, groupId: string): Promise<void> {
    try {
      console.log(`🎯 [AGENT] Executing command: ${command.type} on chain ${this.currentChainId}`);
      
      switch (command.type) {
        case 'help':
          await this.sendHelpMessage(groupId);
          break;
          
        case 'status':
          await this.sendStatusMessage(groupId);
          break;
          
        case 'deposit':
          await this.createDepositProposal(command, groupId);
          break;
          
        case 'withdraw':
          await this.createWithdrawProposal(command, groupId);
          break;
          
        case 'transfer':
          await this.sendMessage(groupId, '⚠️ Transfer proposals are not yet supported.');
          break;
      }
    } catch (commandError) {
      console.error(`❌ [AGENT] Error executing command:`, commandError);
      const errorMessage = commandError instanceof Error ? commandError.message : String(commandError);
      await this.sendErrorMessage(groupId, errorMessage);
    }
  }

  /**
   * FIXED: Create Aave deposit proposal using proper viem methods
   */
  private async createDepositProposal(command: InvestmentCommand, groupId: string): Promise<void> {
    if (!command.amount) return;

    // Validate amount
    const validation = validateUSDCAmount(command.amount);
    if (validation) {
      await this.sendErrorMessage(groupId, validation);
      return;
    }

    try {
      console.log(`💰 [AGENT] Creating deposit proposal for ${command.amount} USDC on chain ${this.currentChainId}`);
      
      const amountWei = parseUnits(command.amount, 6);
      
      // FIXED: Use publicClient for simulation
      const { request } = await this.publicClient.simulateContract({
        address: this.config.treasuryAddress,
        abi: EchoFiTreasuryABI,
        functionName: 'createProposal',
        args: [
          ProposalType.DEPOSIT_AAVE,
          amountWei,
          '0x0000000000000000000000000000000000000000' as `0x${string}`,
          '0x' as `0x${string}`,
          command.description || `Deposit ${command.amount} USDC to Aave`,
        ],
        account: this.account,
      });

      // Use walletClient for writing
      const hash = await this.walletClient.writeContract(request);
      
      // Send confirmation message with chain-specific explorer link
      await this.sendMessage(groupId, 
        `✅ **Deposit Proposal Created**\n` +
        `💰 Amount: $${command.amount} USDC\n` +
        `📝 Description: ${command.description}\n` +
        `🌐 Network: ${this.getNetworkName()}\n` +
        `🔗 Transaction: ${this.getExplorerLink(hash)}\n\n` +
        `Group members can now vote on this proposal.`
      );

    } catch (proposalError) {
      console.error('❌ [AGENT] Failed to create deposit proposal:', proposalError);
      await this.sendErrorMessage(groupId, 'Failed to create deposit proposal. Please try again.');
    }
  }

  /**
   * FIXED: Create Aave withdrawal proposal using proper viem methods
   */
  private async createWithdrawProposal(command: InvestmentCommand, groupId: string): Promise<void> {
    if (!command.amount) return;

    try {
      console.log(`💸 [AGENT] Creating withdrawal proposal for ${command.amount} USDC on chain ${this.currentChainId}`);
      
      const amountWei = parseUnits(command.amount, 6);
      
      // FIXED: Use publicClient for simulation
      const { request } = await this.publicClient.simulateContract({
        address: this.config.treasuryAddress,
        abi: EchoFiTreasuryABI,
        functionName: 'createProposal',
        args: [
          ProposalType.WITHDRAW_AAVE,
          amountWei,
          '0x0000000000000000000000000000000000000000' as `0x${string}`,
          '0x' as `0x${string}`,
          command.description || `Withdraw ${command.amount} USDC from Aave`,
        ],
        account: this.account,
      });

      // Use walletClient for writing
      const hash = await this.walletClient.writeContract(request);
      
      await this.sendMessage(groupId,
        `✅ **Withdrawal Proposal Created**\n` +
        `💰 Amount: $${command.amount} USDC\n` +
        `📝 Description: ${command.description}\n` +
        `🌐 Network: ${this.getNetworkName()}\n` +
        `🔗 Transaction: ${this.getExplorerLink(hash)}\n\n` +
        `Group members can now vote on this proposal.`
      );

    } catch (withdrawError) {
      console.error('❌ [AGENT] Failed to create withdrawal proposal:', withdrawError);
      await this.sendErrorMessage(groupId, 'Failed to create withdrawal proposal. Please try again.');
    }
  }

  /**
   * FIXED: Send treasury status message using proper viem methods
   */
  private async sendStatusMessage(groupId: string): Promise<void> {
    try {
      console.log(`📊 [AGENT] Getting treasury status for chain ${this.currentChainId}`);
      
      // FIXED: Use publicClient for reading
      const balanceResult = await this.publicClient.readContract({
        address: this.config.treasuryAddress,
        abi: EchoFiTreasuryABI,
        functionName: 'getTreasuryBalance',
      });

      // Type assertion for the tuple return type
      const [usdcBalance, aUsdcBalance] = balanceResult as [bigint, bigint];

      const formattedUSDC = formatUnits(usdcBalance, 6);
      const formattedAUSDC = formatUnits(aUsdcBalance, 6);
      const totalValue = formatUnits(usdcBalance + aUsdcBalance, 6);

      // For now, we'll skip the Aave position details as they may not exist in the contract
      // You can add this back if the contract has getAavePosition function

      await this.sendMessage(groupId,
        `📊 **Treasury Status Report**\n\n` +
        `🌐 **Network**: ${this.getNetworkName()}\n` +
        `🏛️ **Treasury**: ${this.config.treasuryAddress}\n\n` +
        `💰 **Balances:**\n` +
        `• Available USDC: $${formattedUSDC}\n` +
        `• Aave aUSDC: $${formattedAUSDC}\n` +
        `• Total Value: $${totalValue}\n\n` +
        `Use "help" to see available commands.`
      );

    } catch (statusError) {
      console.error('❌ [AGENT] Failed to get status:', statusError);
      await this.sendErrorMessage(groupId, 'Failed to retrieve treasury status.');
    }
  }

  /**
   * Send help message with Base-specific context
   */
  private async sendHelpMessage(groupId: string): Promise<void> {
    const helpMessage = 
      `🤖 **EchoFi Agent Commands**\n\n` +
      `🌐 **Network**: ${this.getNetworkName()}\n` +
      `⛽ **Gas**: Optimized for Base L2\n\n` +
      `💰 **Investment Commands:**\n` +
      `• "deposit 1000" - Create proposal to deposit $1000 to Aave\n` +
      `• "withdraw 500" - Create proposal to withdraw $500 from Aave\n` +
      `• "transfer 100 to 0x123..." - Create proposal to transfer funds\n\n` +
      `📊 **Information Commands:**\n` +
      `• "status" - Show treasury balance and positions\n` +
      `• "balance" - Same as status\n` +
      `• "help" - Show this message\n\n` +
      `⚡ **Quick Examples:**\n` +
      `• "invest 2000 usdc in aave for yield"\n` +
      `• "withdraw 1500 from aave to cover expenses"\n` +
      `• "what's our current balance?"\n\n` +
      `📝 All commands create proposals that require group voting to execute.\n` +
      `💡 Powered by Base L2 for fast, low-cost transactions.`;

    await this.sendMessage(groupId, helpMessage);
  }

  /**
   * Send error message
   */
  private async sendErrorMessage(groupId: string, errorMsg: string): Promise<void> {
    await this.sendMessage(groupId, `❌ **Error:** ${errorMsg}`);
  }

  /**
   * Send message to group
   */
  private async sendMessage(groupId: string, content: string): Promise<void> {
    if (!this.xmtpClient) return;

    try {
      const groups = await this.xmtpClient.conversations.listGroups();
      const targetGroup = groups.find(g => g.id === groupId) as unknown as GroupConversation | undefined;
      
      if (targetGroup) {
        await targetGroup.send(content);
        console.log(`📤 [AGENT] Sent message to group ${groupId}`);
      }
    } catch (sendError) {
      console.error('❌ [AGENT] Failed to send message:', sendError);
    }
  }

  // =============================================================================
  // UTILITY FUNCTIONS WITH BASE CHAIN SUPPORT
  // =============================================================================

  private extractAmount(text: string): string | null {
    const patterns = [
      /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g,
      /(\d+(?:\.\d{1,2})?)\s*(?:usdc|usd|dollars?)/gi,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = match[0].replace(/[$,]/g, '').replace(/[^\d.]/g, '');
        if (!isNaN(parseFloat(amount))) {
          return amount;
        }
      }
    }

    return null;
  }

  private extractAddress(text: string): string | null {
    const match = text.match(/0x[a-fA-F0-9]{40}/);
    return match ? match[0] : null;
  }

  private extractDescription(text: string): string | null {
    const patterns = [
      /(?:for|because|reason:?)\s+(.+)/i,
      /"([^"]+)"/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Get network name based on current chain ID
   */
  private getNetworkName(): string {
    switch (this.currentChainId) {
      case 8453:
        return 'Base Mainnet';
      case 84532:
        return 'Base Sepolia';
      default:
        return `Chain ${this.currentChainId}`;
    }
  }

  /**
   * Get explorer link based on current chain ID
   */
  private getExplorerLink(hash: string): string {
    let baseUrl: string;
    
    switch (this.currentChainId) {
      case 8453:
        baseUrl = 'https://basescan.org/tx/';
        break;
      case 84532:
        baseUrl = 'https://sepolia-explorer.base.org/tx/';
        break;
      default:
        baseUrl = 'https://sepolia-explorer.base.org/tx/'; // Default to Base Sepolia
    }
    
    return `${baseUrl}${hash}`;
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    this.isListening = false;
    console.log('🛑 [AGENT] EchoFi Agent stopped');
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      isInitialized: !!this.xmtpClient,
      isListening: this.isListening,
      chainId: this.currentChainId,
      networkName: this.getNetworkName(),
      walletAddress: this.account.address,
      treasuryAddress: this.config.treasuryAddress,
    };
  }
}

// =============================================================================
// AGENT FACTORY WITH BASE CHAIN OPTIMIZATION
// =============================================================================

export class EchoFiAgentFactory {
  /**
   * Create and initialize EchoFi agent with Base chain configuration
   */
  static async createAgent(config: AgentConfig): Promise<EchoFiAgent> {
    // Validate chain ID is supported
    if (![8453, 84532].includes(config.chainId)) {
      console.warn('⚠️ [FACTORY] Unsupported chain ID, defaulting to Base Sepolia');
      config.chainId = 84532;
      config.preferredNetwork = 'base-sepolia';
    }

    console.log('🏭 [FACTORY] Creating EchoFi agent for:', {
      chainId: config.chainId,
      network: config.preferredNetwork,
      address: config.treasuryAddress
    });

    const agent = new EchoFiAgent(config);
    await agent.initialize();
    return agent;
  }

  /**
   * Create agent from environment variables with Base defaults
   */
  static async createFromEnv(): Promise<EchoFiAgent> {
    // Default to Base Sepolia for development
    const defaultChainId = process.env.NODE_ENV === 'production' ? 8453 : 84532;
    const defaultNetwork = process.env.NODE_ENV === 'production' ? 'base-mainnet' : 'base-sepolia';
    const defaultRpcUrl = defaultChainId === 8453 ? 'https://mainnet.base.org' : 'https://sepolia.base.org';

    const config: AgentConfig = {
      privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
      xmtpEnv: process.env.NODE_ENV === 'production' ? 'production' : 'dev',
      rpcUrl: process.env.RPC_URL_BASE || defaultRpcUrl,
      treasuryAddress: process.env.TREASURY_ADDRESS as `0x${string}`,
      chainId: parseInt(process.env.CHAIN_ID || defaultChainId.toString()),
      minConfirmations: parseInt(process.env.MIN_CONFIRMATIONS || '1'),
      enableAutoExecution: process.env.ENABLE_AUTO_EXECUTION === 'true',
      preferredNetwork: (process.env.PREFERRED_NETWORK as 'base-sepolia' | 'base-mainnet') || defaultNetwork,
      fallbackRpcUrl: process.env.FALLBACK_RPC_URL,
    };

    // Validate required environment variables
    if (!config.privateKey) {
      throw new Error('AGENT_PRIVATE_KEY environment variable is required');
    }
    if (!config.treasuryAddress) {
      throw new Error('TREASURY_ADDRESS environment variable is required');
    }

    console.log('🌍 [FACTORY] Creating agent from environment:', {
      chainId: config.chainId,
      network: config.preferredNetwork,
      xmtpEnv: config.xmtpEnv,
    });

    return this.createAgent(config);
  }
}