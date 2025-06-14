// src/lib/config/index.ts - Centralized configuration management
export interface AppConfiguration {
    // Environment
    nodeEnv: 'development' | 'staging' | 'production';
    isDevelopment: boolean;
    isProduction: boolean;
    
    // API Endpoints
    api: {
      baseUrl: string;
      timeout: number;
      retries: number;
    };
    
    // XMTP Configuration
    xmtp: {
      env: 'dev' | 'production';
      dbPath: string;
      maxRetries: number;
      retryDelay: number;
      healthCheckInterval: number;
      maxMessageLength: number;
      pollingInterval: number;
    };
    
    // AgentKit Configuration
    agent: {
      model: string;
      temperature: number;
      maxTokens: number;
      maxExecutionTime: number;
      gasLimitMultiplier: number;
      slippageTolerance: number;
      networkId: string;
    };
    
    // UI Configuration
    ui: {
      theme: 'light' | 'dark' | 'auto';
      animations: boolean;
      debounceDelay: number;
      animationDuration: number;
      autoScrollThreshold: number;
      maxFileSize: number;
      paginationSize: number;
    };
    
    // Application Limits
    limits: {
      maxGroupMembers: number;
      maxProposalsPerGroup: number;
      maxVotingDuration: number;
      minProposalAmount: string;
      maxProposalAmount: string;
      maxChatHistorySize: number;
      maxErrorRetries: number;
    };
    
    // Feature Flags
    features: {
      enableAnalytics: boolean;
      enableNotifications: boolean;
      enableAutoExecution: boolean;
      enableAdvancedStrategies: boolean;
      enableBetaFeatures: boolean;
      enablePerformanceTracking: boolean;
      enableErrorReporting: boolean;
    };
    
    // Security Configuration
    security: {
      sessionTimeout: number;
      maxLoginAttempts: number;
      encryptionEnabled: boolean;
      rateLimits: {
        api: number;
        websocket: number;
        xmtp: number;
      };
    };
    
    // Logging Configuration
    logging: {
      level: 'debug' | 'info' | 'warn' | 'error';
      enableConsole: boolean;
      enableRemote: boolean;
      remoteEndpoint?: string;
      maxLogEntries: number;
    };
  }
  
  /**
   * Configuration manager with environment-based defaults
   */
  class ConfigurationManager {
    private static instance: ConfigurationManager;
    private config: AppConfiguration;
    private overrides: Partial<AppConfiguration> = {};
  
    private constructor() {
      this.config = this.loadConfiguration();
    }
  
    static getInstance(): ConfigurationManager {
      if (!ConfigurationManager.instance) {
        ConfigurationManager.instance = new ConfigurationManager();
      }
      return ConfigurationManager.instance;
    }
  
    /**
     * Get the current configuration
     */
    getConfig(): AppConfiguration {
      return { ...this.config, ...this.overrides };
    }
  
    /**
     * Get a specific configuration value by path
     */
    get<T>(path: string): T {
      const config = this.getConfig();
      return this.getByPath(config, path) as T;
    }
  
    /**
     * Set configuration overrides (useful for testing)
     */
    setOverride(path: string, value: any): void {
      this.setByPath(this.overrides, path, value);
    }
  
    /**
     * Clear all overrides
     */
    clearOverrides(): void {
      this.overrides = {};
    }
  
    /**
     * Reload configuration from environment
     */
    reload(): void {
      this.config = this.loadConfiguration();
    }
  
    /**
     * Load configuration based on environment variables
     */
    private loadConfiguration(): AppConfiguration {
      const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production';
      const isDevelopment = nodeEnv === 'development';
      const isProduction = nodeEnv === 'production';
  
      return {
        // Environment
        nodeEnv,
        isDevelopment,
        isProduction,
  
        // API Configuration
        api: {
          baseUrl: process.env.NEXT_PUBLIC_API_URL || (isDevelopment ? 'http://localhost:3000' : ''),
          timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000'),
          retries: parseInt(process.env.NEXT_PUBLIC_API_RETRIES || '3'),
        },
  
        // XMTP Configuration
        xmtp: {
          env: (process.env.NEXT_PUBLIC_XMTP_ENV as 'dev' | 'production') || (isProduction ? 'production' : 'dev'),
          dbPath: process.env.NEXT_PUBLIC_XMTP_DB_PATH || 'echofi-xmtp-db',
          maxRetries: parseInt(process.env.NEXT_PUBLIC_XMTP_MAX_RETRIES || '3'),
          retryDelay: parseInt(process.env.NEXT_PUBLIC_XMTP_RETRY_DELAY || '1000'),
          healthCheckInterval: parseInt(process.env.NEXT_PUBLIC_XMTP_HEALTH_CHECK_INTERVAL || '30000'),
          maxMessageLength: parseInt(process.env.NEXT_PUBLIC_XMTP_MAX_MESSAGE_LENGTH || '1000'),
          pollingInterval: parseInt(process.env.NEXT_PUBLIC_XMTP_POLLING_INTERVAL || '5000'),
        },
  
        // AgentKit Configuration
        agent: {
          model: process.env.NEXT_PUBLIC_AGENT_MODEL || 'gpt-4',
          temperature: parseFloat(process.env.NEXT_PUBLIC_AGENT_TEMPERATURE || '0.7'),
          maxTokens: parseInt(process.env.NEXT_PUBLIC_AGENT_MAX_TOKENS || '2000'),
          maxExecutionTime: parseInt(process.env.NEXT_PUBLIC_AGENT_MAX_EXECUTION_TIME || '30000'),
          gasLimitMultiplier: parseFloat(process.env.NEXT_PUBLIC_AGENT_GAS_LIMIT_MULTIPLIER || '1.2'),
          slippageTolerance: parseFloat(process.env.NEXT_PUBLIC_AGENT_SLIPPAGE_TOLERANCE || '0.01'),
          networkId: process.env.NEXT_PUBLIC_NETWORK_ID || (isProduction ? 'base-mainnet' : 'base-sepolia'),
        },
  
        // UI Configuration
        ui: {
          theme: (process.env.NEXT_PUBLIC_UI_THEME as 'light' | 'dark' | 'auto') || 'auto',
          animations: process.env.NEXT_PUBLIC_UI_ANIMATIONS !== 'false',
          debounceDelay: parseInt(process.env.NEXT_PUBLIC_UI_DEBOUNCE_DELAY || '300'),
          animationDuration: parseInt(process.env.NEXT_PUBLIC_UI_ANIMATION_DURATION || '200'),
          autoScrollThreshold: parseInt(process.env.NEXT_PUBLIC_UI_AUTO_SCROLL_THRESHOLD || '100'),
          maxFileSize: parseInt(process.env.NEXT_PUBLIC_UI_MAX_FILE_SIZE || '10485760'), // 10MB
          paginationSize: parseInt(process.env.NEXT_PUBLIC_UI_PAGINATION_SIZE || '20'),
        },
  
        // Application Limits
        limits: {
          maxGroupMembers: parseInt(process.env.NEXT_PUBLIC_MAX_GROUP_MEMBERS || '50'),
          maxProposalsPerGroup: parseInt(process.env.NEXT_PUBLIC_MAX_PROPOSALS_PER_GROUP || '100'),
          maxVotingDuration: parseInt(process.env.NEXT_PUBLIC_MAX_VOTING_DURATION || '168'), // 1 week
          minProposalAmount: process.env.NEXT_PUBLIC_MIN_PROPOSAL_AMOUNT || '0.01',
          maxProposalAmount: process.env.NEXT_PUBLIC_MAX_PROPOSAL_AMOUNT || '1000',
          maxChatHistorySize: parseInt(process.env.NEXT_PUBLIC_MAX_CHAT_HISTORY_SIZE || '500'),
          maxErrorRetries: parseInt(process.env.NEXT_PUBLIC_MAX_ERROR_RETRIES || '3'),
        },
  
        // Feature Flags
        features: {
          enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
          enableNotifications: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS !== 'false',
          enableAutoExecution: process.env.NEXT_PUBLIC_ENABLE_AUTO_EXECUTION === 'true',
          enableAdvancedStrategies: process.env.NEXT_PUBLIC_ENABLE_ADVANCED_STRATEGIES === 'true',
          enableBetaFeatures: process.env.NEXT_PUBLIC_ENABLE_BETA_FEATURES === 'true' && isDevelopment,
          enablePerformanceTracking: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_TRACKING !== 'false',
          enableErrorReporting: process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING !== 'false' && isProduction,
        },
  
        // Security Configuration
        security: {
          sessionTimeout: parseInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT || '3600000'), // 1 hour
          maxLoginAttempts: parseInt(process.env.NEXT_PUBLIC_MAX_LOGIN_ATTEMPTS || '5'),
          encryptionEnabled: process.env.NEXT_PUBLIC_ENCRYPTION_ENABLED !== 'false',
          rateLimits: {
            api: parseInt(process.env.NEXT_PUBLIC_RATE_LIMIT_API || '100'),
            websocket: parseInt(process.env.NEXT_PUBLIC_RATE_LIMIT_WEBSOCKET || '50'),
            xmtp: parseInt(process.env.NEXT_PUBLIC_RATE_LIMIT_XMTP || '30'),
          },
        },
  
        // Logging Configuration
        logging: {
          level: (process.env.NEXT_PUBLIC_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 
                 (isDevelopment ? 'debug' : 'info'),
          enableConsole: process.env.NEXT_PUBLIC_LOG_CONSOLE !== 'false',
          enableRemote: process.env.NEXT_PUBLIC_LOG_REMOTE === 'true' && isProduction,
          remoteEndpoint: process.env.NEXT_PUBLIC_LOG_ENDPOINT,
          maxLogEntries: parseInt(process.env.NEXT_PUBLIC_MAX_LOG_ENTRIES || '1000'),
        },
      };
    }
  
    /**
     * Get value from object by dot notation path
     */
    private getByPath(obj: any, path: string): any {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    }
  
    /**
     * Set value in object by dot notation path
     */
    private setByPath(obj: any, path: string, value: any): void {
      const keys = path.split('.');
      const lastKey = keys.pop()!;
      const target = keys.reduce((current, key) => {
        if (current[key] === undefined) {
          current[key] = {};
        }
        return current[key];
      }, obj);
      target[lastKey] = value;
    }
  }
  
  // Export singleton instance and convenient access functions
  export const configManager = ConfigurationManager.getInstance();
  export const CONFIG = configManager.getConfig();
  
  /**
   * Get configuration value by path
   */
  export function getConfig<T = any>(path: string): T {
    return configManager.get<T>(path);
  }
  
  /**
   * Legacy exports for backwards compatibility
   */
  export const API_ENDPOINTS = {
    BASE_URL: CONFIG.api.baseUrl,
    TIMEOUT: CONFIG.api.timeout,
  };
  
  export const UI_CONFIG = {
    THEME: CONFIG.ui.theme,
    ANIMATIONS: CONFIG.ui.animations,
    DEBOUNCE_DELAY: CONFIG.ui.debounceDelay,
    ANIMATION_DURATION: CONFIG.ui.animationDuration,
    PAGINATION_SIZE: CONFIG.ui.paginationSize,
  };
  
  export const VALIDATION_RULES = {
    PROPOSAL_DESCRIPTION: {
      MIN_LENGTH: 10,
      MAX_LENGTH: CONFIG.xmtp.maxMessageLength,
    },
    GROUP_NAME: {
      MIN_LENGTH: 3,
      MAX_LENGTH: 50,
    },
    MEMBER_ADDRESS: {
      PATTERN: /^0x[a-fA-F0-9]{40}$/,
    },
  };
  
  export const APP_LIMITS = {
    MAX_GROUP_MEMBERS: CONFIG.limits.maxGroupMembers,
    MAX_PROPOSALS_PER_GROUP: CONFIG.limits.maxProposalsPerGroup,
    MAX_VOTING_DURATION: CONFIG.limits.maxVotingDuration,
    MIN_PROPOSAL_AMOUNT: CONFIG.limits.minProposalAmount,
    MAX_PROPOSAL_AMOUNT: CONFIG.limits.maxProposalAmount,
  };