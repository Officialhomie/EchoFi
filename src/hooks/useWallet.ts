import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
}

export interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
  refreshBalance: () => Promise<void>;
  isConnecting: boolean;
  error: string | null;
  clearError: () => void;
}

// Enhanced MetaMask detection
const detectWallet = () => {
  if (typeof window === 'undefined') return null;
  
  // Check for MetaMask specifically
  if (window.ethereum?.isMetaMask) {
    console.log('✅ MetaMask detected');
    return window.ethereum;
  }
  
  // Check for other Web3 wallets
  if (window.ethereum) {
    console.log('✅ Web3 wallet detected (non-MetaMask)');
    return window.ethereum;
  }
  
  console.warn('❌ No Web3 wallet detected');
  return null;
};

// Chain configuration for Base and Base Sepolia
const getChainData = (chainId: number) => {
  const chains: Record<number, any> = {
    8453: { // Base Mainnet
      chainId: '0x2105',
      chainName: 'Base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://mainnet.base.org'],
      blockExplorerUrls: ['https://basescan.org'],
    },
    84532: { // Base Sepolia
      chainId: '0x14a34',
      chainName: 'Base Sepolia',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://sepolia.base.org'],
      blockExplorerUrls: ['https://sepolia-explorer.base.org'],
    }
  };
  return chains[chainId];
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
      selectedAddress?: string;
    };
  }
}

export function useWallet(): UseWalletReturn {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    balance: null,
    provider: null,
    signer: null,
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Enhanced connection check with proper error handling
  const checkConnection = useCallback(async () => {
    const ethereum = detectWallet();
    if (!ethereum) return;

    try {
      console.log('🔍 Checking existing wallet connection...');
      
      // Check if already connected
      const accounts = await ethereum.request({ method: 'eth_accounts' }) as string[];
      
      if (accounts.length > 0) {
        console.log('✅ Wallet already connected:', accounts[0]);
        
        const provider = new BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();
        const balance = await provider.getBalance(address);

        setWalletState({
          isConnected: true,
          address,
          chainId: Number(network.chainId),
          balance: balance.toString(),
          provider,
          signer,
        });
        
        clearError();
        console.log('✅ Wallet state restored successfully');
      } else {
        console.log('ℹ️ No connected accounts found');
      }
    } catch (err) {
      console.error('❌ Error checking wallet connection:', err);
      setError(err instanceof Error ? err.message : 'Unknown connection error');
    }
  }, [clearError]);

  // Enhanced event listeners with better error handling
  const setupEventListeners = useCallback(() => {
    const ethereum = detectWallet();
    if (!ethereum) return () => {};

    console.log('🔧 Setting up wallet event listeners...');

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('📡 Accounts changed:', accounts);
      if (accounts.length === 0) {
        console.log('🔌 Wallet disconnected');
        disconnect();
      } else {
        console.log('🔄 Account switched, refreshing connection...');
        checkConnection();
      }
    };

    const handleChainChanged = (chainId: string) => {
      console.log('🔗 Chain changed to:', chainId);
      checkConnection();
    };

    const handleDisconnect = () => {
      console.log('🔌 Wallet disconnected');
      disconnect();
    };

    try {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
      ethereum.on('disconnect', handleDisconnect);

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener('accountsChanged', handleAccountsChanged);
          ethereum.removeListener('chainChanged', handleChainChanged);
          ethereum.removeListener('disconnect', handleDisconnect);
        }
      };
    } catch (err) {
      console.error('❌ Error setting up event listeners:', err);
      return () => {};
    }
  }, [checkConnection]);

  // Enhanced connection function
  const connect = useCallback(async () => {
    if (isConnecting) {
      console.log('⏳ Connection already in progress...');
      return;
    }
    
    setIsConnecting(true);
    clearError();
    
    try {
      console.log('🚀 Initiating wallet connection...');
      
      const ethereum = detectWallet();
      if (!ethereum) {
        throw new Error('No Web3 wallet found. Please install MetaMask or another compatible wallet.');
      }

      console.log('📞 Requesting account access...');
      
      // Request account access with proper error handling
      const accounts = await ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }

      console.log('✅ Account access granted:', accounts[0]);
      
      // Create provider and signer
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const balance = await provider.getBalance(address);

      const newState = {
        isConnected: true,
        address,
        chainId: Number(network.chainId),
        balance: balance.toString(),
        provider,
        signer,
      };

      setWalletState(newState);

      console.log('✅ Wallet connected successfully:', {
        address,
        chainId: Number(network.chainId),
        networkName: network.name,
      });

      // Check if on correct network (Base or Base Sepolia)
      const supportedChains = [8453, 84532]; // Base mainnet and sepolia
      if (!supportedChains.includes(Number(network.chainId))) {
        console.warn('⚠️ Connected to unsupported network:', network.chainId);
        setError(`Please switch to Base or Base Sepolia network. Currently on chain ${network.chainId}`);
      }

    } catch (err: any) {
      console.error('❌ Wallet connection failed:', err);
      
      let errorMessage = 'Failed to connect wallet';
      
      if (err.code === 4001) {
        errorMessage = 'Connection rejected by user';
      } else if (err.code === -32002) {
        errorMessage = 'Connection request already pending';
      } else if (err.message?.includes('User rejected')) {
        errorMessage = 'Connection cancelled by user';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, clearError]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting wallet...');
    setWalletState({
      isConnected: false,
      address: null,
      chainId: null,
      balance: null,
      provider: null,
      signer: null,
    });
    clearError();
    console.log('✅ Wallet disconnected successfully');
  }, [clearError]);

  const switchChain = useCallback(async (targetChainId: number) => {
    const ethereum = detectWallet();
    if (!ethereum) {
      throw new Error('No wallet found');
    }

    try {
      console.log(`🔗 Switching to chain ${targetChainId}...`);
      
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
      
      console.log('✅ Chain switched successfully');
    } catch (err: any) {
      console.error('❌ Chain switch failed:', err);
      
      // If the chain hasn't been added to the wallet
      if (err.code === 4902) {
        const chainData = getChainData(targetChainId);
        if (chainData) {
          console.log('➕ Adding new chain to wallet...');
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [chainData],
          });
          console.log('✅ Chain added successfully');
        } else {
          throw new Error(`Unsupported chain ID: ${targetChainId}`);
        }
      } else {
        throw err;
      }
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (walletState.provider && walletState.address) {
      try {
        console.log('🔄 Refreshing balance...');
        const balance = await walletState.provider.getBalance(walletState.address);
        setWalletState(prev => ({
          ...prev,
          balance: balance.toString(),
        }));
        console.log('✅ Balance refreshed');
      } catch (err) {
        console.error('❌ Failed to refresh balance:', err);
        setError('Failed to refresh balance');
      }
    }
  }, [walletState.provider, walletState.address]);

  // Initialize wallet check and event listeners
  useEffect(() => {
    console.log('🏁 Initializing wallet hook...');
    checkConnection();
    const cleanup = setupEventListeners();
    return cleanup;
  }, [checkConnection, setupEventListeners]);

  return {
    ...walletState,
    connect,
    disconnect,
    switchChain,
    refreshBalance,
    isConnecting,
    error,
    clearError,
  };
}