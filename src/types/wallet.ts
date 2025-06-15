import { Signer } from '@xmtp/browser-sdk';

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  address?: string;
  signer?: Signer;
  chainId?: number;
  balance?: string;
}

export interface WalletConfig {
  autoConnect?: boolean;
  requiredChainId?: number;
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export interface WalletConnectionOptions {
  chainId?: number;
  timeout?: number;
  retryCount?: number;
}

export interface WalletTransactionOptions {
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

export interface WalletSignatureOptions {
  message: string;
  timeout?: number;
}

export interface WalletBalance {
  address: string;
  balance: string;
  symbol: string;
  decimals: number;
  formatted: string;
}

export interface WalletNetwork {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
} 