import { ReactNode } from 'react';
import { WalletState } from './wallet';
import { XMTPClientState } from './messaging';
import { AgentState } from './agent';

// App State Types
export interface AppState {
  isReady: boolean;
  initializationProgress: number;
  currentStep: string;
  error: string | null;
  retryCount: number;
}

export interface AppContextType extends AppState {
  retryInitialization: () => Promise<void>;
  resetXMTPDatabase: () => Promise<void>;
  clearError: () => void;
}

// Initialization Status Types
export interface InitializationStatus {
  isReady: boolean;
  progress: number;
  currentStep: string;
  walletReady: boolean;
  xmtpReady: boolean;
  agentReady: boolean;
}

// Provider Props Types
export interface AppProvidersProps {
  children: ReactNode;
}

// Error Boundary Types
export interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Global State Types
export interface GlobalState {
  lastLoggedProgress?: number;
}

// Provider Hook Return Types
export interface UseAppReturn extends AppContextType {
  wallet: WalletState;
  xmtp: XMTPClientState;
  agent: AgentState;
}

// Initialization Check Types
export interface InitializationCheckResult {
  shouldUpdate: boolean;
  newState: Partial<AppState>;
}

// Error Collection Types
export interface ErrorCollection {
  errors: string[];
  currentError: string | null;
  errorChanged: boolean;
} 