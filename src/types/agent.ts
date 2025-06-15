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
    // Using Record<string, unknown> instead of any for better type safety
    // This allows flexibility while maintaining some type constraints
    parameters: Record<string, unknown>;
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
    payload: Record<string, unknown>;
    context?: {
        groupId?: string;
        proposalId?: string;
        userAddress?: string;
    };
}