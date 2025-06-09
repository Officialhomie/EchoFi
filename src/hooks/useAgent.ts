// src/hooks/useAgent.ts
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
}

interface UseInvestmentAgentOptions {
  autoInitialize?: boolean;
}

export function useInvestmentAgent(options: UseInvestmentAgentOptions = {}) {
  // Client-side state - no AgentKit initialization here!
  const [isInitialized, setIsInitialized] = useState(true); // Always true since server handles initialization
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callAgentAPI = useCallback(async (action: string, params?: any) => {
    setIsInitializing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, params }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Agent operation failed');
      }

      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Agent API call failed (${action}):`, errorMessage);
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

  // No-op function since initialization happens on server-side
  const initializeAgent = useCallback(async () => {
    setError(null);
    // Server-side initialization - nothing to do here
    return Promise.resolve();
  }, []);

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