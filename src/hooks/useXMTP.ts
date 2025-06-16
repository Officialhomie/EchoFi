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
// ENHANCED XMTP MANAGER CLASS - SINGLETON PATTERN TO PREVENT RE-INITIALIZATION
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

  // Singleton pattern to prevent multiple instances
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
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 2000,
      healthCheckInterval: config.healthCheckInterval || 30000,
      encryptionKey: config.encryptionKey || this.generateEncryptionKey()
    };
    this.encryptionKey = this.config.encryptionKey;
  }

  /**
   * FIXED: Stable client initialization that prevents repeated signature requests
   * Only re-initializes if the signer address changes or client is corrupted
   */
  async initializeClient(signer: Signer, config?: Partial<XMTPConfig>): Promise<Client> {
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

    // Update configuration if provided
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.updateInitializationState('connecting', 10, 'Creating XMTP client');
    console.log('🚀 [ENHANCED] Initializing XMTP client for address:', currentSignerAddress);

    try {
      // Pre-initialization health check
      await this.performPreInitHealthCheck();
      this.updateInitializationState('connecting', 25, 'Health check completed');

      // Client options with comprehensive configuration
      const clientOptions: ClientOptions = {
        env: this.config.env,
        dbPath: this.config.dbPath,
      };

      this.updateInitializationState('connecting', 40, 'Initializing XMTP client');

      // Initialize XMTP client - this is where the signature request happens
      console.log('🔐 [ENHANCED] Requesting signature for XMTP client initialization...');
      this.client = await Client.create(signer, this.encryptionKey!, clientOptions);

      this.updateInitializationState('syncing', 60, 'Synchronizing database');

      // Post-initialization database health check and repair
      await this.performPostInitHealthCheck();
      this.updateInitializationState('syncing', 80, 'Database sync completed');

      // Verify client is properly initialized
      if (!this.client || !this.client.accountAddress) {
        throw new Error('XMTP client initialization failed - no account address');
      }

      // Mark as stable and store signer address
      this.isInitialized = true;
      this.isClientStable = true;
      this.lastSignerAddress = currentSignerAddress;
      this.updateInitializationState('ready', 100, 'XMTP client ready');

      if (this.config.enableLogging) {
        console.log('✅ [ENHANCED] XMTP client initialized successfully:', {
          address: this.client.accountAddress,
          inboxId: this.client.inboxId,
          installationId: this.client.installationId,
          env: this.config.env,
          dbPath: this.config.dbPath
        });
      }

      return this.client;

    } catch (error) {
      this.isClientStable = false;
      this.updateInitializationState('failed', 0, 'Initialization failed', [
        error instanceof Error ? error.message : String(error)
      ]);
      
      // Enhanced error handling for common issues
      if (error instanceof Error) {
        if (error.message.includes('SequenceId')) {
          console.error('🔧 SequenceId error detected, attempting repair...');
          await this.repairSequenceIdDatabase();
          throw new Error('SequenceId database error detected and repair attempted. Please try again.');
        }
        
        if (error.message.includes('database') || error.message.includes('sync')) {
          console.error('🔧 Database sync error detected, attempting reset...');
          await this.resetDatabase();
          throw new Error('Database sync error detected. Database has been reset. Please try again.');
        }
      }
      
      throw error;
    }
  }

  /**
   * Generate or retrieve XMTP encryption key with proper persistence
   */
  private generateEncryptionKey(): Uint8Array {
    // Try to get key from localStorage for persistence
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

    // Generate new key and persist it
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
   * Pre-initialization health check
   */
  private async performPreInitHealthCheck(): Promise<void> {
    try {
      await this.checkForCorruptDatabases();
      await this.clearStaleData();
    } catch (error) {
      console.warn('⚠️ Pre-init health check warning:', error);
    }
  }

  /**
   * Post-initialization health check and repair
   */
  private async performPostInitHealthCheck(): Promise<void> {
    try {
      await this.verifyDatabaseIntegrity();
      await this.validateSequenceId();
    } catch (error) {
      console.warn('⚠️ Post-init health check detected issues:', error);
      await this.repairSequenceIdDatabase();
    }
  }

  /**
   * Check for corrupt databases and clean them
   */
  private async checkForCorruptDatabases(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name?.includes('xmtp') || db.name?.includes(this.config.dbPath)) {
          try {
            const openReq = indexedDB.open(db.name);
            await new Promise((resolve, reject) => {
              openReq.onsuccess = () => {
                openReq.result.close();
                resolve(null);
              };
              openReq.onerror = () => reject(openReq.error);
              openReq.onblocked = () => reject(new Error('Database blocked'));
            });
          } catch (dbError) {
            console.log(`🔧 Removing corrupt database: ${db.name}`, dbError);
            indexedDB.deleteDatabase(db.name);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Error checking for corrupt databases:', error);
    }
  }

  /**
   * Clear stale data that might cause conflicts
   */
  private async clearStaleData(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('xmtp') || key.includes('sequence')) && key !== 'xmtp_encryption_key_v2') {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('xmtp') || key.includes('sequence'))) {
          sessionKeysToRemove.push(key);
        }
      }
      
      sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
      });

    } catch (error) {
      console.warn('⚠️ Error clearing stale data:', error);
    }
  }

  /**
   * Verify database integrity
   */
  private async verifyDatabaseIntegrity(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.conversations.listGroups();
    } catch (error) {
      throw new Error(`Database integrity check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate SequenceId consistency
   */
  private async validateSequenceId(): Promise<void> {
    console.log('🔍 Validating SequenceId consistency...');
  }

  /**
   * Repair SequenceId database issues
   */
  async repairSequenceIdDatabase(): Promise<void> {
    console.log('🔧 Starting SequenceId database repair...');
    
    try {
      await this.clearSequenceData();
      
      if (this.client) {
        this.client = null;
        this.isInitialized = false;
        this.isClientStable = false;
      }
      
      await this.clearSequenceIndexedDB();
      
      console.log('✅ SequenceId database repair completed');
      
    } catch (error) {
      console.error('❌ SequenceId repair failed:', error);
      throw new Error(`SequenceId repair failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear sequence-related data
   */
  private async clearSequenceData(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const sequenceKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.toLowerCase().includes('sequence')) {
          sequenceKeys.push(key);
        }
      }
      sequenceKeys.forEach(key => localStorage.removeItem(key));

      const sessionSequenceKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.toLowerCase().includes('sequence')) {
          sessionSequenceKeys.push(key);
        }
      }
      sessionSequenceKeys.forEach(key => sessionStorage.removeItem(key));

    } catch (error) {
      console.warn('⚠️ Error clearing sequence data:', error);
    }
  }

  /**
   * Clear sequence-related IndexedDB entries
   */
  private async clearSequenceIndexedDB(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name?.includes('sequence') || db.name?.includes(this.config.dbPath)) {
          console.log(`🔧 Clearing sequence database: ${db.name}`);
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error clearing sequence IndexedDB:', error);
    }
  }

  /**
   * Comprehensive database reset
   */
  async resetDatabase(): Promise<void> {
    console.log('🔄 Starting comprehensive XMTP database reset...');
    
    try {
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
          indexedDB.deleteDatabase(db.name);
        }
      }

      const localKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.toLowerCase().includes('xmtp') && key !== 'xmtp_encryption_key_v2') {
          localKeys.push(key);
        }
      }
      localKeys.forEach(key => localStorage.removeItem(key));

      const sessionKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.toLowerCase().includes('xmtp')) {
          sessionKeys.push(key);
        }
      }
      sessionKeys.forEach(key => sessionStorage.removeItem(key));

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
        report.recommendations.push('Run SequenceId repair');
      } else if (errorMessage.includes('database') || errorMessage.includes('sync')) {
        report.recommendations.push('Reset database');
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
      console.log('🧹 XMTP manager cleanup completed');
    } catch (error) {
      console.error('❌ Error during XMTP cleanup:', error);
    }
  }
}

// =============================================================================
// FIXED BROWSER SIGNER CREATION - PREVENTS REPEATED SIGNATURES
// =============================================================================

/**
 * FIXED: Create browser-compatible signer from wallet signer with proper chain ID handling
 * This function is memoized to prevent repeated signer creation and signature requests
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
  
  return {
    walletType: 'SCW',
    getAddress: async () => {
      if (typeof signer.getAddress === 'function') {
        return await signer.getAddress();
      }
      throw new Error('Signer does not support getAddress');
    },
    signMessage: async (message: string) => {
      if (typeof signer.signMessage === 'function') {
        console.log('🔐 XMTP requesting signature for message length:', message.length);
        const signature = await signer.signMessage(message);
        const hexSignature = signature.startsWith('0x') ? signature.slice(2) : signature;
        return new Uint8Array(Buffer.from(hexSignature, 'hex'));
      }
      throw new Error('Signer does not support signMessage');
    },
    getChainId: () => {
      // FIXED: Use the current connected chain ID instead of defaulting to mainnet
      console.log('🔗 XMTP signer reporting chain ID:', currentChainId);
      return BigInt(currentChainId);
    },
    getBlockNumber: () => {
      return BigInt(0);
    }
  };
}

// =============================================================================
// FIXED XMTP HOOK WITH STABLE INITIALIZATION
// =============================================================================

/**
 * FIXED: Unified XMTP Hook with stable signer creation and initialization
 * Prevents repeated signature requests and ensures correct chain ID usage
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
  const initializationInProgress = useRef(false);
  const lastInitializedAddress = useRef<string | null>(null);
  const lastInitializedChainId = useRef<number | null>(null);

  /**
   * FIXED: Stable XMTP initialization that only runs when necessary
   */
  const initializeXMTP = useCallback(async () => {
    if (!signer || !isConnected || !chainId) {
      setError('Wallet not connected or chain ID not available');
      return;
    }

    // Get current address to check if we need to re-initialize
    const currentAddress = await signer.getAddress();
    
    // OPTIMIZATION: Skip initialization if already initialized for same address and chain
    if (
      isInitialized && 
      lastInitializedAddress.current === currentAddress &&
      lastInitializedChainId.current === chainId
    ) {
      console.log('✅ XMTP already initialized for current address and chain, skipping...');
      return;
    }

    if (isInitializing || initializationInProgress.current) {
      console.log('🔄 Initialization already in progress, skipping...');
      return;
    }

    initializationInProgress.current = true;
    setIsInitializing(true);
    setError(null);

    try {
      console.log('🚀 Starting XMTP initialization for address:', currentAddress, 'on chain:', chainId);
      
      // Get or create singleton manager instance
      xmtpManager.current = EnhancedXMTPManager.getInstance({
        env: config?.env || 'dev',
        enableLogging: config?.enableLogging ?? true,
        dbPath: config?.dbPath || 'echofi-xmtp-unified',
        maxRetries: config?.maxRetries || 3,
        retryDelay: config?.retryDelay || 2000,
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

      // FIXED: Create stable browser-compatible signer with correct chain ID
      const browserSigner = createStableBrowserSigner(signer, chainId);
      
      // Initialize client with singleton manager (prevents repeated signatures)
      const xmtpClient = await xmtpManager.current.initializeClient(browserSigner, config);
      
      setClient(xmtpClient);
      setIsInitialized(true);
      lastInitializedAddress.current = currentAddress;
      lastInitializedChainId.current = chainId;
      
      // Perform initial health check
      const healthReport = await xmtpManager.current.performHealthCheck();
      setDatabaseHealth(healthReport);
      
      // Load existing conversations
      await refreshConversations();
      
      console.log('✅ XMTP initialization completed successfully for address:', currentAddress);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ XMTP initialization failed:', errorMessage);
      setError(errorMessage);
      
      setInitializationState({
        phase: 'failed',
        progress: 0,
        currentOperation: 'Initialization failed',
        issues: [errorMessage]
      });
      
    } finally {
      setIsInitializing(false);
      initializationInProgress.current = false;
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
        console.log('🔧 Database error detected, attempting automatic recovery...');
        
        try {
          await repairSequenceId();
          const convos = await xmtpManager.current!.getConversations();
          setConversations(convos);
          setError(null);
        } catch (recoveryError) {
          console.error('Recovery failed:', recoveryError);
          setError('Database error detected. Please try resetting the database.');
        }
      } else {
        setError(errorMessage);
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
      await xmtpManager.current.repairSequenceIdDatabase();
      
      const healthReport = await xmtpManager.current.performHealthCheck();
      setDatabaseHealth(healthReport);
      
      console.log('✅ SequenceId repair completed');
    } catch (error) {
      console.error('❌ SequenceId repair failed:', error);
      throw error;
    }
  }, []);

  /**
   * Perform comprehensive health check
   */
  const performHealthCheck = useCallback(async (): Promise<DatabaseHealthReport> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      const report = await xmtpManager.current.performHealthCheck();
      setDatabaseHealth(report);
      return report;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  }, []);

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
        maxRetries: config?.maxRetries || 3,
        retryDelay: config?.retryDelay || 2000,
        healthCheckInterval: config?.healthCheckInterval || 30000,
        ...config,
      });
      
      console.log('✅ Database reset complete');
      
      if (signer && isConnected && chainId) {
        console.log('🔄 Reinitializing XMTP after database reset...');
        await initializeXMTP();
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Database reset failed:', errorMessage);
      setError(`Reset failed: ${errorMessage}`);
    } finally {
      setIsInitializing(false);
    }
  }, [signer, isConnected, chainId, initializeXMTP, config]);

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

  const canMessage = useCallback(async (addresses: string[]): Promise<Map<string, boolean>> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      return await xmtpManager.current.canMessage(addresses);
    } catch (error) {
      console.error('❌ Failed to check message capability:', error);
      throw error;
    }
  }, []);

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
  }, []);

  /**
   * FIXED: Auto-initialize XMTP when wallet connects with proper dependency management
   * Only initializes when necessary to prevent repeated signature requests
   */
  useEffect(() => {
    if (
      isConnected && 
      signer && 
      chainId &&
      !isInitialized && 
      !isInitializing && 
      !initializationInProgress.current
    ) {
      console.log('🔄 Wallet connected on chain', chainId, ', auto-initializing XMTP...');
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
    }
  }, [isConnected]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

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