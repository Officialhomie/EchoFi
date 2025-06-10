import { useState, useCallback, useEffect } from "react";

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
  walletAddress?: string;
  executedAt?: string;
}

export interface AgentInitializationStatus {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  lastInitAttempt: number | null;
}

interface UseInvestmentAgentOptions {
  autoInitialize?: boolean;
  pollingInterval?: number; // How often to check initialization status
}

export function useInvestmentAgent(options: UseInvestmentAgentOptions = {}) {
  const { autoInitialize = true, pollingInterval = 5000 } = options;
  
  // Client-side state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializationStatus, setInitializationStatus] = useState<AgentInitializationStatus>({
    isInitialized: false,
    isInitializing: false,
    error: null,
    lastInitAttempt: null,
  });
  const [initializationMessages, setInitializationMessages] = useState<string[]>([]);

  const addInitMessage = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const fullMessage = `[${timestamp}] ${message}`;
    setInitializationMessages(prev => [...prev.slice(-4), fullMessage]); // Keep last 5 messages
    console.log(`🤖 [AgentKit] ${fullMessage}`);
  }, []);

  const callAgentAPI = useCallback(async (action: string, params?: any) => {
    console.log(`🔄 [DEBUG] Calling agent API: ${action}`, params);
    setIsInitializing(true);
    setError(null);
    
    try {
      const requestBody = { action, params };
      console.log(`📤 [DEBUG] Request body:`, requestBody);
      
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`📥 [DEBUG] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [DEBUG] Error response:`, errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        // Update initialization status from server
        if (errorData.initializationStatus) {
          setInitializationStatus(errorData.initializationStatus);
          if (errorData.initializationStatus.error) {
            addInitMessage(`❌ Initialization error: ${errorData.initializationStatus.error}`);
          }
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ [DEBUG] Success response:`, result);

      // Update initialization status from server response
      if (result.initializationStatus) {
        const newStatus = result.initializationStatus;
        setInitializationStatus(newStatus);
        
        // Add messages based on status changes
        if (newStatus.isInitialized && !isInitialized) {
          addInitMessage('✅ AgentKit fully initialized and operational!');
          setIsInitialized(true);
        } else if (newStatus.isInitializing && !isInitializing) {
          addInitMessage('🚀 Initializing AgentKit...');
        } else if (newStatus.error && newStatus.error !== error) {
          addInitMessage(`❌ Error: ${newStatus.error}`);
        }
      }

      if (!result.success) {
        console.error(`❌ [DEBUG] API returned success=false:`, result);
        throw new Error(result.error || 'Agent operation failed');
      }

      console.log(`📊 [DEBUG] Final data:`, result.data);
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ [DEBUG] Agent API call failed (${action}):`, errorMessage);
      setError(errorMessage);
      addInitMessage(`❌ ${action} failed: ${errorMessage}`);
      throw err;
    } finally {
      setIsInitializing(false);
    }
  }, [isInitialized, isInitializing, error, addInitMessage]);

  // Check initialization status periodically
  const checkInitializationStatus = useCallback(async () => {
    try {
      const status = await callAgentAPI('getInitializationStatus');
      // Status update happens in callAgentAPI
    } catch (error) {
      // Error handling happens in callAgentAPI
    }
  }, [callAgentAPI]);

  // Auto-check initialization status
  useEffect(() => {
    if (autoInitialize) {
      addInitMessage('🔄 Checking AgentKit status...');
      checkInitializationStatus();
      
      // Set up periodic checking
      const interval = setInterval(() => {
        if (!isInitialized) {
          checkInitializationStatus();
        }
      }, pollingInterval);

      return () => clearInterval(interval);
    }
  }, [autoInitialize, checkInitializationStatus, isInitialized, pollingInterval, addInitMessage]);

  const executeStrategy = useCallback(
    async (strategy: string, amount: string, asset: string = "USDC"): Promise<InvestmentResult> => {
      try {
        addInitMessage(`🎯 Executing strategy: ${strategy} with ${amount} ${asset}`);
        const result = await callAgentAPI('executeStrategy', { strategy, amount, asset });
        addInitMessage(`✅ Strategy execution completed successfully`);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        addInitMessage(`❌ Strategy execution failed: ${errorMsg}`);
        return {
          success: false,
          summary: `Failed to execute strategy: ${errorMsg}`,
          error: errorMsg,
        };
      }
    },
    [callAgentAPI, addInitMessage]
  );

  const getBalance = useCallback(async (): Promise<PortfolioBalance> => {
    addInitMessage('💰 Fetching portfolio balance...');
    try {
      const result = await callAgentAPI('getBalance');
      addInitMessage(`✅ Balance retrieved for ${result.balances?.length || 0} assets`);
      return result;
    } catch (error) {
      addInitMessage(`❌ Failed to fetch balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [callAgentAPI, addInitMessage]);

  const getWalletAddress = useCallback(async (): Promise<string> => {
    try {
      const result = await callAgentAPI('getWalletAddress');
      addInitMessage(`📍 Wallet address: ${result.address}`);
      return result.address;
    } catch (error) {
      addInitMessage(`❌ Failed to get wallet address: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [callAgentAPI, addInitMessage]);

  const analyzePerformance = useCallback(async (timeframe: "24h" | "7d" | "30d"): Promise<string> => {
    try {
      addInitMessage(`📊 Analyzing performance for ${timeframe}...`);
      const result = await callAgentAPI('analyzePerformance', { timeframe });
      addInitMessage(`✅ Performance analysis completed`);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addInitMessage(`❌ Performance analysis failed: ${errorMsg}`);
      return `Performance analysis not available: ${errorMsg}`;
    }
  }, [callAgentAPI, addInitMessage]);

  const clearError = useCallback(() => {
    setError(null);
    setInitializationMessages([]);
  }, []);

  const forceReinitialize = useCallback(async () => {
    addInitMessage('🔄 Forcing AgentKit reinitialization...');
    setIsInitialized(false);
    setInitializationStatus({
      isInitialized: false,
      isInitializing: false,
      error: null,
      lastInitAttempt: null,
    });
    await checkInitializationStatus();
  }, [addInitMessage, checkInitializationStatus]);

  // Health check function
  const checkHealth = useCallback(async () => {
    try {
      addInitMessage('🏥 Running health check...');
      const response = await fetch('/api/agent', {
        method: 'GET',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Agent health check:', result);
        
        if (result.initializationStatus) {
          setInitializationStatus(result.initializationStatus);
        }
        
        if (result.status === 'healthy') {
          addInitMessage('✅ Health check passed - AgentKit is operational');
        } else {
          addInitMessage(`⚠️ Health check warning: ${result.status}`);
        }
        
        return result;
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Health check failed';
      console.error('Health check error:', error);
      setError(errorMsg);
      addInitMessage(`❌ Health check failed: ${errorMsg}`);
      throw error;
    }
  }, [addInitMessage]);

  return {
    // Core state
    agent: null, // No direct agent access on client-side
    isInitialized: initializationStatus.isInitialized,
    isInitializing: initializationStatus.isInitializing,
    error: error || initializationStatus.error,
    
    // Initialization status and messages
    initializationStatus,
    initializationMessages,
    
    // Core functions
    initializeAgent: checkInitializationStatus,
    executeStrategy,
    getBalance,
    getWalletAddress,
    analyzePerformance,
    checkHealth,
    
    // Utility functions
    clearError,
    forceReinitialize,
    
    // Placeholder functions (not implemented yet)
    rebalance: async (targets: Record<string, number>) => {
      try {
        return await callAgentAPI('rebalance', { targets });
      } catch (error) {
        return {
          success: false,
          summary: 'Rebalancing not implemented yet',
          error: 'Not implemented',
        };
      }
    },
    getRecommendations: async (
      riskTolerance: "conservative" | "moderate" | "aggressive",
      timeHorizon: "short" | "medium" | "long",
      portfolioValue: string
    ) => {
      try {
        return await callAgentAPI('getRecommendations', { 
          riskTolerance, 
          timeHorizon, 
          portfolioValue 
        });
      } catch (error) {
        return 'Investment recommendations not available yet';
      }
    },
    executeDeFiAction: async (
      action: string,
      protocol: string,
      asset: string,
      amount: string,
      additionalParams?: Record<string, unknown>
    ) => {
      try {
        return await callAgentAPI('executeDeFiAction', {
          action,
          protocol,
          asset,
          amount,
          additionalParams,
        });
      } catch (error) {
        return {
          success: false,
          summary: 'DeFi action not implemented yet',
          error: 'Not implemented',
        };
      }
    },
    cleanup: async () => {
      setError(null);
      setIsInitializing(false);
      setInitializationMessages([]);
    },
  };
}