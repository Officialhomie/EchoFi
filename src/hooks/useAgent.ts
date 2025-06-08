import { useState, useEffect, useCallback, useRef } from "react";
import {
  InvestmentAgent,
  type InvestmentConfig,
  type InvestmentResult,
  type PortfolioBalance,
} from "@/lib/agent";

export interface UseInvestmentAgentOptions {
  autoInitialize?: boolean;
  config?: Partial<InvestmentConfig>;
}

export interface UseInvestmentAgentReturn {
  agent: InvestmentAgent | null;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  // Agent methods
  initializeAgent: () => Promise<void>;
  executeStrategy: (
    strategy: string,
    amount: string,
    asset?: string
  ) => Promise<InvestmentResult>;
  getBalance: () => Promise<PortfolioBalance>;
  rebalance: (targets: Record<string, number>) => Promise<InvestmentResult>;
  getRecommendations: (
    riskTolerance: "conservative" | "moderate" | "aggressive",
    timeHorizon: "short" | "medium" | "long",
    portfolioValue: string
  ) => Promise<string>;
  executeDeFiAction: (
    action: string,
    protocol: string,
    asset: string,
    amount: string,
    additionalParams?: Record<string, unknown>
  ) => Promise<InvestmentResult>;
  analyzePerformance: (timeframe: "24h" | "7d" | "30d") => Promise<string>;
  getWalletAddress: () => Promise<string>;
  // Utility methods
  clearError: () => void;
  cleanup: () => Promise<void>;
}

export function useInvestmentAgent(
  options: UseInvestmentAgentOptions = {}
): UseInvestmentAgentReturn {
  const [agent, setAgent] = useState<InvestmentAgent | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to prevent re-initialization on re-renders
  const initializationAttempted = useRef(false);

  const createConfig = useCallback((): InvestmentConfig => {
    // Get configuration from environment variables with correct naming
    const config: InvestmentConfig = {
      cdpApiKeyId:
        options.config?.cdpApiKeyId ||
        process.env.NEXT_PUBLIC_CDP_API_KEY_ID ||
        process.env.CDP_API_KEY_ID ||
        '',
      cdpApiKeySecret:
        options.config?.cdpApiKeySecret ||
        process.env.NEXT_PUBLIC_CDP_API_KEY_SECRET ||
        process.env.CDP_API_KEY_SECRET ||
        '',
      openaiApiKey:
        options.config?.openaiApiKey ||
        process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        '',
      networkId:
        options.config?.networkId ||
        process.env.NEXT_PUBLIC_NETWORK_ID ||
        process.env.NETWORK_ID ||
        'base-sepolia',
    };

    // Validate required configuration
    if (!config.cdpApiKeyId) {
      throw new Error(
        'CDP_API_KEY_ID is required. Please set it in your environment variables.'
      );
    }
    if (!config.cdpApiKeySecret) {
      throw new Error(
        'CDP_API_KEY_SECRET is required. Please set it in your environment variables.'
      );
    }
    if (!config.openaiApiKey) {
      throw new Error(
        'OPENAI_API_KEY is required. Please set it in your environment variables.'
      );
    }

    return config;
  }, [options.config]);

  const initializeAgent = useCallback(async () => {
    if (isInitializing || isInitialized) return;

    setIsInitializing(true);
    setError(null);

    try {
      console.log("🚀 Initializing Investment Agent...");

      // Create configuration
      const config = createConfig();

      // Create agent instance with proper configuration
      const investmentAgent = new InvestmentAgent(config);

      // Initialize the agent
      await investmentAgent.initialize();

      setAgent(investmentAgent);
      setIsInitialized(true);
      console.log("✅ Investment Agent initialized successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to initialize agent";
      console.error("❌ Agent initialization failed:", errorMessage);
      setError(errorMessage);
      setAgent(null);
      setIsInitialized(false);
    } finally {
      setIsInitializing(false);
    }
  }, [createConfig, isInitializing, isInitialized]);

  // Auto-initialize on mount if enabled
  useEffect(() => {
    if (options.autoInitialize !== false && !initializationAttempted.current) {
      initializationAttempted.current = true;
      initializeAgent();
    }
  }, [initializeAgent, options.autoInitialize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (agent) {
        agent.cleanup().catch(console.error);
      }
    };
  }, [agent]);

  // Helper function to ensure agent is ready
  const ensureAgent = useCallback(
    (agent: InvestmentAgent | null): InvestmentAgent => {
      if (!agent || !isInitialized) {
        throw new Error(
          "Investment Agent not initialized. Call initializeAgent() first."
        );
      }
      return agent;
    },
    [isInitialized]
  );

  // Agent method wrappers with error handling
  const executeStrategy = useCallback(
    async (
      strategy: string,
      amount: string,
      asset: string = "USDC"
    ): Promise<InvestmentResult> => {
      try {
        const readyAgent = ensureAgent(agent);
        return await readyAgent.executeInvestmentStrategy(
          strategy,
          amount,
          asset
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Strategy execution failed";
        setError(errorMessage);
        throw err;
      }
    },
    [agent, ensureAgent]
  );

  const getBalance = useCallback(async (): Promise<PortfolioBalance> => {
    try {
      const readyAgent = ensureAgent(agent);
      return await readyAgent.getPortfolioBalance();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get balance";
      setError(errorMessage);
      throw err;
    }
  }, [agent, ensureAgent]);

  const rebalance = useCallback(
    async (targets: Record<string, number>): Promise<InvestmentResult> => {
      try {
        const readyAgent = ensureAgent(agent);
        return await readyAgent.rebalancePortfolio(targets);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Rebalancing failed";
        setError(errorMessage);
        throw err;
      }
    },
    [agent, ensureAgent]
  );

  const getRecommendations = useCallback(
    async (
      riskTolerance: "conservative" | "moderate" | "aggressive",
      timeHorizon: "short" | "medium" | "long",
      portfolioValue: string
    ): Promise<string> => {
      try {
        const readyAgent = ensureAgent(agent);
        return await readyAgent.getInvestmentRecommendations(
          riskTolerance,
          timeHorizon,
          portfolioValue
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to get recommendations";
        setError(errorMessage);
        throw err;
      }
    },
    [agent, ensureAgent]
  );

  const executeDeFiAction = useCallback(
    async (
      action: string,
      protocol: string,
      asset: string,
      amount: string,
      additionalParams?: Record<string, unknown>
    ): Promise<InvestmentResult> => {
      try {
        const readyAgent = ensureAgent(agent);
        return await readyAgent.executeDeFiAction(
          action,
          protocol,
          asset,
          amount,
          additionalParams
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "DeFi action failed";
        setError(errorMessage);
        throw err;
      }
    },
    [agent, ensureAgent]
  );

  const analyzePerformance = useCallback(
    async (timeframe: "24h" | "7d" | "30d"): Promise<string> => {
      try {
        const readyAgent = ensureAgent(agent);
        return await readyAgent.analyzePortfolioPerformance(timeframe);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Performance analysis failed";
        setError(errorMessage);
        throw err;
      }
    },
    [agent, ensureAgent]
  );

  const getWalletAddress = useCallback(async (): Promise<string> => {
    try {
      const readyAgent = ensureAgent(agent);
      return await readyAgent.getWalletAddress();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get wallet address";
      setError(errorMessage);
      throw err;
    }
  }, [agent, ensureAgent]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const cleanup = useCallback(async () => {
    if (agent) {
      try {
        await agent.cleanup();
        setAgent(null);
        setIsInitialized(false);
        console.log("🧹 Investment Agent cleanup completed");
      } catch (err) {
        console.error("Error during cleanup:", err);
      }
    }
  }, [agent]);

  return {
    agent,
    isInitialized,
    isInitializing,
    error,
    initializeAgent,
    executeStrategy,
    getBalance,
    rebalance,
    getRecommendations,
    executeDeFiAction,
    analyzePerformance,
    getWalletAddress,
    clearError,
    cleanup,
  };
}
