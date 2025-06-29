// src/lib/agentkit/CommandSchemas.ts
import { z } from 'zod';

// =============================================================================
// CORE COMMAND SCHEMAS
// =============================================================================

/**
 * Base schema for all investment commands
 * Ensures consistent structure across all command types
 */
export const BaseCommandSchema = z.object({
  type: z.enum(['deposit', 'withdraw', 'transfer', 'status', 'help', 'portfolio', 'strategy']),
  sender: z.string().min(1, "Sender address is required"),
  confidence: z.number().min(0).max(100).default(0),
  timestamp: z.number().default(() => Date.now()),
  conversationContext: z.object({
    groupId: z.string(),
    recentMessages: z.array(z.string()).optional(),
    memberCount: z.number().optional(),
    treasuryBalance: z.string().optional()
  }).optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Amount validation with multiple formats
 * Supports: "1000", "$1,000", "1.5K", "50%", "half", "all"
 */
export const AmountSchema = z.object({
  raw: z.string(),
  normalized: z.string(),
  type: z.enum(['absolute', 'percentage', 'relative']),
  value: z.number().positive("Amount must be positive"),
  currency: z.enum(['USD', 'ETH', 'USDC', 'PERCENTAGE']).default('USD'),
  isValid: z.boolean(),
  validationError: z.string().optional()
});

/**
 * DeFi protocol and strategy schemas
 */
export const ProtocolSchema = z.object({
  name: z.string(),
  protocol: z.enum(['aave', 'compound', 'uniswap', 'curve', 'convex', 'yearn', 'lido']),
  action: z.enum(['lend', 'borrow', 'stake', 'swap', 'farm', 'pool']),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  expectedAPY: z.number().optional(),
  timeframe: z.string().optional()
});

/**
 * Risk assessment schema
 */
export const RiskParametersSchema = z.object({
  maxRiskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  diversificationRequired: z.boolean().default(true),
  maxSingleProtocolExposure: z.number().min(0).max(100).default(50),
  requiresApproval: z.boolean(),
  emergencyExit: z.boolean().default(false)
});

// =============================================================================
// SPECIFIC COMMAND SCHEMAS
// =============================================================================

/**
 * Deposit/Investment Command Schema
 * Handles: "invest 1000 in aave", "deposit 30% into high yield protocols"
 */
export const DepositCommandSchema = BaseCommandSchema.extend({
  type: z.literal('deposit'),
  amount: AmountSchema,
  target: ProtocolSchema.optional(),
  strategy: z.object({
    type: z.enum(['conservative', 'balanced', 'aggressive', 'custom']).default('balanced'),
    diversification: z.boolean().default(true),
    protocols: z.array(ProtocolSchema).optional(),
    timeframe: z.enum(['short', 'medium', 'long']).default('medium'),
    autoRebalance: z.boolean().default(false)
  }).optional(),
  riskParameters: RiskParametersSchema,
  description: z.string().max(500)
});

/**
 * Withdrawal Command Schema
 * Handles: "withdraw 500", "exit our aave position", "withdraw all if yield < 3%"
 */
export const WithdrawCommandSchema = BaseCommandSchema.extend({
  type: z.literal('withdraw'),
  amount: AmountSchema,
  source: z.object({
    protocol: z.string().optional(),
    specific: z.boolean().default(false),
    conditions: z.array(z.object({
      type: z.enum(['yield_threshold', 'time_based', 'price_target']),
      value: z.string(),
      operator: z.enum(['>', '<', '>=', '<=', '=='])
    })).optional()
  }).optional(),
  urgency: z.enum(['immediate', 'standard', 'when_optimal']).default('standard'),
  description: z.string().max(500)
});

/**
 * Transfer Command Schema
 * Handles: "send 100 to 0x123...", "transfer funds to Sarah's wallet"
 */
export const TransferCommandSchema = BaseCommandSchema.extend({
  type: z.literal('transfer'),
  amount: AmountSchema,
  recipient: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
    name: z.string().optional(),
    verified: z.boolean().default(false)
  }),
  purpose: z.string().max(200).optional(),
  requiresApproval: z.boolean(),
  description: z.string().max(500)
});

/**
 * Portfolio/Status Command Schema
 * Handles: "show portfolio", "what's our balance?", "how are we performing?"
 */
export const StatusCommandSchema = BaseCommandSchema.extend({
  type: z.literal('status'),
  scope: z.enum(['full', 'balance', 'performance', 'positions', 'yields']).default('full'),
  timeframe: z.enum(['24h', '7d', '30d', '90d', 'all']).default('7d'),
  includeProjections: z.boolean().default(true),
  format: z.enum(['summary', 'detailed', 'chart']).default('summary')
});

/**
 * Strategy Command Schema
 * Handles: "rebalance portfolio", "optimize our yields", "implement dollar cost averaging"
 */
export const StrategyCommandSchema = BaseCommandSchema.extend({
  type: z.literal('strategy'),
  strategyType: z.enum([
    'rebalance', 
    'optimize_yield', 
    'dollar_cost_average', 
    'take_profit', 
    'stop_loss',
    'diversify'
  ]),
  parameters: z.object({
    targetAllocation: z.record(z.number()).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    threshold: z.number().optional(),
    conditions: z.array(z.string()).optional()
  }).optional(),
  autoExecute: z.boolean().default(false),
  riskParameters: RiskParametersSchema
});

/**
 * Help Command Schema
 * Handles: "help", "what can you do?", "show commands"
 */
export const HelpCommandSchema = BaseCommandSchema.extend({
  type: z.literal('help'),
  topic: z.enum(['commands', 'protocols', 'strategies', 'governance', 'general']).optional(),
  context: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate')
});

// =============================================================================
// COMMAND UNION AND VALIDATION
// =============================================================================

/**
 * Union of all possible command schemas
 */
export const InvestmentCommandSchema = z.discriminatedUnion('type', [
  DepositCommandSchema,
  WithdrawCommandSchema,
  TransferCommandSchema,
  StatusCommandSchema,
  StrategyCommandSchema,
  HelpCommandSchema
]);

/**
 * Type inference from schemas
 */
export type InvestmentCommand = z.infer<typeof InvestmentCommandSchema>;
export type DepositCommand = z.infer<typeof DepositCommandSchema>;
export type WithdrawCommand = z.infer<typeof WithdrawCommandSchema>;
export type TransferCommand = z.infer<typeof TransferCommandSchema>;
export type StatusCommand = z.infer<typeof StatusCommandSchema>;
export type StrategyCommand = z.infer<typeof StrategyCommandSchema>;
export type HelpCommand = z.infer<typeof HelpCommandSchema>;
export type Amount = z.infer<typeof AmountSchema>;
export type Protocol = z.infer<typeof ProtocolSchema>;
export type RiskParameters = z.infer<typeof RiskParametersSchema>;

// =============================================================================
// PARSING UTILITIES
// =============================================================================

/**
 * Parse and normalize amount from natural language
 */
export function parseAmount(input: string, contextBalance?: string): Amount {
  const cleanInput = input.toLowerCase().trim().replace(/[$,]/g, '');
  
  // Parse context balance if provided
  let availableBalance = 0;
  let balanceCurrency: 'USD' | 'ETH' | 'USDC' | 'PERCENTAGE' = 'USD';
  
  if (contextBalance) {
    const balanceMatch = contextBalance.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
    if (balanceMatch) {
      availableBalance = parseFloat(balanceMatch[1]);
      if (balanceMatch[2]) {
        const currency = balanceMatch[2].toUpperCase();
        // Map common currency strings to our enum values
        if (['USD', 'USDT', 'USDC'].includes(currency)) {
          balanceCurrency = 'USD';
        } else if (['ETH', 'ETHER'].includes(currency)) {
          balanceCurrency = 'ETH';
        } else if (currency === 'USDC') {
          balanceCurrency = 'USDC';
        }
        // Default to USD for unknown currencies
      }
    }
  }
  
  // Handle percentage values
  if (cleanInput.includes('%') || cleanInput.includes('percent')) {
    const percentMatch = cleanInput.match(/(\d+(?:\.\d+)?)/);
    if (percentMatch) {
      const percent = parseFloat(percentMatch[1]);
      if (percent >= 0 && percent <= 100) {
        // Calculate actual value if context balance is available
        const actualValue = availableBalance > 0 ? (availableBalance * percent) / 100 : percent;
        
        return {
          raw: input,
          normalized: `${percent}%`,
          type: 'percentage',
          value: percent,
          currency: 'PERCENTAGE',
          isValid: true,
          // Add metadata about actual value if context balance was used
          ...(availableBalance > 0 && {
            metadata: {
              actualValue,
              availableBalance,
              balanceCurrency
            }
          })
        };
      }
    }
  }
  
  // Handle relative amounts
  const relativeMap: Record<string, number> = {
    'all': 100,
    'everything': 100,
    'half': 50,
    'quarter': 25,
    'third': 33.33,
    'most': 75,
    'some': 25,
    'little': 10
  };
  
  for (const [key, value] of Object.entries(relativeMap)) {
    if (cleanInput.includes(key)) {
      // Calculate actual value if context balance is available
      const actualValue = availableBalance > 0 ? (availableBalance * value) / 100 : value;
      
      return {
        raw: input,
        normalized: `${value}%`,
        type: 'relative',
        value: value,
        currency: 'PERCENTAGE',
        isValid: true,
        // Add metadata about actual value if context balance was used
        ...(availableBalance > 0 && {
          metadata: {
            actualValue,
            availableBalance,
            balanceCurrency
          }
        })
      };
    }
  }
  
  // Handle K/M notation (1K = 1000, 1M = 1000000)
  let multiplier = 1;
  let numberPart = cleanInput;
  
  if (cleanInput.includes('k')) {
    multiplier = 1000;
    numberPart = cleanInput.replace('k', '');
  } else if (cleanInput.includes('m')) {
    multiplier = 1000000;
    numberPart = cleanInput.replace('m', '');
  }
  
  // Parse the numeric value
  const numericMatch = numberPart.match(/(\d+(?:\.\d+)?)/);
  if (numericMatch) {
    const value = parseFloat(numericMatch[1]) * multiplier;
    if (value > 0) {
      // Validate against available balance if provided
      const isValid = availableBalance === 0 || value <= availableBalance;
      const validationError = !isValid 
        ? `Requested amount (${value}) exceeds available balance (${availableBalance})`
        : undefined;
      
      return {
        raw: input,
        normalized: value.toString(),
        type: 'absolute',
        value: value,
        currency: balanceCurrency,
        isValid,
        ...(validationError && { validationError }),
        ...(availableBalance > 0 && {
          metadata: {
            availableBalance,
            balanceCurrency,
            remainingBalance: availableBalance - value
          }
        })
      };
    }
  }
  
  // Invalid amount
  return {
    raw: input,
    normalized: '',
    type: 'absolute',
    value: 0,
    currency: balanceCurrency,
    isValid: false,
    validationError: `Cannot parse amount: "${input}"`,
    ...(availableBalance > 0 && {
      metadata: {
        availableBalance,
        balanceCurrency
      }
    })
  };
}

/**
 * Validate command against schema with detailed error reporting
 */
export function validateCommand(command: unknown): {
  isValid: boolean;
  command?: InvestmentCommand;
  errors: string[];
} {
  try {
    const validated = InvestmentCommandSchema.parse(command);
    return {
      isValid: true,
      command: validated,
      errors: []
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return {
      isValid: false,
      errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Extract protocol information from text
 */
export function extractProtocol(text: string): Protocol | null {
  const protocolMap: Record<string, Protocol> = {
    'aave': { name: 'Aave', protocol: 'aave', action: 'lend', riskLevel: 'low' },
    'compound': { name: 'Compound', protocol: 'compound', action: 'lend', riskLevel: 'low' },
    'uniswap': { name: 'Uniswap', protocol: 'uniswap', action: 'pool', riskLevel: 'medium' },
    'curve': { name: 'Curve', protocol: 'curve', action: 'pool', riskLevel: 'medium' },
    'yearn': { name: 'Yearn', protocol: 'yearn', action: 'farm', riskLevel: 'medium' },
    'lido': { name: 'Lido', protocol: 'lido', action: 'stake', riskLevel: 'low' }
  };
  
  const lowerText = text.toLowerCase();
  for (const [key, protocol] of Object.entries(protocolMap)) {
    if (lowerText.includes(key)) {
      return protocol;
    }
  }
  
  return null;
}