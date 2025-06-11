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
  // Client-side state - server handles all AgentKit operations
  const [isInitialized, setIsInitialized] = useState(true); // Always true since server handles initialization
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ [DEBUG] Agent API call failed (${action}):`, errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsInitializing(false);
      setIsInitialized(true);
    }
  }, []);

  const executeStrategy = useCallback(
    async (strategy: string, amount: string, asset: string = "USDC"): Promise<InvestmentResult> => {
      try {
        return await callAgentAPI('executeStrategy', { strategy, amount, asset });
      } catch (error) {
        return {
          success: false,
          summary: `Failed to execute strategy: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error instanceof Error ? error.message : 'Unknown error',
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
    } catch (error) {
      return `Performance analysis not available: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
    } catch (error) {
      console.error('❌ Health check error:', error);
      setError(error instanceof Error ? error.message : 'Health check failed');
      throw error;
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

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
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
    } catch (error) {
      console.warn('Agent health check failed during initialization:', error);
      // Don't throw here, just log warning
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
    
    clearError,
    
    cleanup: async () => {
      setError(null);
      setIsInitializing(false);
    },
  };
}