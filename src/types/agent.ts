// Add this to a new file: src/types/agent.ts
// Agent-specific types and utilities for better type safety

import type { Address } from 'viem';
import { ProposalType } from './contracts';

// =============================================================================
// AGENT COMMAND TYPES
// =============================================================================

export interface ParsedAmount {
  value: string;
  isValid: boolean;
  error?: string;
}

export interface ParsedAddress {
  value: Address | null;
  isValid: boolean;
  error?: string;
}

export interface CommandParsingResult {
  command: InvestmentCommand | null;
  confidence: number; // 0-100, how confident we are in the parsing
  alternatives?: InvestmentCommand[]; // Alternative interpretations
  errors: string[];
}

export interface InvestmentCommand {
  type: 'deposit' | 'withdraw' | 'transfer' | 'status' | 'help';
  amount?: string;
  target?: string;
  description?: string;
  sender: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// AGENT STATE TYPES
// =============================================================================

export interface AgentState {
  isInitialized: boolean;
  isListening: boolean;
  connectionHealth: 'healthy' | 'degraded' | 'disconnected';
  lastActivity: Date | null;
  messagesProcessed: number;
  commandsExecuted: number;
  errors: AgentError[];
}

export interface AgentError {
  id: string;
  timestamp: Date;
  type: 'initialization' | 'messaging' | 'contract' | 'parsing' | 'network';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>;
  resolved: boolean;
}

export interface AgentMetrics {
  uptime: number; // seconds
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageResponseTime: number; // milliseconds
  lastCommandTime: Date | null;
}

// =============================================================================
// COMMAND EXECUTION TYPES
// =============================================================================

export interface CommandExecutionContext {
  groupId: string;
  sender: Address;
  command: InvestmentCommand;
  timestamp: Date;
  messageId?: string;
}

export interface CommandExecutionResult {
  success: boolean;
  transactionHash?: string;
  message: string;
  error?: string;
  executionTime: number; // milliseconds
  gasUsed?: bigint;
}

export interface ProposalCreationParams {
  type: ProposalType;
  amount: bigint;
  target: Address;
  data: `0x${string}`;
  description: string;
}

// =============================================================================
// AGENT UTILITY FUNCTIONS
// =============================================================================

/**
 * Validates and parses amount from user input
 */
export function parseAmount(input: string): ParsedAmount {
  const cleaned = input.trim().replace(/[$,]/g, '');
  
  if (!cleaned) {
    return { value: '', isValid: false, error: 'Amount is required' };
  }
  
  const amount = parseFloat(cleaned);
  
  if (isNaN(amount)) {
    return { value: cleaned, isValid: false, error: 'Invalid number format' };
  }
  
  if (amount <= 0) {
    return { value: cleaned, isValid: false, error: 'Amount must be positive' };
  }
  
  if (amount > 1_000_000) {
    return { value: cleaned, isValid: false, error: 'Amount exceeds maximum limit' };
  }
  
  return { value: amount.toString(), isValid: true };
}

/**
 * Validates and parses Ethereum address
 */
export function parseAddress(input: string): ParsedAddress {
  const cleaned = input.trim();
  
  if (!cleaned) {
    return { value: null, isValid: false, error: 'Address is required' };
  }
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(cleaned)) {
    return { value: null, isValid: false, error: 'Invalid Ethereum address format' };
  }
  
  return { value: cleaned as Address, isValid: true };
}

/**
 * Enhanced command parsing with confidence scoring
 */
export function parseCommandWithConfidence(
  content: string, 
  sender: string
): CommandParsingResult {
  const text = content.toLowerCase().trim();
  const result: CommandParsingResult = {
    command: null,
    confidence: 0,
    errors: []
  };
  
  // Help commands - high confidence
  if (text.includes('help') || text.includes('commands')) {
    result.command = { type: 'help', sender };
    result.confidence = 95;
    return result;
  }
  
  // Status commands - high confidence
  if (text.includes('status') || text.includes('balance') || text.includes('portfolio')) {
    result.command = { type: 'status', sender };
    result.confidence = 90;
    return result;
  }
  
  // Investment commands - variable confidence based on clarity
  const depositKeywords = ['deposit', 'invest', 'supply', 'stake'];
  const withdrawKeywords = ['withdraw', 'exit', 'redeem', 'unstake'];
  const transferKeywords = ['transfer', 'send', 'move'];
  
  let commandType: 'deposit' | 'withdraw' | 'transfer' | null = null;
  let baseConfidence = 0;
  
  if (depositKeywords.some(keyword => text.includes(keyword))) {
    commandType = 'deposit';
    baseConfidence = 70;
  } else if (withdrawKeywords.some(keyword => text.includes(keyword))) {
    commandType = 'withdraw';
    baseConfidence = 70;
  } else if (transferKeywords.some(keyword => text.includes(keyword))) {
    commandType = 'transfer';
    baseConfidence = 60;
  }
  
  if (commandType) {
    const amountResult = extractAmountFromText(text);
    const description = extractDescriptionFromText(text, sender);
    
    if (amountResult.isValid) {
      result.command = {
        type: commandType,
        amount: amountResult.value,
        description,
        sender,
        confidence: baseConfidence + 20 // Boost confidence when amount is clear
      };
      result.confidence = Math.min(95, baseConfidence + 20);
      
      // Additional validation for transfer commands
      if (commandType === 'transfer') {
        const addressResult = extractAddressFromText(text);
        if (addressResult.isValid) {
          result.command.target = addressResult.value!;
          result.confidence = Math.min(95, result.confidence + 10);
        } else {
          result.errors.push('Transfer command requires a valid target address');
          result.confidence = Math.max(30, result.confidence - 20);
        }
      }
    } else {
      result.errors.push(amountResult.error || 'Could not parse amount from message');
      result.confidence = Math.max(20, baseConfidence - 30);
    }
  }
  
  return result;
}

/**
 * Extract amount from text with validation
 */
function extractAmountFromText(text: string): ParsedAmount {
  const patterns = [
    /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g,
    /(\d+(?:\.\d{1,2})?)\s*(?:usdc|usd|dollars?)/gi,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = match[0].replace(/[$,]/g, '').replace(/[^\d.]/g, '');
      return parseAmount(amount);
    }
  }

  return { value: '', isValid: false, error: 'No amount found in message' };
}

/**
 * Extract address from text with validation
 */
function extractAddressFromText(text: string): ParsedAddress {
  const match = text.match(/0x[a-fA-F0-9]{40}/);
  if (match) {
    return parseAddress(match[0]);
  }
  return { value: null, isValid: false, error: 'No valid address found in message' };
}

/**
 * Extract description from text
 */
function extractDescriptionFromText(text: string, sender: string): string {
  const patterns = [
    /(?:for|because|reason:?)\s+(.+)/i,
    /"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Generate default description based on command type
  if (text.includes('deposit') || text.includes('invest')) {
    return `Deposit requested by ${sender}`;
  } else if (text.includes('withdraw')) {
    return `Withdrawal requested by ${sender}`;
  } else if (text.includes('transfer')) {
    return `Transfer requested by ${sender}`;
  }

  return `Request from ${sender}`;
}

// =============================================================================
// ERROR HANDLING UTILITIES
// =============================================================================

export class AgentErrorHandler {
  private errors: AgentError[] = [];
  private maxErrors = 100;

  addError(
    type: AgentError['type'],
    message: string,
    severity: AgentError['severity'] = 'medium',
    context?: Record<string, unknown>
  ): void {
    const error: AgentError = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      message,
      severity,
      context,
      resolved: false
    };

    this.errors.unshift(error);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Log based on severity
    switch (severity) {
      case 'critical':
        console.error(`🚨 [AGENT CRITICAL] ${message}`, context);
        break;
      case 'high':
        console.error(`❌ [AGENT ERROR] ${message}`, context);
        break;
      case 'medium':
        console.warn(`⚠️ [AGENT WARNING] ${message}`, context);
        break;
      case 'low':
        console.info(`ℹ️ [AGENT INFO] ${message}`, context);
        break;
    }
  }

  resolveError(errorId: string): void {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
    }
  }

  getRecentErrors(count = 10): AgentError[] {
    return this.errors.slice(0, count);
  }

  getUnresolvedErrors(): AgentError[] {
    return this.errors.filter(e => !e.resolved);
  }

  getCriticalErrors(): AgentError[] {
    return this.errors.filter(e => e.severity === 'critical' && !e.resolved);
  }

  clearResolvedErrors(): void {
    this.errors = this.errors.filter(e => !e.resolved);
  }
}

// =============================================================================
// METRICS TRACKING
// =============================================================================

export class AgentMetricsTracker {
  private startTime = Date.now();
  private commandCount = 0;
  private successCount = 0;
  private failureCount = 0;
  private responseTimes: number[] = [];
  private lastCommandTime: Date | null = null;

  recordCommand(success: boolean, responseTime: number): void {
    this.commandCount++;
    this.lastCommandTime = new Date();
    
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
    
    this.responseTimes.push(responseTime);
    
    // Keep only recent response times for average calculation
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
  }

  getMetrics(): AgentMetrics {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const averageResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
      : 0;

    return {
      uptime,
      totalCommands: this.commandCount,
      successfulCommands: this.successCount,
      failedCommands: this.failureCount,
      averageResponseTime,
      lastCommandTime: this.lastCommandTime
    };
  }

  reset(): void {
    this.startTime = Date.now();
    this.commandCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.responseTimes = [];
    this.lastCommandTime = null;
  }
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

export interface AgentConfigValidation {
  privateKey?: string;
  treasuryAddress?: string;
  chainId?: number;
  rpcUrl?: string;
}

export function validateAgentConfig(config: AgentConfigValidation): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.privateKey || typeof config.privateKey !== 'string') {
    errors.push('privateKey is required and must be a string');
  } else if (!/^0x[a-fA-F0-9]{64}$/.test(config.privateKey)) {
    errors.push('privateKey must be a valid 64-character hex string starting with 0x');
  }

  if (!config.treasuryAddress || typeof config.treasuryAddress !== 'string') {
    errors.push('treasuryAddress is required and must be a string');
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(config.treasuryAddress)) {
    errors.push('treasuryAddress must be a valid Ethereum address');
  }

  if (config.chainId && typeof config.chainId !== 'number') {
    errors.push('chainId must be a number');
  } else if (config.chainId && ![8453, 84532].includes(config.chainId)) {
    errors.push('chainId must be 8453 (Base Mainnet) or 84532 (Base Sepolia)');
  }

  if (config.rpcUrl && typeof config.rpcUrl !== 'string') {
    errors.push('rpcUrl must be a string');
  } else if (config.rpcUrl && !config.rpcUrl.startsWith('http')) {
    errors.push('rpcUrl must be a valid HTTP/HTTPS URL');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateProposalParams(params: ProposalCreationParams): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Object.values(ProposalType).includes(params.type)) {
    errors.push('Invalid proposal type');
  }

  if (params.amount <= 0n) {
    errors.push('Amount must be greater than zero');
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(params.target)) {
    errors.push('Target must be a valid Ethereum address');
  }

  if (!params.description || params.description.trim().length === 0) {
    errors.push('Description is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}


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
    lastActivity: Date | null;
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