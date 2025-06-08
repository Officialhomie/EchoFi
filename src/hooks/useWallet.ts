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
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (accounts: string[]) => void) => void;
      removeListener: (event: string, callback: (accounts: string[]) => void) => void;
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

  const checkConnection = useCallback(async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
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
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  }, []);

  const setupEventListeners = useCallback(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      // Account change handler
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          checkConnection();
        }
      };

      // Chain change handler
      const handleChainChanged = () => {
        checkConnection();
      };

      // Disconnect handler
      const handleDisconnect = () => {
        disconnect();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);

      // Cleanup function
      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
          window.ethereum.removeListener('disconnect', handleDisconnect);
        }
      };
    }
    return () => {};
  }, [checkConnection]);

  // Check if wallet is already connected on mount
  useEffect(() => {
    checkConnection();
    const cleanup = setupEventListeners();
    return cleanup;
  }, [checkConnection, setupEventListeners]);

  const connect = useCallback(async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet found. Please install MetaMask or another Web3 wallet.');
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Create provider and signer
      const provider = new BrowserProvider(window.ethereum);
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

      console.log('Wallet connected successfully:', {
        address,
        chainId: Number(network.chainId),
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting]);

  const disconnect = useCallback(() => {
    setWalletState({
      isConnected: false,
      address: null,
      chainId: null,
      balance: null,
      provider: null,
      signer: null,
    });
    console.log('Wallet disconnected');
  }, []);

  const switchChain = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) {
      throw new Error('No wallet found');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (error: unknown) {
      // If the chain hasn't been added to the wallet
      if (error && typeof error === 'object' && 'code' in error && error.code === 4902) {
        // Add the chain (you may want to customize this based on your supported chains)
        const chainData = getChainData(targetChainId);
        if (chainData) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [chainData],
          });
        } else {
          throw new Error(`Unsupported chain ID: ${targetChainId}`);
        }
      } else {
        throw error;
      }
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (walletState.provider && walletState.address) {
      try {
        const balance = await walletState.provider.getBalance(walletState.address);
        setWalletState(prev => ({
          ...prev,
          balance: balance.toString(),
        }));
      } catch (error) {
        console.error('Failed to refresh balance:', error);
      }
    }
  }, [walletState.provider, walletState.address]);

  return {
    ...walletState,
    connect,
    disconnect,
    switchChain,
    refreshBalance,
  };
}

// Helper function to get chain data for adding new chains
function getChainData(chainId: number) {
  const chainConfigs: Record<number, {
    chainId: string;
    chainName: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    rpcUrls: string[];
    blockExplorerUrls: string[];
  }> = {
    8453: { // Base Mainnet
      chainId: '0x2105',
      chainName: 'Base',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['https://mainnet.base.org'],
      blockExplorerUrls: ['https://basescan.org'],
    },
    84532: { // Base Sepolia
      chainId: '0x14a34',
      chainName: 'Base Sepolia',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['https://sepolia.base.org'],
      blockExplorerUrls: ['https://sepolia-explorer.base.org'],
    },
  };

  return chainConfigs[chainId];
}