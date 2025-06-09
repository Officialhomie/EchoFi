// src/app/api/agent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AgentKit } from '@coinbase/agentkit';
import { getLangChainTools } from '@coinbase/agentkit-langchain';

let agentKit: AgentKit | null = null;
let initializationPromise: Promise<AgentKit> | null = null;

// Validate environment variables
function validateEnvironmentVariables() {
  const requiredVars = {
    CDP_API_KEY_ID: process.env.CDP_API_KEY_ID,
    CDP_API_KEY_SECRET: process.env.CDP_API_KEY_SECRET,
  };

  const missing = Object.entries(requiredVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return requiredVars;
}

async function getAgentKit(): Promise<AgentKit> {
  // If already initialized, return it
  if (agentKit) {
    return agentKit;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = initializeAgentKit();
  
  try {
    agentKit = await initializationPromise;
    return agentKit;
  } catch (error) {
    // Reset promise on failure so next call can retry
    initializationPromise = null;
    throw error;
  }
}

async function initializeAgentKit(): Promise<AgentKit> {
  try {
    console.log('🚀 Initializing AgentKit on server...');
    
    // Validate environment variables first
    const envVars = validateEnvironmentVariables();
    
    // Initialize AgentKit with correct parameter names from TypeScript definitions
    const kit = await AgentKit.from({
      cdpApiKeyId: envVars.CDP_API_KEY_ID!,
      cdpApiKeySecret: envVars.CDP_API_KEY_SECRET!,
    });

    console.log('✅ AgentKit initialized successfully on server');
    return kit;
    
  } catch (error) {
    console.error('❌ Failed to initialize AgentKit:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('api key')) {
        throw new Error('Invalid CDP API credentials. Please check your API key and secret.');
      }
      if (error.message.includes('network')) {
        throw new Error('Network connection error. Please check your internet connection.');
      }
      if (error.message.includes('wallet')) {
        throw new Error('Failed to initialize wallet. Please check your CDP configuration.');
      }
      if (error.message.includes('required')) {
        throw new Error('Missing required CDP API credentials. Please set CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables.');
      }
    }
    
    throw new Error(`AgentKit initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, params } = await request.json();
    
    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }

    const kit = await getAgentKit();
    
    switch (action) {
      case 'getBalance':
        const balance = await getPortfolioBalance(kit);
        return NextResponse.json({ success: true, data: balance });
        
      case 'executeStrategy':
        const result = await executeInvestmentStrategy(kit, params);
        return NextResponse.json({ success: true, data: result });
        
      case 'getWalletAddress':
        const address = await getWalletAddress(kit);
        return NextResponse.json({ success: true, data: { address } });
        
      case 'analyzePerformance':
        const analysis = await analyzePerformance(kit, params);
        return NextResponse.json({ success: true, data: analysis });
        
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Agent API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = errorMessage.includes('credentials') || errorMessage.includes('API key') ? 401 : 500;
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}

async function getWalletAddress(kit: AgentKit): Promise<string> {
  try {
    // Get the actions from AgentKit
    const actions = kit.getActions();
    
    // Look for wallet-related actions or use AgentKit internal methods
    // This is a safer way to get the wallet address
    try {
      const tools = await getLangChainTools(kit);
      
      // For now, return a demo address until we can properly access the wallet
      // In a real implementation, you'd use the tools to get the actual address
      console.log('AgentKit tools available:', tools.length);
      
      // Attempt to access wallet provider if available
      const walletProvider = (kit as any).walletProvider;
      if (walletProvider && typeof walletProvider.getDefaultAddress === 'function') {
        return await walletProvider.getDefaultAddress();
      }
      
      // Fallback to demo address
      return '0x742d35Cc6634C0532925a3b8D0aC1530e5c7C460'; // Demo address
      
    } catch (toolsError) {
      console.warn('Failed to get tools or wallet address:', toolsError);
      // Return demo address as fallback
      return '0x742d35Cc6634C0532925a3b8D0aC1530e5c7C460';
    }
  } catch (error) {
    console.error('Failed to get wallet address:', error);
    throw new Error('Failed to retrieve wallet address');
  }
}

async function getPortfolioBalance(kit: AgentKit) {
  try {
    const walletAddress = await getWalletAddress(kit);
    const tools = await getLangChainTools(kit);
    
    console.log(`Getting portfolio balance for address: ${walletAddress}`);
    console.log(`Available tools: ${tools.length}`);
    
    // Try to get actual balance using AgentKit tools
    // For demo purposes, return realistic test data
    return {
      address: walletAddress,
      balances: [
        {
          asset: 'ETH',
          amount: '0.001',
          usdValue: '2.50',
        },
        {
          asset: 'USDC',
          amount: '100.0',
          usdValue: '100.00',
        }
      ],
      totalUsdValue: '102.50',
    };
  } catch (error) {
    console.error('Failed to get portfolio balance:', error);
    
    // Return minimal structure on error
    return {
      address: '0x742d35Cc6634C0532925a3b8D0aC1530e5c7C460',
      balances: [
        {
          asset: 'ETH',
          amount: '0.0',
          usdValue: '0.00',
        },
        {
          asset: 'USDC',
          amount: '0.0',
          usdValue: '0.00',
        }
      ],
      totalUsdValue: '0.00',
    };
  }
}

async function executeInvestmentStrategy(kit: AgentKit, params: any) {
  try {
    const { strategy, amount, asset = 'USDC' } = params;
    
    if (!strategy || !amount) {
      throw new Error('Strategy and amount are required');
    }
    
    const tools = await getLangChainTools(kit);
    
    console.log(`Executing strategy: ${strategy} with ${amount} ${asset}`);
    console.log(`Using ${tools.length} available tools`);
    
    // In a real implementation, you would use the tools to execute the strategy
    // For now, return a success response with realistic details
    return {
      success: true,
      summary: `Successfully simulated ${strategy} strategy with ${amount} ${asset}. In production, this would execute real DeFi operations using AgentKit tools.`,
      transactionHashes: [],
    };
  } catch (error) {
    console.error('Failed to execute investment strategy:', error);
    return {
      success: false,
      summary: `Failed to execute strategy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function analyzePerformance(kit: AgentKit, params: any) {
  try {
    const { timeframe = '7d' } = params;
    const tools = await getLangChainTools(kit);
    
    console.log(`Analyzing performance for ${timeframe} using ${tools.length} tools`);
    
    // Simulate performance analysis
    const analysisResult = `Portfolio Performance Analysis (${timeframe}):

📈 Overall Performance: +2.3% over the selected timeframe
🎯 Top Performing Asset: ETH (+5.2%)
⚖️ Risk Assessment: Moderate risk profile
💡 Recommendation: Consider rebalancing to maintain target allocation

Key Metrics:
- Total Portfolio Value: $102.50
- 24h Change: +$2.35 (+2.3%)
- Volatility: 12.5% (within acceptable range)
- Sharpe Ratio: 1.42 (good risk-adjusted returns)

Note: This is a demonstration. Real implementation would use actual market data and AgentKit tools for onchain analysis.`;
    
    return analysisResult;
  } catch (error) {
    console.error('Failed to analyze performance:', error);
    return `Performance analysis unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Health check endpoint
export async function GET() {
  try {
    const envVars = validateEnvironmentVariables();
    
    return NextResponse.json({
      status: 'healthy',
      agentKit: agentKit ? 'initialized' : 'not initialized',
      environment: {
        hasApiKeyId: !!envVars.CDP_API_KEY_ID,
        hasApiKeySecret: !!envVars.CDP_API_KEY_SECRET,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}