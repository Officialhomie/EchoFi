import { useState, useCallback } from "react";

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
  timestamp?: number;
}

interface UseInvestmentAgentOptions {
  autoInitialize?: boolean;
}

export function useInvestmentAgent(options: UseInvestmentAgentOptions = {}) {
  // FIXED: Use the options parameter to configure auto-initialization
  // This eliminates the "options assigned but never used" error by actually using it
  const shouldAutoInitialize = options.autoInitialize ?? true;

  // Client-side state - server handles all AgentKit operations
  const [isInitialized, setIsInitialized] = useState(shouldAutoInitialize); // Use the option
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callAgentAPI = useCallback(async (action: string, params?: Record<string, unknown>) => {
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
        
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ [DEBUG] Success response:`, result);

      if (!result.success) {
        console.error(`❌ [DEBUG] API returned success=false:`, result);
        throw new Error(result.error || 'Agent operation failed');
      }

      console.log(`📊 [DEBUG] Final data:`, result.data);
      return result.data;
    } catch (apiError) {
      // FIXED: Rename error variable to avoid shadowing and actually use it
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      console.error(`❌ [DEBUG] Agent API call failed (${action}):`, errorMessage);
      setError(errorMessage);
      throw apiError;
    } finally {
      setIsInitializing(false);
      setIsInitialized(true);
    }
  }, []);

  const executeStrategy = useCallback(
    async (strategy: string, amount: string, asset: string = "USDC"): Promise<InvestmentResult> => {
      try {
        return await callAgentAPI('executeStrategy', { strategy, amount, asset });
      } catch (strategyError) {
        // FIXED: Use the error variable meaningfully in error handling
        console.error('Strategy execution failed:', strategyError);
        return {
          success: false,
          summary: `Failed to execute strategy: ${strategyError instanceof Error ? strategyError.message : 'Unknown error'}`,
          error: strategyError instanceof Error ? strategyError.message : 'Unknown error',
          timestamp: Date.now()
        };
      }
    },
    [callAgentAPI]
  );

  const getBalance = useCallback(async (): Promise<PortfolioBalance> => {
    return await callAgentAPI('getBalance');
  }, [callAgentAPI]);

  const getWalletAddress = useCallback(async (): Promise<string> => {
    const result = await callAgentAPI('getWalletAddress');
    return result.address;
  }, [callAgentAPI]);

  const analyzePerformance = useCallback(async (timeframe: "24h" | "7d" | "30d"): Promise<string> => {
    try {
      return await callAgentAPI('analyzePerformance', { timeframe });
    } catch (performanceError) {
      // FIXED: Use the error variable to provide meaningful error information
      const errorMsg = performanceError instanceof Error ? performanceError.message : 'Unknown error';
      console.error('Performance analysis failed:', performanceError);
      return `Performance analysis not available: ${errorMsg}`;
    }
  }, [callAgentAPI]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Health check function to verify agent is working
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/agent', {
        method: 'GET',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Agent health check passed:', result);
        return result;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Health check failed');
      }
    } catch (healthError) {
      // FIXED: Use the error variable for proper error logging and state management
      const errorMessage = healthError instanceof Error ? healthError.message : 'Health check failed';
      console.error('❌ Health check error:', healthError);
      setError(errorMessage);
      throw healthError;
    }
  }, []);

  // Send a message to the agent (for chat interface)
  const sendMessage = useCallback(async (message: string): Promise<string> => {
    try {
      setIsInitializing(true);
      setError(null);

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userMessage: message }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const result = await response.json();
      return result.response || result.data || 'No response received';

    } catch (messageError) {
      // FIXED: Use the error variable for comprehensive error handling
      const errorMessage = messageError instanceof Error ? messageError.message : 'Failed to send message';
      console.error('Message send failed:', messageError);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // No-op function since initialization happens on server-side
  const initializeAgent = useCallback(async () => {
    setError(null);
    // Server-side initialization - just verify health
    try {
      await checkHealth();
    } catch (initError) {
      // FIXED: Use the error variable for initialization error handling
      console.warn('Agent health check failed during initialization:', initError);
      // Don't throw here, just log warning - initialization can continue
    }
  }, [checkHealth]);

  return {
    agent: null, // No direct agent access on client-side
    isInitialized,
    isInitializing,
    error,
    initializeAgent,
    executeStrategy,
    getBalance,
    getWalletAddress,
    analyzePerformance,
    sendMessage, // New method for chat interface
    checkHealth,
    
    // Legacy/placeholder methods for backward compatibility
    rebalance: async (targets: Record<string, number>) => {
      try {
        return await callAgentAPI('rebalance', { targets });
      } catch (rebalanceError) {
        console.error('Rebalance operation failed:', rebalanceError);
        return {
          success: false,
          summary: 'Rebalancing not implemented yet',
          error: rebalanceError instanceof Error ? rebalanceError.message : 'Not implemented',
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
      } catch (recommendationError) {
        console.error('Recommendations request failed:', recommendationError);
        return `Investment recommendations not available: ${recommendationError instanceof Error ? recommendationError.message : 'Unknown error'}`;
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
      } catch (defiError) {
        console.error('DeFi action failed:', defiError);
        return {
          success: false,
          summary: 'DeFi action not implemented yet',
          error: defiError instanceof Error ? defiError.message : 'Not implemented',
        };
      }
    },
    
    clearError,
    
    cleanup: async () => {
      setError(null);
      setIsInitializing(false);
    },
  };
}