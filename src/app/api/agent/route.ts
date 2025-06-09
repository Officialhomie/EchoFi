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
    console.log('🚀 Initializing AgentKit...');
    
    // Validate environment variables first
    const envVars = validateEnvironmentVariables();
    
    // Initialize AgentKit with correct parameter names
    const kit = await AgentKit.from({
      cdpApiKeyId: envVars.CDP_API_KEY_ID!,
      cdpApiKeySecret: envVars.CDP_API_KEY_SECRET!,
      
    });

    console.log('✅ AgentKit initialized successfully');
    return kit;
    
  } catch (error) {
    console.error('❌ Failed to initialize AgentKit:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('Invalid CDP API credentials. Please check your API key and private key.');
      }
      if (error.message.includes('network')) {
        throw new Error('Network connection error. Please check your internet connection.');
      }
      if (error.message.includes('wallet')) {
        throw new Error('Failed to initialize wallet. Please check your CDP configuration.');
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
    // Get the wallet address from AgentKit
    const tools = await getLangChainTools(kit);
    // The wallet address should be available through the kit
    // This is a placeholder - you may need to adjust based on AgentKit's actual API
    return 'wallet_address_placeholder';
  } catch (error) {
    console.error('Failed to get wallet address:', error);
    throw new Error('Failed to retrieve wallet address');
  }
}

async function getPortfolioBalance(kit: AgentKit) {
  try {
    const tools = await getLangChainTools(kit);
    
    // Mock implementation - replace with actual AgentKit balance retrieval
    return {
      address: 'wallet_address',
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
  } catch (error) {
    console.error('Failed to get portfolio balance:', error);
    throw new Error('Failed to retrieve portfolio balance');
  }
}

async function executeInvestmentStrategy(kit: AgentKit, params: any) {
  try {
    const tools = await getLangChainTools(kit);
    const { strategy, amount, asset = 'USDC' } = params;
    
    if (!strategy || !amount) {
      throw new Error('Strategy and amount are required');
    }
    
    // Mock implementation - replace with actual strategy execution
    console.log(`Executing strategy: ${strategy} with ${amount} ${asset}`);
    
    return {
      success: true,
      summary: `Successfully executed ${strategy} strategy with ${amount} ${asset}`,
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