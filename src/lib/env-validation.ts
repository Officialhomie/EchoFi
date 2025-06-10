import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('Invalid database URL'),
  
  // Coinbase Developer Platform (AgentKit)
  CDP_API_KEY_NAME: z.string().min(1, 'CDP API key name is required'),
  CDP_API_KEY_PRIVATE_KEY: z.string().min(1, 'CDP API private key is required'),
  CDP_WALLET_SECRET: z.string().optional(),
  
  // OpenAI (for AgentKit)
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required for AI agent functionality'),
  
  // Network Configuration
  NETWORK_ID: z.enum(['base-mainnet', 'base-sepolia', 'ethereum-mainnet', 'ethereum-sepolia']).default('base-sepolia'),
  
  // XMTP Configuration
  NEXT_PUBLIC_XMTP_ENV: z.enum(['production', 'dev']).default('dev'),
  NEXT_PUBLIC_XMTP_ENCRYPTION_KEY: z.string().optional(),
  
  // App Configuration
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Optional: External integrations
  NEXT_PUBLIC_ALCHEMY_API_KEY: z.string().optional(),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.enum(['true', 'false']).default('true'),
  NEXT_PUBLIC_ENABLE_AUTO_EXECUTION: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_ENABLE_ADVANCED: z.enum(['true', 'false']).default('false'),
});

export type Env = z.infer<typeof envSchema>;

class EnvironmentValidationError extends Error {
  constructor(
    message: string,
    public details: z.ZodError
  ) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

let validatedEnv: Env | null = null;

export function validateEnvironment(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .filter(err => err.code === 'invalid_type' && err.received === 'undefined')
        .map(err => err.path.join('.'));
      
      const invalidVars = error.errors
        .filter(err => err.code !== 'invalid_type' || err.received !== 'undefined')
        .map(err => `${err.path.join('.')}: ${err.message}`);

      let errorMessage = 'Environment validation failed:\n';
      
      if (missingVars.length > 0) {
        errorMessage += `\nMissing required variables:\n${missingVars.map(v => `  - ${v}`).join('\n')}`;
      }
      
      if (invalidVars.length > 0) {
        errorMessage += `\nInvalid variables:\n${invalidVars.map(v => `  - ${v}`).join('\n')}`;
      }

      errorMessage += '\n\nPlease check your .env file or environment variables.';
      
      throw new EnvironmentValidationError(errorMessage, error);
    }
    throw error;
  }
}

// Utility functions for specific environment checks
export function isDevelopment(): boolean {
  const env = validateEnvironment();
  return env.NODE_ENV === 'development';
}

export function isProduction(): boolean {
  const env = validateEnvironment();
  return env.NODE_ENV === 'production';
}

export function isTestnet(): boolean {
  const env = validateEnvironment();
  return env.NETWORK_ID.includes('sepolia');
}

export function getNetworkConfig() {
  const env = validateEnvironment();
  
  const networks = {
    'base-mainnet': {
      chainId: 8453,
      name: 'Base',
      rpcUrl: 'https://mainnet.base.org',
      blockExplorer: 'https://basescan.org',
    },
    'base-sepolia': {
      chainId: 84532,
      name: 'Base Sepolia',
      rpcUrl: 'https://sepolia.base.org',
      blockExplorer: 'https://sepolia-explorer.base.org',
    },
    'ethereum-mainnet': {
      chainId: 1,
      name: 'Ethereum',
      rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${env.NEXT_PUBLIC_ALCHEMY_API_KEY || ''}`,
      blockExplorer: 'https://etherscan.io',
    },
    'ethereum-sepolia': {
      chainId: 11155111,
      name: 'Ethereum Sepolia',
      rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${env.NEXT_PUBLIC_ALCHEMY_API_KEY || ''}`,
      blockExplorer: 'https://sepolia.etherscan.io',
    },
  };

  return networks[env.NETWORK_ID];
}

// Validate environment on module load in server environments
if (typeof window === 'undefined') {
  try {
    validateEnvironment();
    console.log('✅ Environment validation passed');
  } catch (error) {
    if (error instanceof EnvironmentValidationError) {
      console.error('❌ Environment validation failed:');
      console.error(error.message);
      
      // In development, show helpful setup instructions
      if (process.env.NODE_ENV === 'development') {
        console.log('\n🛠️  Setup Instructions:');
        console.log('1. Copy .env.example to .env.local');
        console.log('2. Fill in the required environment variables');
        console.log('3. Restart the development server');
        console.log('\nFor CDP API keys, visit: https://portal.cdp.coinbase.com/');
        console.log('For OpenAI API key, visit: https://platform.openai.com/api-keys');
      }
      
      // Don't exit in development to allow for easier debugging
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    } else {
      throw error;
    }
  }
}