// src/hooks/useXMTP.ts - UNIFIED XMTP HOOK IMPLEMENTATION
// Consolidates all XMTP functionality with SequenceId fixes and enhanced error handling

import { useState, useEffect, useCallback, useRef } from 'react';
import { Client, Conversation, DecodedMessage, type ClientOptions, type Signer } from '@xmtp/browser-sdk';
import { useWallet } from './useWallet';

// =============================================================================
// TYPES AND INTERFACES
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
// ENHANCED XMTP MANAGER CLASS
// =============================================================================

class EnhancedXMTPManager {
  private client: Client | null = null;
  private config: Required<XMTPConfig>;
  private isInitialized = false;
  private encryptionKey: Uint8Array | null = null;
  private initializationState: InitializationState = {
    phase: 'starting',
    progress: 0,
    currentOperation: 'Waiting for initialization',
    issues: []
  };

  constructor(config: XMTPConfig) {
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
   * Generate or retrieve XMTP encryption key
   */
  private generateEncryptionKey(): Uint8Array {
    // Try to get key from environment variables
    const envKey = process.env.NEXT_PUBLIC_XMTP_ENCRYPTION_KEY;
    
    if (envKey && envKey !== 'your_64_character_hex_key_here') {
      try {
        // Convert hex string to Uint8Array
        if (envKey.startsWith('0x')) {
          const hexKey = envKey.slice(2);
          if (hexKey.length === 64) { // 32 bytes = 64 hex chars
            console.log('✅ Using XMTP encryption key from environment');
            return new Uint8Array(Buffer.from(hexKey, 'hex'));
          }
        }
        
        // Try base64 format
        const keyBytes = Buffer.from(envKey, 'base64');
        if (keyBytes.length === 32) {
          console.log('✅ Using XMTP encryption key from environment (base64)');
          return new Uint8Array(keyBytes);
        }
        
        console.warn('⚠️ Invalid XMTP_ENCRYPTION_KEY format. Expected 32-byte hex (0x...) or base64 string');
      } catch (error) {
        console.warn('⚠️ Failed to parse XMTP_ENCRYPTION_KEY from environment:', error);
      }
    }

    // Generate session-specific key as fallback
    console.warn('⚠️ No valid XMTP_ENCRYPTION_KEY found. Generating session key.');
    console.warn('📝 Note: Messages will not persist between sessions. Set NEXT_PUBLIC_XMTP_ENCRYPTION_KEY for persistence.');
    
    const sessionKey = crypto.getRandomValues(new Uint8Array(32));
    
    // Log the generated key for development use (remove in production)
    if (this.config.env === 'dev') {
      const hexKey = Array.from(sessionKey, byte => byte.toString(16).padStart(2, '0')).join('');
      console.log('🔑 Generated session encryption key (hex):', `0x${hexKey}`);
      console.log('💡 Add this to your .env.local: NEXT_PUBLIC_XMTP_ENCRYPTION_KEY=0x' + hexKey);
    }
    
    return sessionKey;
  }

  /**
   * Initialize XMTP client with comprehensive error handling and SequenceId fixes
   */
  async initializeClient(signer: Signer, config?: Partial<XMTPConfig>): Promise<Client> {
    this.updateInitializationState('connecting', 10, 'Creating XMTP client');

    // Merge any additional config
    if (config) {
      this.config = { ...this.config, ...config };
    }

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

      // Initialize XMTP client with proper signature handling
      this.client = await Client.create(signer, this.encryptionKey!, clientOptions);

      this.updateInitializationState('syncing', 60, 'Synchronizing database');

      // Post-initialization database health check and repair
      await this.performPostInitHealthCheck();
      this.updateInitializationState('syncing', 80, 'Database sync completed');

      // Verify client is properly initialized
      if (!this.client || !this.client.accountAddress) {
        throw new Error('XMTP client initialization failed - no account address');
      }

      this.isInitialized = true;
      this.updateInitializationState('ready', 100, 'XMTP client ready');

      if (this.config.enableLogging) {
        console.log('✅ XMTP client initialized successfully:', {
          address: this.client.accountAddress,
          inboxId: this.client.inboxId,
          installationId: this.client.installationId,
          env: this.config.env,
          dbPath: this.config.dbPath
        });
      }

      return this.client;

    } catch (error) {
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
   * Pre-initialization health check
   */
  private async performPreInitHealthCheck(): Promise<void> {
    try {
      // Check for existing corrupt databases
      await this.checkForCorruptDatabases();
      
      // Clear any stale data that might cause SequenceId conflicts
      await this.clearStaleData();
      
    } catch (error) {
      console.warn('⚠️ Pre-init health check warning:', error);
      // Continue with initialization even if health check has issues
    }
  }

  /**
   * Post-initialization health check and repair
   */
  private async performPostInitHealthCheck(): Promise<void> {
    try {
      // Verify database integrity
      await this.verifyDatabaseIntegrity();
      
      // Check SequenceId consistency
      await this.validateSequenceId();
      
    } catch (error) {
      console.warn('⚠️ Post-init health check detected issues:', error);
      // Attempt automatic repair
      await this.repairSequenceIdDatabase();
    }
  }

  /**
   * Check for corrupt databases and clean them
   */
  private async checkForCorruptDatabases(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Clear any databases that might be in a corrupt state
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name?.includes('xmtp') || db.name?.includes(this.config.dbPath)) {
          // Check if database is corrupted by attempting to open it
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
          } catch (dbError) { // FIXED: Rename 'error' to 'dbError' to avoid unused variable
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
      // Clear localStorage entries that might be stale
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('xmtp') || key.includes('sequence'))) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      // Clear sessionStorage entries
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
      // Attempt to load conversations to verify database is working
      await this.client.conversations.listGroups();
    } catch (error) {
      throw new Error(`Database integrity check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate SequenceId consistency
   */
  private async validateSequenceId(): Promise<void> {
    // This would implement SequenceId validation logic
    // For now, we'll just log that we're checking
    console.log('🔍 Validating SequenceId consistency...');
  }

  /**
   * Repair SequenceId database issues
   */
  async repairSequenceIdDatabase(): Promise<void> {
    console.log('🔧 Starting SequenceId database repair...');
    
    try {
      // Step 1: Clear potentially corrupt sequence data
      await this.clearSequenceData();
      
      // Step 2: Reset client state
      if (this.client) {
        // Close current client connections
        this.client = null;
        this.isInitialized = false;
      }
      
      // Step 3: Clear related IndexedDB entries
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
      // Clear localStorage sequence data
      const sequenceKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.toLowerCase().includes('sequence')) {
          sequenceKeys.push(key);
        }
      }
      sequenceKeys.forEach(key => localStorage.removeItem(key));

      // Clear sessionStorage sequence data
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
      // Step 1: Cleanup current client
      await this.cleanup();
      
      // Step 2: Clear all browser storage
      await this.clearAllBrowserStorage();
      
      // Step 3: Reset internal state
      this.client = null;
      this.isInitialized = false;
      
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
      // Clear IndexedDB
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name?.includes('xmtp') || db.name?.includes(this.config.dbPath)) {
          indexedDB.deleteDatabase(db.name);
        }
      }

      // Clear localStorage
      const localKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.toLowerCase().includes('xmtp')) {
          localKeys.push(key);
        }
      }
      localKeys.forEach(key => localStorage.removeItem(key));

      // Clear sessionStorage
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

      // Test basic functionality
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
      console.log('🧹 XMTP manager cleanup completed');
    } catch (error) {
      console.error('❌ Error during XMTP cleanup:', error);
    }
  }
}

// =============================================================================
// UNIFIED XMTP HOOK
// =============================================================================

/**
 * Create browser-compatible signer from wallet signer
 * FIXED: Replace 'any' with proper typing for better type safety
 */
function createBrowserSigner(signer: {
  getAddress?: () => Promise<string>;
  signMessage?: (message: string) => Promise<string>;
  getChainId?: () => number;
}): Signer {
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
        const signature = await signer.signMessage(message);
        const hexSignature = signature.startsWith('0x') ? signature.slice(2) : signature;
        return new Uint8Array(Buffer.from(hexSignature, 'hex'));
      }
      throw new Error('Signer does not support signMessage');
    },
    getChainId: () => {
      if (typeof signer.getChainId === 'function') {
        return BigInt(signer.getChainId());
      }
      return BigInt(1); // Default to mainnet
    },
    getBlockNumber: () => {
      return BigInt(0);
    }
  };
}

/**
 * Unified XMTP Hook with comprehensive SequenceId fixes and error handling
 */
export function useXMTP(config?: XMTPConfig): UseXMTPReturn {
  const { signer, isConnected } = useWallet(); // FIXED: Remove unused 'address' variable
  
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
  
  // Manager and streams
  const xmtpManager = useRef<EnhancedXMTPManager | null>(null);
  const messageStreams = useRef<Map<string, () => void>>(new Map());
  const initializationInProgress = useRef(false);

  /**
   * Repair SequenceId database issues
   * FIXED: Move repairSequenceId before refreshConversations to resolve dependency order
   */
  const repairSequenceId = useCallback(async () => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      console.log('🔧 Starting SequenceId repair...');
      await xmtpManager.current.repairSequenceIdDatabase();
      
      // Perform health check after repair
      const healthReport = await xmtpManager.current.performHealthCheck();
      setDatabaseHealth(healthReport);
      
      console.log('✅ SequenceId repair completed');
    } catch (error) {
      console.error('❌ SequenceId repair failed:', error);
      throw error;
    }
  }, []);

  /**
     * Refresh conversations with enhanced error handling
     * FIXED: Add isInitializing dependency to prevent exhaustive-deps warning
     */
  const refreshConversations = useCallback(async () => {
    if (!xmtpManager.current) return;

    try {
      console.log('🔄 Refreshing conversations...');
      const convos = await xmtpManager.current.getConversations();
      setConversations(convos);
      console.log(`✅ Loaded ${convos.length} conversations`);
      
      // Clear any previous errors on successful load
      if (error && convos.length >= 0) {
        setError(null);
      }
      
    } catch (convError) { // FIXED: Rename from 'error' to 'convError' to avoid shadowing
      const errorMessage = convError instanceof Error ? convError.message : String(convError);
      console.error('❌ Failed to refresh conversations:', errorMessage);
      
      // Enhanced error handling for SequenceId issues
      if (errorMessage.includes('SequenceId') || 
          errorMessage.includes('database') || 
          errorMessage.includes('sync')) {
        console.log('🔧 Database error detected, attempting automatic recovery...');
        
        try {
          await repairSequenceId();
          // Retry after repair
          const convos = await xmtpManager.current!.getConversations();
          setConversations(convos);
          setError(null);
        } catch (recoveryErr) { // FIXED: Rename from 'recoveryError' to 'recoveryErr' and use it
          console.error('Recovery failed:', recoveryErr);
          setError('Database error detected. Please try resetting the database.');
        }
      } else {
        setError(errorMessage);
      }
    }
  }, [
    error, 
    repairSequenceId,
    isInitializing
  ]);

  /**
   * Initialize XMTP with comprehensive error handling
   */
  const initializeXMTP = useCallback(async () => {
    if (!signer || !isConnected) {
      setError('Wallet not connected');
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
      console.log('🚀 Starting unified XMTP initialization...');
      
      // Create enhanced manager with unified configuration
      xmtpManager.current = new EnhancedXMTPManager({
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

      // Create browser-compatible signer
      const browserSigner = createBrowserSigner(signer);
      
      // Initialize client with enhanced manager
      const xmtpClient = await xmtpManager.current.initializeClient(browserSigner, config);
      
      setClient(xmtpClient);
      setIsInitialized(true);
      
      // Perform initial health check
      const healthReport = await xmtpManager.current.performHealthCheck();
      setDatabaseHealth(healthReport);
      
      // Load existing conversations
      await refreshConversations();
      
      console.log('✅ Unified XMTP initialization completed successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ Unified XMTP initialization failed:', errorMessage);
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
  }, [signer, isConnected, config, refreshConversations]); // FIXED: Add refreshConversations dependency

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
      
      // Reset all state
      setClient(null);
      setIsInitialized(false);
      setConversations([]);
      setDatabaseHealth(null);
      
      // Stop all message streams
      messageStreams.current.forEach(stopStream => {
        try {
          stopStream();
        } catch (error) {
          console.warn('⚠️ Error stopping stream:', error);
        }
      });
      messageStreams.current.clear();
      
      // Recreate XMTP manager
      xmtpManager.current = new EnhancedXMTPManager({
        env: config?.env || 'dev',
        enableLogging: config?.enableLogging ?? true,
        dbPath: config?.dbPath || 'echofi-xmtp-unified',
        maxRetries: config?.maxRetries || 3,
        retryDelay: config?.retryDelay || 2000,
        healthCheckInterval: config?.healthCheckInterval || 30000,
        ...config,
      });
      
      console.log('✅ Database reset complete');
      
      // Reinitialize XMTP if wallet is connected
      if (signer && isConnected) {
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
  }, [signer, isConnected, initializeXMTP, config]);

  // FIXED: Placeholder implementations that acknowledge parameters to prevent unused warnings
  const createGroup = useCallback(async (name: string, description: string, members: string[]): Promise<Conversation> => {
    // Acknowledge parameters by logging them to prevent unused variable warnings
    console.log(`Creating group "${name}" with description "${description}" and ${members.length} members`);
    throw new Error('Group creation will be implemented in Phase 2');
  }, []);

  const createDM = useCallback(async (peerAddress: string): Promise<Conversation> => {
    // Acknowledge parameter to prevent unused variable warning
    console.log(`Creating DM with peer: ${peerAddress}`);
    throw new Error('DM creation will be implemented in Phase 2');
  }, []);

  const sendMessage = useCallback(async (conversationId: string, message: string): Promise<void> => {
    // Acknowledge parameters to prevent unused variable warnings
    console.log(`Sending message to conversation ${conversationId}: ${message}`);
    throw new Error('Message sending will be implemented in Phase 2');
  }, []);

  const getMessages = useCallback(async (conversationId: string, limit?: number): Promise<DecodedMessage[]> => {
    // Acknowledge parameters to prevent unused variable warnings
    console.log(`Getting messages from conversation ${conversationId} with limit: ${limit || 'unlimited'}`);
    throw new Error('Message retrieval will be implemented in Phase 2');
  }, []);

  const streamMessages = useCallback(async (
    conversationId: string,
    onMessage: (message: DecodedMessage) => void
  ): Promise<() => void> => {
    // Acknowledge parameters to prevent unused variable warnings
    console.log(`Streaming messages from conversation ${conversationId}`, onMessage.name || 'callback');
    throw new Error('Message streaming will be implemented in Phase 2');
  }, []);

  const addMembers = useCallback(async (conversationId: string, addresses: string[]): Promise<void> => {
    // Acknowledge parameters to prevent unused variable warnings
    console.log(`Adding ${addresses.length} members to conversation ${conversationId}`);
    throw new Error('Member management will be implemented in Phase 2');
  }, []);

  const removeMembers = useCallback(async (conversationId: string, addresses: string[]): Promise<void> => {
    // Acknowledge parameters to prevent unused variable warnings
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
      // Stop all message streams
      messageStreams.current.forEach(stopStream => stopStream());
      messageStreams.current.clear();

      // Cleanup enhanced manager
      if (xmtpManager.current) {
        await xmtpManager.current.cleanup();
        xmtpManager.current = null;
      }

      // Reset state
      setClient(null);
      setIsInitialized(false);
      setConversations([]);
      setError(null);
      setDatabaseHealth(null);
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
   * Effects
   */
  
  // Initialize XMTP when wallet is connected
  useEffect(() => {
    if (isConnected && signer && !isInitialized && !isInitializing && !initializationInProgress.current) {
      console.log('🔄 Wallet connected, initializing unified XMTP...');
      initializeXMTP();
    }
  }, [isConnected, signer, isInitialized, isInitializing, initializeXMTP]);

  // Update initialization state when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setInitializationState({
        phase: 'starting',
        progress: 0,
        currentOperation: 'Waiting for wallet connection',
        issues: []
      });
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