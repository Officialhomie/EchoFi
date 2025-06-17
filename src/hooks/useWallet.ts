import { useState, useEffect, useCallback, useRef } from 'react';
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

// Enhanced MetaMask detection with proper typing
const detectWallet = () => {
  if (typeof window === 'undefined') return null;
  
  if (window.ethereum?.isMetaMask) {
    console.log('✅ MetaMask detected');
    return window.ethereum;
  }
  
  if (window.ethereum) {
    console.log('✅ Web3 wallet detected (non-MetaMask)');
    return window.ethereum;
  }
  
  console.warn('❌ No Web3 wallet detected');
  return null;
};

interface ChainConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

// Base Sepolia is the default chain instead of Ethereum mainnet
const getChainData = (chainId: number): ChainConfig | undefined => {
  const chains: Record<number, ChainConfig> = {
    8453: { // Base Mainnet
      chainId: '0x2105',
      chainName: 'Base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://mainnet.base.org'],
      blockExplorerUrls: ['https://basescan.org'],
    },
    84532: { // Base Sepolia - DEFAULT TESTNET
      chainId: '0x14a34',
      chainName: 'Base Sepolia',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://sepolia.base.org'],
      blockExplorerUrls: ['https://sepolia-explorer.base.org'],
    }
  };
  return chains[chainId];
};

// Proper Ethereum provider interface with complete typing
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on(event: 'accountsChanged', callback: (accounts: string[]) => void): void;
  on(event: 'chainChanged', callback: (chainId: string) => void): void;
  on(event: 'disconnect', callback: () => void): void;
  removeListener(event: 'accountsChanged', callback: (accounts: string[]) => void): void;
  removeListener(event: 'chainChanged', callback: (chainId: string) => void): void;
  removeListener(event: 'disconnect', callback: () => void): void;
  isMetaMask?: boolean;
  selectedAddress?: string;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// FIXED: Enhanced signer interface without circular references
interface EnhancedSignerMethods {
  getChainId: () => number;
  originalGetAddress: () => Promise<string>;
  originalSignMessage: (message: string) => Promise<string>;
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
  
  // Refs to track connection state and prevent duplicate operations
  const lastConnectedAddress = useRef<string | null>(null);
  const lastConnectedChainId = useRef<number | null>(null);
  const connectionInProgress = useRef(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

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
    lastConnectedAddress.current = null;
    lastConnectedChainId.current = null;
    clearError();
    console.log('✅ Wallet disconnected successfully');
  }, [clearError]);

  // FIXED: Enhanced connection check WITHOUT circular references
  const checkConnection = useCallback(async () => {
    const ethereum = detectWallet();
    if (!ethereum) return;

    try {
      console.log('🔍 Checking existing wallet connection...');
      
      const accounts = await ethereum.request({ method: 'eth_accounts' }) as string[];
      
      if (accounts.length > 0) {
        console.log('✅ Wallet already connected:', accounts[0]);
        
        const provider = new BrowserProvider(ethereum);
        const originalSigner = await provider.getSigner();
        const address = await originalSigner.getAddress();
        const network = await provider.getNetwork();
        const balance = await provider.getBalance(address);

        const chainId = Number(network.chainId);

        // FIXED: Create enhanced signer WITHOUT circular references
        // Store original methods separately to avoid recursion
        const enhancedMethods: EnhancedSignerMethods = {
          getChainId: () => chainId,
          originalGetAddress: () => originalSigner.getAddress(),
          originalSignMessage: (message: string) => originalSigner.signMessage(message),
        };

        // Create a proxy signer that extends the original but adds our methods
        const enhancedSigner = Object.create(originalSigner);
        enhancedSigner.getChainId = enhancedMethods.getChainId;
        // Keep the original async methods intact
        enhancedSigner.getAddress = enhancedMethods.originalGetAddress;
        enhancedSigner.signMessage = enhancedMethods.originalSignMessage;

        setWalletState({
          isConnected: true,
          address,
          chainId,
          balance: balance.toString(),
          provider,
          signer: enhancedSigner,
        });

        lastConnectedAddress.current = address;
        lastConnectedChainId.current = chainId;
        
        clearError();
        
        // Validate we're on a supported chain (Base or Base Sepolia)
        const supportedChains = [8453, 84532];
        if (!supportedChains.includes(chainId)) {
          console.warn('⚠️ Connected to unsupported network:', chainId);
          setError(`Please switch to Base Sepolia (testnet) or Base Mainnet. Currently on chain ${chainId}`);
        } else {
          console.log('✅ Connected to supported network:', chainId === 8453 ? 'Base Mainnet' : 'Base Sepolia');
        }
        
        console.log('✅ Wallet state restored successfully');
      } else {
        console.log('ℹ️ No connected accounts found');
      }
    } catch (err) {
      console.error('❌ Error checking wallet connection:', err);
      setError(err instanceof Error ? err.message : 'Unknown connection error');
    }
  }, [clearError]);

  // Enhanced event listeners with better error handling and deduplication
  const setupEventListeners = useCallback(() => {
    const ethereum = detectWallet();
    if (!ethereum) return () => {};

    console.log('🔧 Setting up wallet event listeners...');

    const handleAccountsChanged = (accounts: unknown) => {
      if (Array.isArray(accounts) && accounts.every(acc => typeof acc === 'string')) {
        console.log('📡 Accounts changed:', accounts);
        if (accounts.length === 0) {
          console.log('🔌 Wallet disconnected');
          disconnect();
        } else if (accounts[0] !== lastConnectedAddress.current) {
          console.log('🔄 Account switched, refreshing connection...');
          checkConnection();
        }
      }
    };

    const handleChainChanged = (chainId: unknown) => {
      if (typeof chainId === 'string') {
        const newChainId = parseInt(chainId, 16);
        console.log('🔗 Chain changed to:', newChainId);
        
        if (newChainId !== lastConnectedChainId.current) {
          lastConnectedChainId.current = newChainId;
          checkConnection();
        }
      }
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
  }, [checkConnection, disconnect]);

  // FIXED: Enhanced connection function with Base Sepolia as default
  const connect = useCallback(async () => {
    if (isConnecting || connectionInProgress.current) {
      console.log('⏳ Connection already in progress...');
      return;
    }
    
    connectionInProgress.current = true;
    setIsConnecting(true);
    clearError();
    
    try {
      console.log('🚀 Initiating wallet connection...');
      
      const ethereum = detectWallet();
      if (!ethereum) {
        throw new Error('No Web3 wallet found. Please install MetaMask or another compatible wallet.');
      }

      console.log('📞 Requesting account access...');
      
      const accounts = await ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }

      console.log('✅ Account access granted:', accounts[0]);
      
      const provider = new BrowserProvider(ethereum);
      const originalSigner = await provider.getSigner();
      const address = await originalSigner.getAddress();
      const network = await provider.getNetwork();
      const balance = await provider.getBalance(address);

      const chainId = Number(network.chainId);

      // FIXED: Create enhanced signer WITHOUT circular references
      const enhancedMethods: EnhancedSignerMethods = {
        getChainId: () => chainId,
        originalGetAddress: () => originalSigner.getAddress(),
        originalSignMessage: (message: string) => originalSigner.signMessage(message),
      };

      // Create a proxy signer that extends the original but adds our methods
      const enhancedSigner = Object.create(originalSigner);
      enhancedSigner.getChainId = enhancedMethods.getChainId;
      // Keep the original async methods intact to prevent recursion
      enhancedSigner.getAddress = enhancedMethods.originalGetAddress;
      enhancedSigner.signMessage = enhancedMethods.originalSignMessage;

      const newState = {
        isConnected: true,
        address,
        chainId,
        balance: balance.toString(),
        provider,
        signer: enhancedSigner,
      };

      setWalletState(newState);
      lastConnectedAddress.current = address;
      lastConnectedChainId.current = chainId;

      console.log('✅ Wallet connected successfully:', {
        address,
        chainId,
        networkName: network.name,
      });

      // Check if on supported network and suggest Base Sepolia for testnet
      const supportedChains = [8453, 84532]; // Base mainnet and sepolia
      if (!supportedChains.includes(chainId)) {
        console.warn('⚠️ Connected to unsupported network:', chainId);
        
        // Automatically suggest switching to Base Sepolia for development
        const isMainnet = process.env.NODE_ENV === 'production';
        const targetChain = isMainnet ? 8453 : 84532;
        const targetChainName = isMainnet ? 'Base Mainnet' : 'Base Sepolia';
        
        setError(`Please switch to ${targetChainName} network. Currently on chain ${chainId}. Attempting to switch automatically...`);
        
        try {
          await switchChain(targetChain);
        } catch (switchError) {
          console.error('❌ Failed to auto-switch chain:', switchError);
          setError(`Please manually switch to ${targetChainName} network in your wallet.`);
        }
      } else {
        console.log('✅ Connected to supported network:', 
          chainId === 8453 ? 'Base Mainnet' : 'Base Sepolia');
      }

    } catch (err: unknown) {
      console.error('❌ Wallet connection failed:', err);
      
      let errorMessage = 'Failed to connect wallet';
      
      if (err && typeof err === 'object' && 'code' in err) {
        const error = err as { code: number; message?: string };
        if (error.code === 4001) {
          errorMessage = 'Connection rejected by user';
        } else if (error.code === -32002) {
          errorMessage = 'Connection request already pending';
        } else if (error.message?.includes('User rejected')) {
          errorMessage = 'Connection cancelled by user';
        } else if (error.message) {
          errorMessage = error.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsConnecting(false);
      connectionInProgress.current = false;
    }
  }, [isConnecting, clearError]);

  // Enhanced chain switching with proper error handling
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
      
      // Update our tracking
      lastConnectedChainId.current = targetChainId;
      
    } catch (error: unknown) {
      console.error('❌ Chain switch failed:', error);
      
      if (error && typeof error === 'object' && 'code' in error) {
        const switchError = error as { code: number; message?: string };
        
        if (switchError.code === 4902) {
          // Chain not added to wallet, try to add it
          const chainData = getChainData(targetChainId);
          if (chainData) {
            try {
              await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [chainData],
              });
              console.log('✅ Chain added and switched successfully');
            } catch (addError) {
              console.error('❌ Failed to add chain:', addError);
              throw new Error(`Failed to add chain ${targetChainId} to wallet`);
            }
          } else {
            throw new Error(`Unsupported chain ID: ${targetChainId}`);
          }
        } else if (switchError.code === 4001) {
          throw new Error('User rejected chain switch request');
        } else {
          throw new Error(switchError.message || `Failed to switch to chain ${targetChainId}`);
        }
      } else {
        throw error;
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

  // Initialize wallet check and event listeners with proper dependency management
  useEffect(() => {
    console.log('🏁 Initializing wallet hook...');
    checkConnection();
    const cleanup = setupEventListeners();
    return cleanup;
  }, [checkConnection, setupEventListeners]);

  // Auto-switch to Base Sepolia on first connection if not on supported network
  useEffect(() => {
    if (walletState.isConnected && walletState.chainId) {
      const supportedChains = [8453, 84532]; // Base Mainnet, Base Sepolia
      
      if (!supportedChains.includes(walletState.chainId)) {
        console.warn(`⚠️ Connected to unsupported chain: ${walletState.chainId}`);
        
        // Auto-switch to a supported chain
        const targetChain = process.env.NODE_ENV === 'production' ? 
          8453 : 84532;
        
        setTimeout(async () => {
          try {
            await switchChain(targetChain);
          } catch (switchError) {
            console.warn('Failed to auto-switch to supported chain:', switchError);
          }
        }, 2000); // Give user time to see the connection first
      }
    }
  }, [walletState.isConnected, walletState.chainId, switchChain]);

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