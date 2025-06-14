import { NetworkConfig } from ".";

// src/types/config.ts - Configuration and settings types
export interface AppConfig {
    networks: NetworkConfig[];
    defaultNetwork: number;
    supportedWallets: string[];
    features: FeatureFlags;
    limits: AppLimits;
}
  
export interface FeatureFlags {
    enableAnalytics: boolean;
    enableNotifications: boolean;
    enableAutoExecution: boolean;
    enableAdvancedStrategies: boolean;
    enableBetaFeatures: boolean;
}
  
export interface AppLimits {
    maxGroupMembers: number;
    maxProposalsPerGroup: number;
    maxVotingDuration: number;
    minProposalAmount: string;
    maxProposalAmount: string;
}
  
export interface EnvironmentConfig {
    nodeEnv: 'development' | 'staging' | 'production';
    apiUrl: string;
    websocketUrl: string;
    xmtpEnv: 'dev' | 'production';
    chainId: number;
    rpcUrl: string;
    analyticsEnabled: boolean;
    debugMode: boolean;
}
  
export interface SecurityConfig {
    encryptionEnabled: boolean;
    sessionTimeout: number;
    maxRetries: number;
    rateLimits: {
      api: number;
      websocket: number;
      xmtp: number;
    };
}
  
export interface UIConfig {
    theme: 'light' | 'dark' | 'auto';
    animations: boolean;
    notifications: boolean;
    defaultPageSize: number;
    maxFileSize: number;
}