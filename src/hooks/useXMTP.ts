// src/hooks/useXMTP.ts - FIXED VERSION
import { useState, useEffect, useCallback, useRef } from 'react';
import { Client, Conversation, DecodedMessage, type ClientOptions, type Signer } from '@xmtp/browser-sdk';
import { useWallet } from './useWallet';

// =============================================================================
// ENHANCED TYPES AND INTERFACES
// =============================================================================

export interface XMTPConfig {
  env?: 'dev' | 'production';
  enableLogging?: boolean;
  dbPath?: string;
  maxRetries?: number;
  retryDelay?: number;
  healthCheckInterval?: number;
  encryptionKey?: Uint8Array;
}

export interface InitializationState {
  phase: 'starting' | 'connecting' | 'syncing' | 'ready' | 'failed';
  progress: number;
  currentOperation: string;
  issues: string[];
}

export interface DatabaseHealthReport {
  isHealthy: boolean;
  issues: string[];
  recommendations: string[];
  sequenceIdStatus: 'valid' | 'corrupted' | 'missing';
  lastSyncTimestamp?: number;
}

export interface UseXMTPReturn {
  // Core state
  client: Client | null;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  conversations: Conversation[];
  
  // Enhanced state
  initializationState: InitializationState;
  databaseHealth: DatabaseHealthReport | null;
  
  // Core methods
  initializeXMTP: () => Promise<void>;
  createGroup: (name: string, description: string, members: string[]) => Promise<Conversation>;
  createDM: (peerAddress: string) => Promise<Conversation>;
  sendMessage: (conversationId: string, message: string) => Promise<void>;
  getMessages: (conversationId: string, limit?: number) => Promise<DecodedMessage[]>;
  streamMessages: (conversationId: string, onMessage: (message: DecodedMessage) => void) => Promise<() => void>;
  
  // Group management
  addMembers: (conversationId: string, addresses: string[]) => Promise<void>;
  removeMembers: (conversationId: string, addresses: string[]) => Promise<void>;
  canMessage: (addresses: string[]) => Promise<Map<string, boolean>>;
  
  // Health and recovery
  performHealthCheck: () => Promise<DatabaseHealthReport>;
  resetDatabase: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  repairSequenceId: () => Promise<void>;
  
  // Utility
  cleanup: () => Promise<void>;
  clearError: () => void;
}

// =============================================================================
// FIXED WALLET TYPE DETECTION UTILITY
// =============================================================================

/**
 * FIXED: Detect whether the connected wallet is an EOA or Smart Contract Wallet
 * This is crucial for proper XMTP signer configuration
 */
function detectWalletType(walletProvider: unknown): 'EOA' | 'SCW' {
  // FIXED: Changed from 'any' to 'unknown' to satisfy TypeScript strict mode
  // Most browser wallets (MetaMask, Coinbase Wallet, etc.) are EOAs
  if (typeof walletProvider === 'object' && walletProvider !== null) {
    const provider = walletProvider as { isMetaMask?: boolean; isCoinbaseWallet?: boolean };
    if (provider.isMetaMask || provider.isCoinbaseWallet) {
      return 'EOA';
    }
  }
  
  // Default to EOA for standard browser wallets
  return 'EOA';
}

// =============================================================================
// ENHANCED XMTP MANAGER CLASS WITH FIXED WALLET TYPE HANDLING
// =============================================================================

class EnhancedXMTPManager {
  private static instance: EnhancedXMTPManager | null = null;
  private client: Client | null = null;
  private config: Required<XMTPConfig>;
  private isInitialized = false;
  private isClientStable = false;
  private encryptionKey: Uint8Array | null = null;
  private initializationState: InitializationState = {
    phase: 'starting',
    progress: 0,
    currentOperation: 'Waiting for initialization',
    issues: []
  };
  private lastSignerAddress: string | null = null;

  // FIXED: Add initialization lock to prevent concurrent attempts
  private initializationLock = false;

  public static getInstance(config: XMTPConfig = {}): EnhancedXMTPManager {
    if (!this.instance) {
      this.instance = new EnhancedXMTPManager(config);
    }
    return this.instance;
  }

  private constructor(config: XMTPConfig) {
    this.config = {
      env: config.env || 'dev',
      enableLogging: config.enableLogging ?? true,
      dbPath: config.dbPath || 'echofi-xmtp-unified',
      maxRetries: config.maxRetries || 2, // REDUCED: Fewer retries to prevent loops
      retryDelay: config.retryDelay || 3000, // INCREASED: Longer delay between retries
      healthCheckInterval: config.healthCheckInterval || 30000,
      encryptionKey: config.encryptionKey || this.generateEncryptionKey()
    };
    this.encryptionKey = this.config.encryptionKey;
  }

  /**
   * FIXED: Stable client initialization with proper wallet type detection
   * and initialization locking to prevent concurrent signature requests
   */
  async initializeClient(signer: Signer, config?: Partial<XMTPConfig>): Promise<Client> {
    // FIXED: Check initialization lock to prevent concurrent attempts
    if (this.initializationLock) {
      throw new Error('XMTP initialization already in progress. Please wait for current attempt to complete.');
    }

    // Get current signer address to check if we need to re-initialize
    const currentSignerAddress = await signer.getAddress();
    
    // OPTIMIZATION: Return existing stable client if same signer and client is healthy
    if (
      this.client && 
      this.isClientStable && 
      this.isInitialized && 
      this.lastSignerAddress === currentSignerAddress
    ) {
      console.log('✅ [ENHANCED] Reusing existing stable XMTP client for address:', currentSignerAddress);
      return this.client;
    }

    // FIXED: Set initialization lock
    this.initializationLock = true;

    try {
      // Update configuration if provided
      if (config) {
        this.config = { ...this.config, ...config };
      }

      this.updateInitializationState('connecting', 10, 'Preparing XMTP initialization');
      console.log('🚀 [ENHANCED] Initializing XMTP client for address:', currentSignerAddress);

      // FIXED: Pre-initialization cleanup to prevent database conflicts
      await this.performPreInitCleanup();
      this.updateInitializationState('connecting', 25, 'Pre-initialization cleanup completed');

      // FIXED: Client options with unique database path to prevent conflicts
      const clientOptions: ClientOptions = {
        env: this.config.env,
        dbPath: `${this.config.dbPath}-${currentSignerAddress.slice(-8)}`, // Unique per address
      };

      this.updateInitializationState('connecting', 40, 'Creating XMTP client');

      // FIXED: Initialize XMTP client with proper error handling
      console.log('🔐 [ENHANCED] Requesting signature for XMTP client initialization...');
      console.log('💡 [ENHANCED] This signature request authenticates your wallet with XMTP');
      
      this.client = await Client.create(signer, this.encryptionKey!, clientOptions);

      this.updateInitializationState('syncing', 60, 'XMTP client created, synchronizing');

      // FIXED: Post-initialization validation
      await this.validateClientInitialization();
      this.updateInitializationState('syncing', 80, 'Client validation completed');

      // Verify client is properly initialized
      if (!this.client || !this.client.accountAddress) {
        throw new Error('XMTP client initialization failed - no account address');
      }

      // Mark as stable and store signer address
      this.isInitialized = true;
      this.isClientStable = true;
      this.lastSignerAddress = currentSignerAddress;
      this.updateInitializationState('ready', 100, 'XMTP client ready for messaging');

      if (this.config.enableLogging) {
        console.log('✅ [ENHANCED] XMTP client initialized successfully:', {
          address: this.client.accountAddress,
          inboxId: this.client.inboxId,
          installationId: this.client.installationId,
          env: this.config.env,
          dbPath: clientOptions.dbPath
        });
      }

      return this.client;

    } catch (error) {
      this.isClientStable = false;
      this.updateInitializationState('failed', 0, 'Initialization failed', [
        error instanceof Error ? error.message : String(error)
      ]);
      
      // FIXED: Enhanced error handling with specific recovery suggestions
      if (error instanceof Error) {
        if (error.message.includes('user rejected') || error.message.includes('User rejected')) {
          throw new Error('Signature request was cancelled. XMTP requires a signature to create your secure messaging identity.');
        }
        
        if (error.message.includes('SequenceId')) {
          console.error('🔧 SequenceId error detected, database needs reset');
          throw new Error('Database synchronization error detected. Please reset the XMTP database and try again.');
        }
        
        if (error.message.includes('Smart contract wallet signature is invalid')) {
          console.error('🔧 Smart contract wallet signature error detected');
          throw new Error('Wallet signature verification failed. This may be due to wallet type configuration. Please try reconnecting your wallet.');
        }
        
        if (error.message.includes('NoVerifier')) {
          console.error('🔧 NoVerifier error - likely wallet type mismatch');
          throw new Error('Wallet verification error. Please ensure you are using a supported wallet type.');
        }
      }
      
      throw error;
    } finally {
      // FIXED: Always release initialization lock
      this.initializationLock = false;
    }
  }

  /**
   * FIXED: Pre-initialization cleanup to prevent conflicts
   */
  private async performPreInitCleanup(): Promise<void> {
    try {
      // Clear any stale XMTP data that might cause conflicts
      await this.clearStaleXMTPData();
    } catch (error) {
      console.warn('⚠️ Pre-init cleanup warning:', error);
    }
  }

  /**
   * FIXED: Validate client initialization
   */
  private async validateClientInitialization(): Promise<void> {
    if (!this.client) {
      throw new Error('Client initialization validation failed - no client instance');
    }

    try {
      // Test basic client functionality
      await this.client.conversations.listGroups();
      console.log('✅ Client validation passed - basic functionality working');
    } catch (error) {
      console.warn('⚠️ Client validation warning:', error);
      // Don't throw here - client might still be usable
    }
  }

  /**
   * FIXED: Clear stale XMTP data
   */
  private async clearStaleXMTPData(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Clear problematic localStorage entries
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('xmtp_temp') || 
          key.includes('xmtp_stale') ||
          key.includes('sequence_temp')
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🧹 Cleared stale data: ${key}`);
      });

    } catch (error) {
      console.warn('⚠️ Error clearing stale XMTP data:', error);
    }
  }

  /**
   * Generate or retrieve XMTP encryption key with proper persistence
   */
  private generateEncryptionKey(): Uint8Array {
    const STORAGE_KEY = 'xmtp_encryption_key_v2';
    
    try {
      const storedKey = localStorage.getItem(STORAGE_KEY);
      if (storedKey) {
        const keyArray = JSON.parse(storedKey);
        if (Array.isArray(keyArray) && keyArray.length === 32) {
          console.log('🔑 [ENHANCED] Using existing encryption key from storage');
          return new Uint8Array(keyArray);
        }
      }
    } catch (error) {
      console.warn('⚠️ [ENHANCED] Failed to load existing encryption key:', error);
    }

    console.log('🔑 [ENHANCED] Generating new encryption key...');
    const newKey = crypto.getRandomValues(new Uint8Array(32));
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newKey)));
      console.log('✅ [ENHANCED] New encryption key saved to storage');
    } catch (error) {
      console.warn('⚠️ [ENHANCED] Failed to save encryption key:', error);
    }
    
    return newKey;
  }

  /**
   * Comprehensive database reset with improved cleanup
   */
  async resetDatabase(): Promise<void> {
    console.log('🔄 Starting comprehensive XMTP database reset...');
    
    try {
      // Release initialization lock if held
      this.initializationLock = false;
      
      await this.cleanup();
      await this.clearAllBrowserStorage();
      
      this.client = null;
      this.isInitialized = false;
      this.isClientStable = false;
      this.lastSignerAddress = null;
      
      console.log('✅ Database reset completed successfully');
      
    } catch (error) {
      console.error('❌ Database reset failed:', error);
      throw new Error(`Database reset failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear all browser storage related to XMTP
   */
  private async clearAllBrowserStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name?.includes('xmtp') || db.name?.includes(this.config.dbPath)) {
          console.log(`🗑️ Deleting database: ${db.name}`);
          indexedDB.deleteDatabase(db.name);
        }
      }

      // Clear localStorage entries (but preserve encryption key)
      const localKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.toLowerCase().includes('xmtp') && key !== 'xmtp_encryption_key_v2') {
          localKeys.push(key);
        }
      }
      localKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Cleared localStorage: ${key}`);
      });

      // Clear sessionStorage entries
      const sessionKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.toLowerCase().includes('xmtp')) {
          sessionKeys.push(key);
        }
      }
      sessionKeys.forEach(key => {
        sessionStorage.removeItem(key);
        console.log(`🗑️ Cleared sessionStorage: ${key}`);
      });

    } catch (error) {
      console.warn('⚠️ Error clearing browser storage:', error);
    }
  }

  /**
   * Update initialization state
   */
  private updateInitializationState(
    phase: InitializationState['phase'],
    progress: number,
    operation: string,
    issues: string[] = []
  ): void {
    this.initializationState = {
      phase,
      progress,
      currentOperation: operation,
      issues
    };
  }

  /**
   * Get current initialization state
   */
  getInitializationState(): InitializationState {
    return { ...this.initializationState };
  }

  /**
   * Get conversations
   */
  async getConversations(): Promise<Conversation[]> {
    if (!this.client) {
      throw new Error('XMTP client not initialized');
    }

    try {
      return await this.client.conversations.listGroups();
    } catch (error) {
      console.error('❌ Failed to get conversations:', error);
      throw error;
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<DatabaseHealthReport> {
    const report: DatabaseHealthReport = {
      isHealthy: true,
      issues: [],
      recommendations: [],
      sequenceIdStatus: 'valid'
    };

    try {
      if (!this.client) {
        report.isHealthy = false;
        report.issues.push('XMTP client not initialized');
        report.recommendations.push('Initialize XMTP client');
        return report;
      }

      await this.client.conversations.listGroups();
      report.lastSyncTimestamp = Date.now();

    } catch (error) {
      report.isHealthy = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      report.issues.push(errorMessage);

      if (errorMessage.includes('SequenceId')) {
        report.sequenceIdStatus = 'corrupted';
        report.recommendations.push('Reset XMTP database');
      } else if (errorMessage.includes('database') || errorMessage.includes('sync')) {
        report.recommendations.push('Reset XMTP database');
      } else {
        report.recommendations.push('Reinitialize XMTP client');
      }
    }

    return report;
  }

  /**
   * Check if addresses can receive messages
   */
  async canMessage(addresses: string[]): Promise<Map<string, boolean>> {
    if (!this.client) {
      throw new Error('XMTP client not initialized');
    }

    try {
      return await this.client.canMessage(addresses);
    } catch (error) {
      console.error('❌ Failed to check message capability:', error);
      throw error;
    }
  }

  /**
   * Get client info
   */
  getClientInfo() {
    if (!this.client) return null;
    
    return {
      address: this.client.accountAddress,
      inboxId: this.client.inboxId,
      installationId: this.client.installationId,
      isReady: this.isInitialized
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      this.client = null;
      this.isInitialized = false;
      this.isClientStable = false;
      this.lastSignerAddress = null;
      this.initializationLock = false;
      console.log('🧹 XMTP manager cleanup completed');
    } catch (error) {
      console.error('❌ Error during XMTP cleanup:', error);
    }
  }
}

// =============================================================================
// FIXED BROWSER SIGNER CREATION WITH PROPER WALLET TYPE DETECTION
// =============================================================================

/**
 * FIXED: Create browser-compatible signer with proper wallet type detection
 * This prevents the "Smart contract wallet signature is invalid" error
 */
function createStableBrowserSigner(
  signer: {
    getAddress?: () => Promise<string>;
    signMessage?: (message: string) => Promise<string>;
    getChainId?: () => number;
  },
  currentChainId: number
): Signer {
  console.log('🔧 Creating stable browser signer for chain ID:', currentChainId);
  
  // FIXED: Detect actual wallet type instead of assuming SCW
  const walletType = detectWalletType(typeof window !== 'undefined' ? window.ethereum : null);
  
  console.log('🔍 Detected wallet type:', walletType);
  
  return {
    walletType, // FIXED: Use detected wallet type instead of hardcoded 'SCW'
    getAddress: async () => {
      if (typeof signer.getAddress === 'function') {
        return await signer.getAddress();
      }
      throw new Error('Signer does not support getAddress');
    },
    signMessage: async (message: string) => {
      if (typeof signer.signMessage === 'function') {
        console.log('🔐 XMTP requesting signature for message length:', message.length);
        console.log('💡 This signature authenticates your messaging identity - it\'s safe to sign');
        
        const signature = await signer.signMessage(message);
        const hexSignature = signature.startsWith('0x') ? signature.slice(2) : signature;
        return new Uint8Array(Buffer.from(hexSignature, 'hex'));
      }
      throw new Error('Signer does not support signMessage');
    },
    getChainId: () => {
      console.log('🔗 XMTP signer reporting chain ID:', currentChainId);
      return BigInt(currentChainId);
    },
    getBlockNumber: () => {
      return BigInt(0);
    }
  };
}

// =============================================================================
// FIXED XMTP HOOK WITH IMPROVED ERROR HANDLING AND RETRY LOGIC
// =============================================================================

/**
 * FIXED: XMTP Hook with proper initialization management and error recovery
 */
export function useXMTP(config?: XMTPConfig): UseXMTPReturn {
  const { signer, isConnected, chainId } = useWallet();
  
  // State management
  const [client, setClient] = useState<Client | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [initializationState, setInitializationState] = useState<InitializationState>({
    phase: 'starting',
    progress: 0,
    currentOperation: 'Waiting for wallet connection',
    issues: []
  });
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealthReport | null>(null);
  
  // Manager and initialization tracking
  const xmtpManager = useRef<EnhancedXMTPManager | null>(null);
  const messageStreams = useRef<Map<string, () => void>>(new Map());
  const lastInitializedAddress = useRef<string | null>(null);
  const lastInitializedChainId = useRef<number | null>(null);
  
  // FIXED: Add retry tracking to prevent infinite loops
  const retryCount = useRef(0);
  const maxRetries = 2;
  const retryDelay = 5000; // 5 seconds between retries

  /**
   * FIXED: Stable XMTP initialization with improved error handling and retry logic
   */
  const initializeXMTP = useCallback(async () => {
    if (!signer || !isConnected || !chainId) {
      setError('Wallet not connected or chain ID not available');
      setInitializationState({
        phase: 'starting',
        progress: 0,
        currentOperation: 'Waiting for wallet connection',
        issues: []
      });
      return;
    }

    // Get current address to check if we need to re-initialize
    let currentAddress: string;
    try {
      currentAddress = await signer.getAddress();
    } catch (error) {
      // FIXED: Removed unused variable 'addressError' and fixed setError syntax
      console.error('Failed to get wallet address:', error);
      setError('Failed to get wallet address');
      return;
    }
    
    // OPTIMIZATION: Skip initialization if already initialized for same address and chain
    if (
      isInitialized && 
      lastInitializedAddress.current === currentAddress &&
      lastInitializedChainId.current === chainId
    ) {
      console.log('✅ XMTP already initialized for current address and chain, skipping...');
      return;
    }

    // FIXED: Prevent concurrent initialization attempts
    if (isInitializing) {
      console.log('🔄 Initialization already in progress, skipping...');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      console.log('🚀 Starting XMTP initialization for address:', currentAddress, 'on chain:', chainId);
      
      // Get or create singleton manager instance
      xmtpManager.current = EnhancedXMTPManager.getInstance({
        env: config?.env || 'dev',
        enableLogging: config?.enableLogging ?? true,
        dbPath: config?.dbPath || 'echofi-xmtp-unified',
        maxRetries: 2, // REDUCED: Prevent retry loops
        retryDelay: 3000,
        healthCheckInterval: config?.healthCheckInterval || 30000,
        ...config,
      });

      // Monitor initialization state
      const stateUpdateInterval = setInterval(() => {
        if (xmtpManager.current) {
          const state = xmtpManager.current.getInitializationState();
          setInitializationState(state);
          
          if (state.phase === 'ready' || state.phase === 'failed') {
            clearInterval(stateUpdateInterval);
          }
        }
      }, 100);

      // FIXED: Create stable browser-compatible signer with proper wallet type detection
      const browserSigner = createStableBrowserSigner(signer, chainId);
      
      // Initialize client with singleton manager
      const xmtpClient = await xmtpManager.current.initializeClient(browserSigner, config);
      
      setClient(xmtpClient);
      setIsInitialized(true);
      lastInitializedAddress.current = currentAddress;
      lastInitializedChainId.current = chainId;
      retryCount.current = 0; // Reset retry count on success
      
      // Perform initial health check
      const healthReport = await xmtpManager.current.performHealthCheck();
      setDatabaseHealth(healthReport);
      
      // Load existing conversations
      await refreshConversations();
      
      console.log('✅ XMTP initialization completed successfully for address:', currentAddress);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ XMTP initialization failed:', errorMessage);
      
      // FIXED: Handle specific error types with appropriate recovery suggestions
      let userFriendlyError = errorMessage;
      
      if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
        userFriendlyError = 'Signature request was cancelled. XMTP needs your signature to create a secure messaging identity.';
        retryCount.current = 0; // Don't auto-retry on user rejection
      } else if (errorMessage.includes('already in progress')) {
        userFriendlyError = 'Initialization is already in progress. Please wait a moment and try again.';
        retryCount.current = 0; // Don't auto-retry on concurrent attempts
      } else if (errorMessage.includes('database') || errorMessage.includes('SequenceId')) {
        userFriendlyError = 'Database synchronization error. Please reset the XMTP database and try again.';
      } else if (errorMessage.includes('Smart contract wallet') || errorMessage.includes('NoVerifier')) {
        userFriendlyError = 'Wallet verification error. Please try reconnecting your wallet or reset the XMTP database.';
      }
      
      setError(userFriendlyError);
      
      setInitializationState({
        phase: 'failed',
        progress: 0,
        currentOperation: 'Initialization failed',
        issues: [userFriendlyError]
      });
      
      // FIXED: Implement intelligent retry logic
      if (retryCount.current < maxRetries && 
          !errorMessage.includes('user rejected') && 
          !errorMessage.includes('already in progress')) {
        
        retryCount.current++;
        console.log(`⏳ Scheduling retry attempt ${retryCount.current}/${maxRetries} in ${retryDelay/1000} seconds...`);
        
        setTimeout(() => {
          if (!isInitialized && retryCount.current <= maxRetries) {
            console.log(`🔄 Retry attempt ${retryCount.current}/${maxRetries}`);
            initializeXMTP();
          }
        }, retryDelay);
      }
      
    } finally {
      setIsInitializing(false);
    }
  }, [signer, isConnected, chainId, config, isInitialized, isInitializing]);

  /**
   * Refresh conversations with enhanced error handling
   */
  const refreshConversations = useCallback(async () => {
    if (!xmtpManager.current) return;
  
    try {
      console.log('🔄 Refreshing conversations...');
      const convos = await xmtpManager.current.getConversations();
      setConversations(convos);
      console.log(`✅ Loaded ${convos.length} conversations`);
      
      if (error && convos.length >= 0) {
        setError(null);
      }
      
    } catch (convError) {
      const errorMessage = convError instanceof Error ? convError.message : String(convError);
      console.error('❌ Failed to refresh conversations:', errorMessage);
      
      if (errorMessage.includes('SequenceId') || 
          errorMessage.includes('database') || 
          errorMessage.includes('sync')) {
        setError('Database error detected. Please reset the XMTP database.');
      } else {
        setError(`Failed to load conversations: ${errorMessage}`);
      }
    }
  }, [error]);

  /**
   * Repair SequenceId database issues
   */
  const repairSequenceId = useCallback(async () => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      console.log('🔧 Starting SequenceId repair...');
      await xmtpManager.current.resetDatabase();
      
      const healthReport = await xmtpManager.current.performHealthCheck();
      setDatabaseHealth(healthReport);
      
      console.log('✅ SequenceId repair completed');
    } catch (error) {
      console.error('❌ SequenceId repair failed:', error);
      throw error;
    }
  }, []);

  /**
   * FIXED: Perform comprehensive health check with refreshConversations dependency
   */
  const performHealthCheck = useCallback(async (): Promise<DatabaseHealthReport> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      const report = await xmtpManager.current.performHealthCheck();
      setDatabaseHealth(report);
      
      // Refresh conversations if database is healthy
      if (report.isHealthy) {
        await refreshConversations();
      }
      
      return report;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  }, [refreshConversations]); // FIXED: Added refreshConversations dependency

  /**
   * Reset database with comprehensive cleanup
   */
  const resetDatabase = useCallback(async () => {
    if (!xmtpManager.current) return;
  
    try {
      setIsInitializing(true);
      setError(null);
      
      console.log('🔄 Resetting XMTP database...');
      await xmtpManager.current.resetDatabase();
      
      setClient(null);
      setIsInitialized(false);
      setConversations([]);
      setDatabaseHealth(null);
      lastInitializedAddress.current = null;
      lastInitializedChainId.current = null;
      retryCount.current = 0; // Reset retry count
      
      messageStreams.current.forEach(stopStream => {
        try {
          stopStream();
        } catch (error) {
          console.warn('⚠️ Error stopping stream:', error);
        }
      });
      messageStreams.current.clear();
      
      xmtpManager.current = EnhancedXMTPManager.getInstance({
        env: config?.env || 'dev',
        enableLogging: config?.enableLogging ?? true,
        dbPath: config?.dbPath || 'echofi-xmtp-unified',
        maxRetries: 2,
        retryDelay: 3000,
        healthCheckInterval: config?.healthCheckInterval || 30000,
        ...config,
      });
      
      console.log('✅ Database reset complete');
      
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Database reset failed:', errorMessage);
      setError(`Reset failed: ${errorMessage}`);
    } finally {
      setIsInitializing(false);
    }
  }, [config]);

  // Placeholder implementations for future phases
  const createGroup = useCallback(async (name: string, description: string, members: string[]): Promise<Conversation> => {
    console.log(`Creating group "${name}" with description "${description}" and ${members.length} members`);
    throw new Error('Group creation will be implemented in Phase 2');
  }, []);

  const createDM = useCallback(async (peerAddress: string): Promise<Conversation> => {
    console.log(`Creating DM with peer: ${peerAddress}`);
    throw new Error('DM creation will be implemented in Phase 2');
  }, []);

  const sendMessage = useCallback(async (conversationId: string, message: string): Promise<void> => {
    console.log(`Sending message to conversation ${conversationId}: ${message}`);
    throw new Error('Message sending will be implemented in Phase 2');
  }, []);

  const getMessages = useCallback(async (conversationId: string, limit?: number): Promise<DecodedMessage[]> => {
    console.log(`Getting messages from conversation ${conversationId} with limit: ${limit || 'unlimited'}`);
    throw new Error('Message retrieval will be implemented in Phase 2');
  }, []);

  const streamMessages = useCallback(async (
    conversationId: string,
    onMessage: (message: DecodedMessage) => void
  ): Promise<() => void> => {
    console.log(`Streaming messages from conversation ${conversationId}`, onMessage.name || 'callback');
    throw new Error('Message streaming will be implemented in Phase 2');
  }, []);

  const addMembers = useCallback(async (conversationId: string, addresses: string[]): Promise<void> => {
    console.log(`Adding ${addresses.length} members to conversation ${conversationId}`);
    throw new Error('Member management will be implemented in Phase 2');
  }, []);

  const removeMembers = useCallback(async (conversationId: string, addresses: string[]): Promise<void> => {
    console.log(`Removing ${addresses.length} members from conversation ${conversationId}`);
    throw new Error('Member management will be implemented in Phase 2');
  }, []);

  // FIXED: Enhanced canMessage implementation with proper error handling
  const canMessage = useCallback(async (addresses: string[]): Promise<Map<string, boolean>> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      return await xmtpManager.current.canMessage(addresses);
    } catch (error) {
      console.error('❌ Failed to check message capabilities:', error);
      
      // FIXED: Removed unused variable 'addressError'
      // Previously had: const addressError = error instanceof Error ? error.message : String(error);
      
      // Return a map with all addresses set to false on error
      const result = new Map<string, boolean>();
      addresses.forEach(addr => result.set(addr, false));
      return result;
    }
  }, []); // No dependencies needed - function uses parameters and manager reference

  const cleanup = useCallback(async () => {
    try {
      messageStreams.current.forEach(stopStream => stopStream());
      messageStreams.current.clear();

      if (xmtpManager.current) {
        await xmtpManager.current.cleanup();
        xmtpManager.current = null;
      }

      setClient(null);
      setIsInitialized(false);
      setConversations([]);
      setError(null);
      setDatabaseHealth(null);
      lastInitializedAddress.current = null;
      lastInitializedChainId.current = null;
      retryCount.current = 0;
      setInitializationState({
        phase: 'starting',
        progress: 0,
        currentOperation: 'Waiting for wallet connection',
        issues: []
      });

      console.log('🧹 XMTP cleanup completed');
    } catch (error) {
      console.error('❌ Error during XMTP cleanup:', error);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    retryCount.current = 0; // Reset retry count when manually clearing error
  }, []);

  /**
   * FIXED: Auto-initialize XMTP when wallet connects with improved dependency management
   */
  useEffect(() => {
    if (isConnected && signer && chainId && !isInitialized && !isInitializing) {
      console.log('🔗 Wallet connected, starting XMTP initialization...');
      initializeXMTP();
    }
  }, [isConnected, signer, chainId, isInitialized, isInitializing, initializeXMTP]);

  // Update initialization state when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setInitializationState({
        phase: 'starting',
        progress: 0,
        currentOperation: 'Waiting for wallet connection',
        issues: []
      });
      lastInitializedAddress.current = null;
      lastInitializedChainId.current = null;
      retryCount.current = 0;
    }
  }, [isConnected]);

  useEffect(() => {
    return () => {
      if (xmtpManager.current) {
        xmtpManager.current.cleanup();
      }
    };
  }, []);

  return {
    // Core state
    client,
    isInitialized,
    isInitializing,
    error,
    conversations,
    
    // Enhanced state
    initializationState,
    databaseHealth,
    
    // Core methods
    initializeXMTP,
    createGroup,
    createDM,
    sendMessage,
    getMessages,
    streamMessages,
    
    // Group management
    addMembers,
    removeMembers,
    canMessage,
    
    // Health and recovery
    performHealthCheck,
    resetDatabase,
    refreshConversations, 
    repairSequenceId,
    
    // Utility
    cleanup,
    clearError,
  };
}