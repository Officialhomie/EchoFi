import { AgentKit } from '@coinbase/agentkit';
import { getLangChainTools } from '@coinbase/agentkit-langchain';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, BaseMessage } from '@langchain/core/messages';

export interface InvestmentConfig {
  cdpApiKeyName: string;
  cdpApiKeyPrivate: string;
  openaiApiKey: string;
  networkId?: string;
}

export interface PortfolioBalance {
  address: string;
  balances: Array<{
    asset: string;
    amount: string;
    usdValue?: string;
  }>;
  totalUsdValue?: string;
}

export interface InvestmentResult {
  success: boolean;
  transactionHashes?: string[];
  summary: string;
  error?: string;
}

type LangChainAgent = {
  invoke: (input: { messages: HumanMessage[] }) => Promise<{ messages: BaseMessage[] }>;
};

export class InvestmentAgent {
  private agentKit: AgentKit | null = null;
  private llmAgent: LangChainAgent | null = null;
  private config: InvestmentConfig;

  constructor(config: InvestmentConfig) {
    this.config = config;
  }

  /**
   * Initialize the Investment Agent with the correct AgentKit pattern
   */
  async initialize(): Promise<AgentKit> {
    try {
      console.log('Initializing Investment Agent with AgentKit...');

      // Validate configuration
      this.validateConfig();

      // Initialize AgentKit using the correct pattern
      this.agentKit = await AgentKit.from({
        cdpApiKeyName: this.config.cdpApiKeyName,
        cdpApiKeyPrivateKey: this.config.cdpApiKeyPrivate,
      });

      console.log('AgentKit initialized successfully');

      // Initialize LangChain agent with AgentKit tools
      const tools = await getLangChainTools(this.agentKit);
      
      const llm = new ChatOpenAI({
        model: 'gpt-4o-mini',
        apiKey: this.config.openaiApiKey,
        temperature: 0.1,
      });

      this.llmAgent = createReactAgent({
        llm,
        tools,
        stateModifier: `You are an expert DeFi investment agent. Always:
        1. Analyze risks carefully before making any transactions
        2. Verify wallet balances before executing trades
        3. Provide clear explanations of your actions
        4. Never exceed available balances
        5. Consider gas fees in all calculations
        6. Use proper slippage tolerance for trades`,
      });

      console.log('Investment Agent initialized successfully', {
        walletAddress: await this.getWalletAddress(),
        networkId: this.config.networkId || 'base-sepolia'
      });

      return this.agentKit;
    } catch (error) {
      console.error('AgentKit initialization failed:', error);
      throw new Error(`Failed to initialize Investment Agent: ${error}`);
    }
  }

  /**
   * Validate configuration before initialization
   */
  private validateConfig(): void {
    const { cdpApiKeyName, cdpApiKeyPrivate, openaiApiKey } = this.config;

    // if (!cdpApiKeyName) {
    //   throw new Error('CDP_API_KEY_NAME is required. Please set it in your environment variables.');
    // }
    if (!cdpApiKeyPrivate) {
      throw new Error('CDP_API_KEY_PRIVATE is required. Please set it in your environment variables.');
    }
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required. Please set it in your environment variables.');
    }

    // Validate API key format
    if (!cdpApiKeyName.trim() || cdpApiKeyName.length < 10) {
      throw new Error('Invalid CDP_API_KEY_NAME format');
    }
    if (!cdpApiKeyPrivate.trim() || cdpApiKeyPrivate.length < 50) {
      throw new Error('Invalid CDP_API_KEY_PRIVATE format');
    }
  }

  /**
   * Get the wallet address
   */
  async getWalletAddress(): Promise<string> {
    if (!this.agentKit) {
      throw new Error('AgentKit not initialized');
    }
    if (!('walletProvider' in this.agentKit) || !this.agentKit['walletProvider']) {
      throw new Error('AgentKit walletProvider not available');
    }
    return this.agentKit['walletProvider'].getAddress();
  }

  /**
   * Execute an investment strategy using AI
   */
  async executeInvestmentStrategy(
    strategy: string, 
    amount: string,
    asset: string = 'USDC'
  ): Promise<InvestmentResult> {
    if (!this.llmAgent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      const prompt = `
        Execute the following investment strategy:
        
        Strategy: ${strategy}
        Amount: ${amount} ${asset}
        
        Please follow these steps:
        1. Check current wallet balance for ${asset}
        2. Validate the strategy is feasible with available funds
        3. Calculate optimal execution considering gas fees and slippage
        4. Execute the trades/investments step by step
        5. Provide a detailed summary of all actions taken
        
        Important: Only proceed if sufficient balance is available. Be conservative with risk management.
      `;

      const result = await this.llmAgent.invoke({
        messages: [new HumanMessage(prompt)],
      });

      const finalMessage = result.messages[result.messages.length - 1];
      
      return {
        success: true,
        summary: getMessageContentAsString(finalMessage.content),
        transactionHashes: this.extractTransactionHashes(getMessageContentAsString(finalMessage.content)),
      };
    } catch (error) {
      console.error('Investment strategy execution failed:', error);
      return {
        success: false,
        summary: `Failed to execute strategy: ${error}`,
        error: String(error),
      };
    }
  }

  /**
   * Get current portfolio balance
   */
  async getPortfolioBalance(): Promise<PortfolioBalance> {
    if (!this.llmAgent) {
      throw new Error('Agent not initialized');
    }

    try {
      const walletAddress = await this.getWalletAddress();
      
      const prompt = `
        Please check the current wallet balance and provide a detailed breakdown of all assets.
        Wallet address: ${walletAddress}
        
        Format the response as a JSON object with:
        - address: wallet address
        - balances: array of {asset, amount, usdValue}
        - totalUsdValue: total portfolio value in USD
      `;

      const result = await this.llmAgent.invoke({
        messages: [new HumanMessage(prompt)],
      });

      const finalMessage = result.messages[result.messages.length - 1];
      
      try {
        const balanceData = this.extractJsonFromResponse(getMessageContentAsString(finalMessage.content));
        return balanceData as PortfolioBalance;
      } catch {
        return {
          address: walletAddress,
          balances: [],
          totalUsdValue: '0',
        };
      }
    } catch (error) {
      console.error('Failed to get portfolio balance:', error);
      throw new Error(`Failed to fetch portfolio balance: ${error}`);
    }
  }

  /**
   * Rebalance portfolio to target allocations
   */
  async rebalancePortfolio(targets: Record<string, number>): Promise<InvestmentResult> {
    if (!this.llmAgent) {
      throw new Error('Agent not initialized');
    }

    try {
      const currentPortfolio = await this.getPortfolioBalance();
      
      const prompt = `
        Rebalance the portfolio to match these target allocations:
        ${JSON.stringify(targets, null, 2)}
        
        Current Portfolio:
        ${JSON.stringify(currentPortfolio, null, 2)}
        
        Please:
        1. Analyze current vs target allocations
        2. Calculate required trades (buy/sell amounts)
        3. Consider transaction costs and slippage
        4. Execute trades in optimal order
        5. Provide detailed summary of rebalancing actions
        
        Target allocations are in percentages (e.g., 50 = 50% of total portfolio value).
      `;

      const result = await this.llmAgent.invoke({
        messages: [new HumanMessage(prompt)],
      });

      const finalMessage = result.messages[result.messages.length - 1];
      
      return {
        success: true,
        summary: getMessageContentAsString(finalMessage.content),
        transactionHashes: this.extractTransactionHashes(getMessageContentAsString(finalMessage.content)),
      };
    } catch (error) {
      console.error('Portfolio rebalancing failed:', error);
      return {
        success: false,
        summary: `Failed to rebalance portfolio: ${error}`,
        error: String(error),
      };
    }
  }

  /**
   * Get investment recommendations
   */
  async getInvestmentRecommendations(
    riskTolerance: 'conservative' | 'moderate' | 'aggressive',
    timeHorizon: 'short' | 'medium' | 'long',
    portfolioValue: string
  ): Promise<string> {
    if (!this.llmAgent) {
      throw new Error('Agent not initialized');
    }

    try {
      const prompt = `
        Provide investment recommendations based on:
        - Risk Tolerance: ${riskTolerance}
        - Time Horizon: ${timeHorizon}
        - Portfolio Value: ${portfolioValue} USD
        
        Please analyze:
        1. Current DeFi market conditions
        2. Yield opportunities across protocols
        3. Risk-adjusted return potential
        4. Diversification strategies
        5. Specific protocol recommendations with reasoning
        
        Provide actionable recommendations with specific protocols, expected yields, and risk assessments.
      `;

      const result = await this.llmAgent.invoke({
        messages: [new HumanMessage(prompt)],
      });

      const finalMessage = result.messages[result.messages.length - 1];
      return getMessageContentAsString(finalMessage.content);
    } catch (error) {
      console.error('Failed to get investment recommendations:', error);
      throw new Error(`Failed to get recommendations: ${error}`);
    }
  }

  /**
   * Analyze portfolio performance
   */
  async analyzePortfolioPerformance(timeframe: '24h' | '7d' | '30d'): Promise<string> {
    if (!this.llmAgent) {
      throw new Error('Agent not initialized');
    }

    try {
      const currentPortfolio = await this.getPortfolioBalance();
      
      const prompt = `
        Analyze portfolio performance over the last ${timeframe}:
        
        Current Portfolio:
        ${JSON.stringify(currentPortfolio, null, 2)}
        
        Please provide:
        1. Performance metrics (returns, volatility)
        2. Asset allocation analysis
        3. Risk assessment
        4. Comparison to market benchmarks
        5. Optimization recommendations
        
        Focus on actionable insights for improving portfolio performance.
      `;

      const result = await this.llmAgent.invoke({
        messages: [new HumanMessage(prompt)],
      });

      const finalMessage = result.messages[result.messages.length - 1];
      return getMessageContentAsString(finalMessage.content);
    } catch (error) {
      console.error('Portfolio analysis failed:', error);
      throw new Error(`Failed to analyze portfolio: ${error}`);
    }
  }

  /**
   * Execute a specific DeFi action
   */
  async executeDeFiAction(
    action: string,
    protocol: string,
    asset: string,
    amount: string,
    additionalParams?: Record<string, unknown>
  ): Promise<InvestmentResult> {
    if (!this.llmAgent) {
      throw new Error('Agent not initialized');
    }

    try {
      const prompt = `
        Execute DeFi action:
        - Action: ${action}
        - Protocol: ${protocol}
        - Asset: ${asset}
        - Amount: ${amount}
        ${additionalParams ? `- Additional Parameters: ${JSON.stringify(additionalParams, null, 2)}` : ''}
        
        Please:
        1. Verify sufficient balance and approvals
        2. Check protocol parameters and fees
        3. Execute the action with proper error handling
        4. Confirm transaction completion
        5. Provide detailed transaction summary
        
        Be extra careful with smart contract interactions and validate all parameters.
      `;

      const result = await this.llmAgent.invoke({
        messages: [new HumanMessage(prompt)],
      });

      const finalMessage = result.messages[result.messages.length - 1];
      
      return {
        success: true,
        summary: getMessageContentAsString(finalMessage.content),
        transactionHashes: this.extractTransactionHashes(getMessageContentAsString(finalMessage.content)),
      };
    } catch (error) {
      console.error('DeFi action execution failed:', error);
      return {
        success: false,
        summary: `Failed to execute DeFi action: ${error}`,
        error: String(error),
      };
    }
  }

  /**
   * Get agent status and configuration
   */
  getAgentStatus() {
    return {
      isInitialized: !!this.agentKit && !!this.llmAgent,
      agentKitReady: !!this.agentKit,
      networkId: this.config.networkId || 'base-sepolia',
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      this.agentKit = null;
      this.llmAgent = null;
      console.log('Investment Agent cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // Helper methods
  private extractTransactionHashes(content: string): string[] {
    const hashRegex = /0x[a-fA-F0-9]{64}/g;
    const matches = content.match(hashRegex);
    return matches || [];
  }

  private extractJsonFromResponse(content: string): unknown {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  }
}

// Helper to extract string from BaseMessage.content
function getMessageContentAsString(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(getMessageContentAsString).join(' ');
  if (typeof content === 'object' && content !== null) return JSON.stringify(content);
  return String(content);
}