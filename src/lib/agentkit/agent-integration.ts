/* Updated for viem/wagmi v2 and TypeScript ES2020 compatibility */
// XMTP Agent Integration for GroupFi
// Bridges XMTP messaging with smart contract automation

import { Client, DecodedMessage, Conversation, type ClientOptions } from '@xmtp/browser-sdk';
import { createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { 
  GroupFiTreasuryABI, 
  ProposalType, 
  formatProposalType,
  validateUSDCAmount 
} from '../../contracts/contracts';

// =============================================================================
// AGENT CONFIGURATION
// =============================================================================

interface AgentConfig {
  privateKey: `0x${string}`;
  xmtpEnv: 'dev' | 'production';
  rpcUrl: string;
  treasuryAddress: `0x${string}`;
  chainId: number;
  minConfirmations: number;
  enableAutoExecution: boolean;
}

interface InvestmentCommand {
  type: 'deposit' | 'withdraw' | 'transfer' | 'status' | 'help';
  amount?: string;
  target?: string;
  description?: string;
  sender: string;
}

// =============================================================================
// GROUPFI AGENT CLASS
// =============================================================================

export class GroupFiAgent {
  private xmtpClient: Client | null = null;
  private walletClient: any;
  private config: AgentConfig;
  private isListening = false;
  private encryptionKey: Uint8Array;

  constructor(config: AgentConfig) {
    this.config = config;
    this.setupWallet();
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  private setupWallet() {
    const account = privateKeyToAccount(this.config.privateKey);
    this.walletClient = createWalletClient({
      account,
      chain: this.config.chainId === 8453 ? base : baseSepolia,
      transport: http(this.config.rpcUrl),
    });
  }

  /**
   * Get or create encryption key from environment variables
   * Falls back to generating a session key if no env key provided
   */
  private getOrCreateEncryptionKey(): Uint8Array {
    // Try to get key from environment variables
    const envKey = process.env.NEXT_PUBLIC_XMTP_ENCRYPTION_KEY;
    
    if (envKey) {
      try {
        // Convert hex string to Uint8Array
        if (envKey.startsWith('0x')) {
          const hexKey = envKey.slice(2);
          if (hexKey.length === 64) { // 32 bytes = 64 hex chars
            return new Uint8Array(Buffer.from(hexKey, 'hex'));
          }
        }
        
        // Try base64 format
        const keyBytes = Buffer.from(envKey, 'base64');
        if (keyBytes.length === 32) {
          return new Uint8Array(keyBytes);
        }
        
        console.warn('Invalid XMTP_ENCRYPTION_KEY format. Expected 32-byte hex (0x...) or base64 string');
      } catch (error) {
        console.warn('Failed to parse XMTP_ENCRYPTION_KEY from environment:', error);
      }
    }

    // Fallback: Generate session-specific key
    console.warn('No valid XMTP_ENCRYPTION_KEY found in environment. Generating session key.');
    console.warn('Note: Messages will not persist between sessions. Set NEXT_PUBLIC_XMTP_ENCRYPTION_KEY for persistence.');
    
    return crypto.getRandomValues(new Uint8Array(32));
  }

  /**
   * Initialize XMTP client and start listening
   */
  async initialize() {
    try {
      // Create adapted signer for XMTP
      const adaptedSigner = {
        walletType: 'EOA' as const,
        getAddress: () => Promise.resolve(this.walletClient.account.address),
        signMessage: (message: string) => {
          // Convert string to Uint8Array as required by XMTP
          return this.walletClient.account.signMessage({ message }).then((signature: string) => {
            // Convert hex signature to Uint8Array
            return new Uint8Array(Buffer.from(signature.slice(2), 'hex'));
          });
        },
      };

      // Client options with proper typing
      const clientOptions: ClientOptions = {
        env: this.config.xmtpEnv,
        dbPath: 'groupfi-xmtp-db',
      };

      // Initialize XMTP client with correct signature: (signer, encryptionKey, options)
      this.xmtpClient = await Client.create(adaptedSigner, this.encryptionKey, clientOptions);

      console.log(`✅ GroupFi Agent initialized for address: ${this.walletClient.account.address}`);
      console.log(`📨 XMTP Client details:`, {
        address: this.xmtpClient.accountAddress,
        inboxId: this.xmtpClient.inboxId,
        installationId: this.xmtpClient.installationId
      });
      
      // Start listening to group messages
      await this.startListening();
      
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Failed to initialize GroupFi Agent:', error.message);
      } else {
        console.error('❌ Failed to initialize GroupFi Agent:', error);
      }
      throw error;
    }
  }

  /**
   * Start listening to group conversations
   */
  private async startListening() {
    if (!this.xmtpClient || this.isListening) return;

    this.isListening = true;
    console.log('🎧 Starting to listen for group messages...');

    try {
      // Get all group conversations
      const groups = await this.xmtpClient.conversations.listGroups();
      
      for (const group of groups) {
        // Stream messages from each group
        if (typeof (group as any).streamMessages === 'function') {
          const stream = await (group as any).streamMessages();
          for await (const message of stream) {
            await this.handleMessage(message, group.id);
          }
        } else {
          console.warn('streamMessages not available on group:', group.id);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Error listening to messages:', error.message);
      } else {
        console.error('❌ Error listening to messages:', error);
      }
      this.isListening = false;
    }
  }

  /**
   * Handle incoming XMTP messages
   */
  private async handleMessage(message: DecodedMessage, groupId: string) {
    try {
      // Skip our own messages
      const sender = (message as any).sender || (message as any).senderAddress;
      if (sender === this.walletClient.account.address) {
        return;
      }

      console.log(`📨 New message from ${sender}: ${message.content}`);

      // Parse the message for investment commands
      const command = this.parseInvestmentCommand(message.content, sender);
      
      if (command) {
        await this.executeCommand(command, groupId);
      }

    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Error handling message:', error.message);
      } else {
        console.error('❌ Error handling message:', error);
      }
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
   * Execute investment command
   */
  private async executeCommand(command: InvestmentCommand, groupId: string) {
    try {
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
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Error executing command:`, error.message);
        await this.sendErrorMessage(groupId, error.message);
      } else {
        console.error(`❌ Error executing command:`, error);
        await this.sendErrorMessage(groupId, String(error));
      }
    }
  }

  /**
   * Create Aave deposit proposal
   */
  private async createDepositProposal(command: InvestmentCommand, groupId: string) {
    if (!command.amount) return;

    // Validate amount
    const validation = validateUSDCAmount(command.amount);
    if (validation) {
      await this.sendErrorMessage(groupId, validation);
      return;
    }

    try {
      // Create proposal on-chain
      const amountWei = parseUnits(command.amount, 6);
      
      const { request } = await this.walletClient.simulateContract({
        address: this.config.treasuryAddress,
        abi: GroupFiTreasuryABI,
        functionName: 'createProposal',
        args: [
          ProposalType.DEPOSIT_AAVE,
          amountWei,
          '0x0000000000000000000000000000000000000000',
          '0x',
          command.description || `Deposit ${command.amount} USDC to Aave`,
        ],
      });

      const hash = await this.walletClient.writeContract(request);
      
      // Send confirmation message
      await this.sendMessage(groupId, 
        `✅ **Deposit Proposal Created**\n` +
        `💰 Amount: $${command.amount} USDC\n` +
        `📝 Description: ${command.description}\n` +
        `🔗 Transaction: ${this.getExplorerLink(hash)}\n\n` +
        `Group members can now vote on this proposal.`
      );

    } catch (error) {
      console.error('❌ Failed to create deposit proposal:', error);
      await this.sendErrorMessage(groupId, 'Failed to create deposit proposal. Please try again.');
    }
  }

  /**
   * Create Aave withdrawal proposal
   */
  private async createWithdrawProposal(command: InvestmentCommand, groupId: string) {
    if (!command.amount) return;

    try {
      const amountWei = parseUnits(command.amount, 6);
      
      const { request } = await this.walletClient.simulateContract({
        address: this.config.treasuryAddress,
        abi: GroupFiTreasuryABI,
        functionName: 'createProposal',
        args: [
          ProposalType.WITHDRAW_AAVE,
          amountWei,
          '0x0000000000000000000000000000000000000000',
          '0x',
          command.description || `Withdraw ${command.amount} USDC from Aave`,
        ],
      });

      const hash = await this.walletClient.writeContract(request);
      
      await this.sendMessage(groupId,
        `✅ **Withdrawal Proposal Created**\n` +
        `💰 Amount: $${command.amount} USDC\n` +
        `📝 Description: ${command.description}\n` +
        `🔗 Transaction: ${this.getExplorerLink(hash)}\n\n` +
        `Group members can now vote on this proposal.`
      );

    } catch (error) {
      console.error('❌ Failed to create withdrawal proposal:', error);
      await this.sendErrorMessage(groupId, 'Failed to create withdrawal proposal. Please try again.');
    }
  }

  /**
   * Send treasury status message
   */
  private async sendStatusMessage(groupId: string) {
    try {
      // Get treasury balance
      const [usdcBalance, aUsdcBalance] = await this.walletClient.readContract({
        address: this.config.treasuryAddress,
        abi: GroupFiTreasuryABI,
        functionName: 'getTreasuryBalance',
      });

      const formattedUSDC = formatUnits(usdcBalance, 6);
      const formattedAUSDC = formatUnits(aUsdcBalance, 6);
      const totalValue = formatUnits(usdcBalance + aUsdcBalance, 6);

      // Get Aave position details
      const [totalCollateral, availableLiquidity] = await this.walletClient.readContract({
        address: this.config.treasuryAddress,
        abi: GroupFiTreasuryABI,
        functionName: 'getAavePosition',
      });

      await this.sendMessage(groupId,
        `📊 **Treasury Status Report**\n\n` +
        `💰 **Balances:**\n` +
        `• Available USDC: $${formattedUSDC}\n` +
        `• Aave aUSDC: $${formattedAUSDC}\n` +
        `• Total Value: $${totalValue}\n\n` +
        `🏦 **Aave Position:**\n` +
        `• Total Collateral: $${formatUnits(totalCollateral, 6)}\n` +
        `• Available Liquidity: $${formatUnits(availableLiquidity, 6)}\n` +
        `• Estimated APY: 4.5%\n\n` +
        `Use "help" to see available commands.`
      );

    } catch (error) {
      console.error('❌ Failed to get status:', error);
      await this.sendErrorMessage(groupId, 'Failed to retrieve treasury status.');
    }
  }

  /**
   * Send help message
   */
  private async sendHelpMessage(groupId: string) {
    const helpMessage = 
      `🤖 **GroupFi Agent Commands**\n\n` +
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
      `📝 All commands create proposals that require group voting to execute.`;

    await this.sendMessage(groupId, helpMessage);
  }

  /**
   * Send error message
   */
  private async sendErrorMessage(groupId: string, error: string) {
    await this.sendMessage(groupId, `❌ **Error:** ${error}`);
  }

  /**
   * Send message to group
   */
  private async sendMessage(groupId: string, content: string) {
    if (!this.xmtpClient) return;

    try {
      const groups = await this.xmtpClient.conversations.listGroups();
      const targetGroup = groups.find(g => g.id === groupId);
      
      if (targetGroup) {
        await targetGroup.send(content);
        console.log(`📤 Sent message to group ${groupId}`);
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    }
  }

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  private extractAmount(text: string): string | null {
    // Look for patterns like "1000", "$1000", "1,000", "1000.50"
    const patterns = [
      /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g,
      /(\d+(?:\.\d{1,2})?)\s*(?:usdc|usd|dollars?)/gi,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Clean up the amount (remove $, commas)
        const amount = match[0].replace(/[$,]/g, '').replace(/[^\d.]/g, '');
        if (!isNaN(parseFloat(amount))) {
          return amount;
        }
      }
    }

    return null;
  }

  private extractAddress(text: string): string | null {
    // Look for Ethereum addresses
    const match = text.match(/0x[a-fA-F0-9]{40}/);
    return match ? match[0] : null;
  }

  private extractDescription(text: string): string | null {
    // Look for text after "for" or "because"
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

  private getExplorerLink(hash: string): string {
    const baseUrl = this.config.chainId === 8453 
      ? 'https://basescan.org/tx/' 
      : 'https://sepolia.basescan.org/tx/';
    return `${baseUrl}${hash}`;
  }

  /**
   * Stop the agent
   */
  async stop() {
    this.isListening = false;
    console.log('🛑 GroupFi Agent stopped');
  }
}

// =============================================================================
// AGENT FACTORY
// =============================================================================

export class GroupFiAgentFactory {
  /**
   * Create and initialize a GroupFi agent for a treasury
   */
  static async createAgent(config: AgentConfig): Promise<GroupFiAgent> {
    const agent = new GroupFiAgent(config);
    await agent.initialize();
    return agent;
  }

  /**
   * Create agent from environment variables
   */
  static async createFromEnv(): Promise<GroupFiAgent> {
    const config: AgentConfig = {
      privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
      xmtpEnv: process.env.NODE_ENV === 'production' ? 'production' : 'dev',
      rpcUrl: process.env.RPC_URL_BASE_SEPOLIA || 'https://sepolia.base.org',
      treasuryAddress: process.env.TREASURY_ADDRESS as `0x${string}`,
      chainId: parseInt(process.env.CHAIN_ID || '84532'),
      minConfirmations: parseInt(process.env.MIN_CONFIRMATIONS || '1'),
      enableAutoExecution: process.env.ENABLE_AUTO_EXECUTION === 'true',
    };

    return this.createAgent(config);
  }
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

/*
// Start GroupFi Agent
async function startAgent() {
  try {
    const agent = await GroupFiAgentFactory.createFromEnv();
    
    console.log('🚀 GroupFi Agent is running...');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🛑 Shutting down GroupFi Agent...');
      await agent.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start GroupFi Agent:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  startAgent();
}
*/