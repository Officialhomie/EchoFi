// src/types/agent.ts - AI Agent and automation types
export interface AgentConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    enabledProtocols: string[];
    slippageTolerance: number;
    gasOptimization: boolean;
  }
  
  export interface AgentAnalysis {
    strategy: string;
    riskAssessment: {
      level: 'low' | 'medium' | 'high';
      factors: string[];
      score: number;
    };
    expectedOutcome: {
      bestCase: string;
      worstCase: string;
      mostLikely: string;
    };
    executionPlan: ExecutionStep[];
    recommendations: string[];
    confidence: number;
  }
  
  export interface ExecutionStep {
    step: number;
    action: string;
    protocol: string;
    parameters: Record<string, any>;
    estimatedGas: string;
    expectedOutput: string;
  }
  
  export interface AgentState {
    isInitialized: boolean;
    isProcessing: boolean;
    lastActivity: number | null;
    error: string | null;
    capabilities: string[];
    status: 'idle' | 'analyzing' | 'executing' | 'error';
  }
  
  export interface AgentCommand {
    type: 'analyze' | 'execute' | 'query' | 'validate';
    payload: Record<string, any>;
    context?: {
      groupId?: string;
      proposalId?: string;
      userAddress?: string;
    };
  }