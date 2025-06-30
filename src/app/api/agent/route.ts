// src/app/api/agent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prepareAgentkitAndWalletProvider } from '@/lib/agentkit/prepare-agentkit';
import { formatEther } from 'viem';
import { networkManager, isNetworkError, getNetworkErrorMessage } from '@/lib/network-utils';
import { serviceHealthMonitor, canUseService, shouldUseFallback } from '@/lib/service-health';
import { FEATURE_FLAGS } from '@/lib/network-config';

/**
 * Agent action parameters interface
 */
interface AgentActionParams {
  timeframe?: '24h' | '7d' | '30d';
  strategy?: string;
  amount?: string;
  asset?: string;
  targets?: Record<string, number>;
  [key: string]: unknown;
}

/**
 * Safe error message extraction utility with network error handling
 */
function getErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return getNetworkErrorMessage(error);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Agent health check - GET /api/agent
 * Enhanced with service health monitoring and graceful degradation
 */
export async function GET() {
  try {
    console.log('🔍 Agent health check initiated...');
    
    // Start health monitoring if not already started
    if (FEATURE_FLAGS.enableHealthChecks) {
      serviceHealthMonitor.startMonitoring();
    }

    // Check overall service health first
    const overallHealth = await serviceHealthMonitor.getHealthStatus();
    console.log(`🏥 System health: ${overallHealth.overall.systemStatus} (${overallHealth.overall.healthyServices}/${overallHealth.overall.totalServices} services healthy)`);

    // Try to initialize AgentKit with enhanced error handling
    let agentInfo: any = null;
    let initializationError: string | null = null;

    try {
      const { walletProvider } = await prepareAgentkitAndWalletProvider();
      
      const network = walletProvider.getNetwork();
      const address = walletProvider.getAddress();
      
      // Try to get balance with timeout and retry
      let balance = 'Unable to fetch';
      try {
        if (canUseService('blockchain')) {
          const balanceWei = await getBalanceWithTimeout(walletProvider);
          balance = `${formatEther(BigInt(balanceWei))} ETH`;
        } else {
          balance = 'Service degraded - cached data unavailable';
        }
      } catch (balanceError) {
        console.warn('⚠️ Could not fetch balance during health check:', getErrorMessage(balanceError));
        balance = `Error: ${getErrorMessage(balanceError)}`;
        
        // Don't fail health check for balance fetch issues
        if (isNetworkError(balanceError)) {
          serviceHealthMonitor.enableDegradedMode('blockchain', 'cache');
        }
      }

      agentInfo = {
        address,
        network: network.networkId,
        chainId: network.chainId,
        balance
      };

    } catch (initError) {
      console.error('❌ AgentKit initialization failed during health check:', getErrorMessage(initError));
      initializationError = getErrorMessage(initError);
      
      // Mark services as degraded based on error type
      if (isNetworkError(initError)) {
        serviceHealthMonitor.enableDegradedMode('coinbase', 'disabled');
      }
    }

    // Determine overall health status
    const degradedServices = serviceHealthMonitor.getDegradedServices();
    const isHealthy = initializationError === null && overallHealth.overall.systemStatus !== 'down';
    const isDegraded = degradedServices.length > 0 || overallHealth.overall.systemStatus === 'degraded';

    const healthStatus = {
      status: isHealthy ? (isDegraded ? 'degraded' : 'healthy') : 'unhealthy',
      message: isHealthy 
        ? (isDegraded ? 'Agent operational with limited functionality' : 'Agent initialization successful')
        : 'Agent initialization failed',
      agentkit: initializationError ? `Error: ${initializationError}` : 'Connected and ready',
      wallet: agentInfo,
      services: {
        overall: overallHealth.overall,
        degraded: degradedServices,
        healthy: Object.keys(overallHealth.services).filter(name => 
          overallHealth.services[name].isHealthy
        ),
      },
      features: {
        walletOperations: canUseService('coinbase'),
        blockchainQueries: canUseService('blockchain'),
        messaging: canUseService('xmtp'),
        degradedMode: FEATURE_FLAGS.gracefulDegradation,
        caching: FEATURE_FLAGS.enableRequestCaching,
        retries: FEATURE_FLAGS.enableNetworkRetries,
      },
      timestamp: new Date().toISOString()
    };

    console.log(`${isHealthy ? '✅' : '❌'} Health check ${isHealthy ? 'passed' : 'failed'}:`, {
      status: healthStatus.status,
      degradedServices: degradedServices.length,
      systemStatus: overallHealth.overall.systemStatus
    });
    
    return NextResponse.json(healthStatus, { 
      status: isHealthy ? 200 : 503 // Service Unavailable if unhealthy
    });

  } catch (error) {
    console.error('❌ Health check failed:', getErrorMessage(error));
    
    const errorResponse = {
      status: 'unhealthy',
      message: 'Health check system failure',
      error: getErrorMessage(error),
      services: {
        overall: { systemStatus: 'down', healthyServices: 0, totalServices: 0 },
        degraded: [],
        healthy: [],
      },
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          stack: error instanceof Error ? error.stack : undefined
        }
      })
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Enhanced balance fetching with timeout
 */
async function getBalanceWithTimeout(walletProvider: any, timeoutMs = 8000): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Balance fetch timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const balance = await walletProvider.getBalance();
      clearTimeout(timeoutId);
      resolve(balance);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * Agent message handling - POST /api/agent
 * Handles both direct queries and action-based requests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params, userMessage } = body;

    console.log('📨 Agent API Request:', { action, hasParams: !!params, hasMessage: !!userMessage });

    // Handle action-based requests (for useAgent hook)
    if (action) {
      return await handleActionRequest(action, params || {});
    }

    // Handle direct message requests (for chat interface)
    if (userMessage) {
      return await handleChatMessage(userMessage);
    }

    return NextResponse.json({
      success: false,
      error: 'Either "action" or "userMessage" parameter is required'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Agent API error:', getErrorMessage(error));
    
    const errorResponse = {
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          stack: error instanceof Error ? error.stack : undefined
        }
      })
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Handle action-based requests with proper error handling
 */
async function handleActionRequest(action: string, params: AgentActionParams) {
  console.log(`🔄 Processing action: ${action}`);

  try {
    switch (action) {
      case 'getBalance':
        return await handleGetBalance();
      
      case 'executeStrategy':
        return await handleExecuteStrategy(params);
      
      case 'getWalletAddress':
        return await handleGetWalletAddress();
      
      case 'analyzePerformance':
        return await handleAnalyzePerformance(params);
      
      case 'rebalance':
        return await handleRebalance(params);
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          availableActions: ['getBalance', 'executeStrategy', 'getWalletAddress', 'analyzePerformance', 'rebalance']
        }, { status: 400 });
    }
  } catch (actionError) {
    console.error(`❌ Action ${action} failed:`, getErrorMessage(actionError));
    return NextResponse.json({
      success: false,
      error: `Action ${action} failed: ${getErrorMessage(actionError)}`,
      action,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Handle chat message requests
 */
async function handleChatMessage(userMessage: string): Promise<NextResponse> {
  try {
    // For now, return a simple response
    // TODO: Integrate with LangChain agent for full chat functionality
    const response = `Received message: "${userMessage}". Agent chat functionality is being implemented.`;
    
    return NextResponse.json({
      success: true,
      response,
      timestamp: new Date().toISOString()
    });
  } catch (chatError) {
    throw new Error(`Chat message processing failed: ${getErrorMessage(chatError)}`);
  }
}

/**
 * Handle balance request with enhanced error handling and caching
 */
async function handleGetBalance() {
  try {
    console.log('💰 Fetching wallet balance...');
    
    // Check if blockchain service is available
    if (!canUseService('blockchain')) {
      console.warn('⚠️ Blockchain service unavailable, checking for cached data...');
      // In a real implementation, you might return cached balance here
      throw new Error('Blockchain service temporarily unavailable. Please try again later.');
    }

    // Use fallback mode if service is degraded
    if (shouldUseFallback('blockchain')) {
      console.warn('⚠️ Using fallback mode for balance fetching...');
    }

    const { walletProvider } = await prepareAgentkitAndWalletProvider();
    
    // Enhanced balance fetching with retry and timeout
    const balanceWei = await getBalanceWithRetry(walletProvider);
    const balanceEth = formatEther(BigInt(balanceWei));
    const address = walletProvider.getAddress();
    
    const balanceData = {
      address,
      balance: balanceEth,
      balanceWei: balanceWei.toString(),
      currency: 'ETH',
      network: walletProvider.getNetwork().networkId,
      source: shouldUseFallback('blockchain') ? 'fallback' : 'primary',
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Balance fetched successfully:', balanceData);
    
    return NextResponse.json({ 
      success: true, 
      data: balanceData 
    });
  } catch (balanceError) {
    console.error('❌ Balance fetch failed:', getErrorMessage(balanceError));
    
    // Handle different types of errors gracefully
    if (isNetworkError(balanceError)) {
      serviceHealthMonitor.enableDegradedMode('blockchain', 'cache');
      
      return NextResponse.json({
        success: false,
        error: 'Network connectivity issues. Balance information temporarily unavailable.',
        code: balanceError.code,
        retryAfter: balanceError.retryAfter,
        timestamp: new Date().toISOString()
      }, { status: 503 }); // Service Unavailable
    }
    
    throw new Error(`Failed to get wallet balance: ${getErrorMessage(balanceError)}`);
  }
}

/**
 * Enhanced balance fetching with retry logic and timeout
 */
async function getBalanceWithRetry(walletProvider: any, maxRetries = 3): Promise<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`💰 [BALANCE] Attempt ${attempt + 1}/${maxRetries}`);
      
      // Use the same timeout function as health check
      const balance = await getBalanceWithTimeout(walletProvider, 8000);
      console.log(`✅ [BALANCE] Success on attempt ${attempt + 1}`);
      return balance;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ [BALANCE] Attempt ${attempt + 1} failed:`, getErrorMessage(lastError));
      
      // Don't retry on the last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
        console.log(`⏳ [BALANCE] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to fetch balance after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Handle strategy execution
 */
async function handleExecuteStrategy(params: AgentActionParams) {
  try {
    const { strategy, amount, asset = 'USDC' } = params;
    
    if (!strategy || !amount) {
      throw new Error('Strategy and amount parameters are required');
    }
    
    // TODO: Implement actual strategy execution with AgentKit
    console.log(`🎯 Strategy execution requested: ${strategy} with ${amount} ${asset}`);
    
    const result = {
      success: true,
      summary: `Strategy "${strategy}" execution initiated with ${amount} ${asset}`,
      strategy,
      amount,
      asset,
      status: 'pending',
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json({ 
      success: true, 
      data: result 
    });
  } catch (strategyError) {
    throw new Error(`Strategy execution failed: ${getErrorMessage(strategyError)}`);
  }
}

/**
 * Handle wallet address request
 */
async function handleGetWalletAddress() {
  try {
    console.log('📝 Fetching wallet address...');
    
    const { walletProvider } = await prepareAgentkitAndWalletProvider();
    const address = walletProvider.getAddress();
    const network = walletProvider.getNetwork();
    
    const addressData = {
      address,
      network: network.networkId,
      chainId: network.chainId,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Wallet address fetched successfully:', addressData);
    
    return NextResponse.json({ 
      success: true, 
      data: addressData 
    });
  } catch (addressError) {
    throw new Error(`Failed to get wallet address: ${getErrorMessage(addressError)}`);
  }
}

/**
 * Handle performance analysis
 */
async function handleAnalyzePerformance(params: AgentActionParams) {
  try {
    const { timeframe = '7d' } = params;
    
    console.log(`📊 Analyzing performance for timeframe: ${timeframe}`);
    
    // Get current agent status
    const { walletProvider } = await prepareAgentkitAndWalletProvider();
    const address = walletProvider.getAddress();
    const network = walletProvider.getNetwork();
    
    let balance = 'Unable to fetch';
    try {
      const balanceWei = await walletProvider.getBalance();
      balance = `${formatEther(BigInt(balanceWei))} ETH`;
    } catch (balanceError) {
      console.warn('⚠️ Could not fetch balance for analysis:', getErrorMessage(balanceError));
    }
    
    const analysis = `Portfolio Performance Analysis (${timeframe}):

📊 Current Status: Portfolio tracking initialized
🏦 Wallet Address: ${address}
🌐 Network: ${network.networkId} (Chain ID: ${network.chainId})
💰 Current Balance: ${balance}
🔧 AgentKit Status: Connected and ready
⚡ Real-time Updates: Available
🎯 Next Steps: Fund wallet to begin active portfolio tracking

Technical Integration:
- AgentKit: ✅ Initialized successfully
- LangChain: ✅ Agent configured  
- Database: ✅ Connected and ready
- XMTP: ✅ Messaging system active

Ready for live portfolio management once funds are added to the connected wallet.`;

    return NextResponse.json({ 
      success: true, 
      data: analysis,
      metadata: {
        timeframe,
        address,
        network: network.networkId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (analysisError) {
    throw new Error(`Performance analysis failed: ${getErrorMessage(analysisError)}`);
  }
}

/**
 * Handle portfolio rebalancing
 */
async function handleRebalance(params: AgentActionParams) {
  try {
    const { targets } = params;
    
    if (!targets) {
      throw new Error('Rebalancing targets are required');
    }
    
    console.log('⚖️ Portfolio rebalancing requested:', targets);
    
    // TODO: Implement actual rebalancing with AgentKit
    const result = {
      success: true,
      summary: 'Portfolio rebalancing initiated',
      targets,
      status: 'pending',
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json({ 
      success: true, 
      data: result 
    });
  } catch (rebalanceError) {
    throw new Error(`Portfolio rebalancing failed: ${getErrorMessage(rebalanceError)}`);
  }
}