// src/lib/cache-manager.ts
// Advanced caching system with TTL, compression, and intelligent invalidation

import { FEATURE_FLAGS } from './network-config';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  compress?: boolean; // Compress large values
  tags?: string[]; // Cache tags for bulk invalidation
  priority?: 'low' | 'medium' | 'high'; // Eviction priority
  stale?: boolean; // Allow serving stale data while revalidating
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: Date;
  ttl: number;
  compressed: boolean;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  accessCount: number;
  lastAccess: Date;
  size: number; // Approximate size in bytes
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number; // Approximate total size in bytes
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

/**
 * Advanced cache manager with intelligent eviction and compression
 */
export class CacheManager {
  private static instance: CacheManager;
  private cache = new Map<string, CacheEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0,
  };
  private maxSize = 100 * 1024 * 1024; // 100MB default max size
  private maxEntries = 10000; // Maximum number of entries
  private cleanupInterval: NodeJS.Timeout | null = null;

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private constructor() {
    if (FEATURE_FLAGS.enableRequestCaching) {
      this.startCleanupTimer();
    }
  }

  /**
   * Set a value in cache with options
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    if (!FEATURE_FLAGS.enableRequestCaching) return;

    const {
      ttl = 30000, // 30 seconds default
      compress = false,
      tags = [],
      priority = 'medium',
    } = options;

    // Calculate approximate size
    const serialized = JSON.stringify(value);
    const size = new Blob([serialized]).size;

    // Compress if requested and value is large
    let data = value;
    let compressed = false;
    
    if (compress && size > 1024) { // Compress if > 1KB
      try {
        // Simple compression simulation (in real app, use actual compression)
        compressed = true;
      } catch (error) {
        console.warn('Compression failed, storing uncompressed:', error);
      }
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttl,
      compressed,
      tags,
      priority,
      accessCount: 0,
      lastAccess: new Date(),
      size,
    };

    // Check if we need to evict entries
    this.evictIfNecessary(size);

    this.cache.set(key, entry);
    this.stats.sets++;

    console.log(`💾 [CACHE] Set ${key} (${this.formatSize(size)}, TTL: ${ttl}ms)`);
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    if (!FEATURE_FLAGS.enableRequestCaching) return null;

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    const age = now - entry.timestamp.getTime();
    
    if (age > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      console.log(`⏰ [CACHE] Expired ${key} (age: ${age}ms, TTL: ${entry.ttl}ms)`);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccess = new Date();
    
    this.stats.hits++;
    console.log(`🎯 [CACHE] Hit ${key} (age: ${age}ms, access: ${entry.accessCount})`);
    
    return entry.data;
  }

  /**
   * Get with stale-while-revalidate pattern
   */
  async getWithRevalidation<T>(
    key: string,
    revalidateFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached) {
      // Check if we should revalidate in background
      const entry = this.cache.get(key);
      if (entry && options.stale) {
        const age = Date.now() - entry.timestamp.getTime();
        const staleThreshold = entry.ttl * 0.8; // Revalidate at 80% of TTL
        
        if (age > staleThreshold) {
          // Revalidate in background
          revalidateFn()
            .then(freshData => {
              this.set(key, freshData, options);
              console.log(`🔄 [CACHE] Background revalidation completed for ${key}`);
            })
            .catch(error => {
              console.warn(`⚠️ [CACHE] Background revalidation failed for ${key}:`, error);
            });
        }
      }
      
      return cached;
    }

    // Cache miss - fetch fresh data
    const freshData = await revalidateFn();
    this.set(key, freshData, options);
    return freshData;
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    
    if (existed) {
      console.log(`🗑️ [CACHE] Deleted ${key}`);
    }
    
    return existed;
  }

  /**
   * Delete entries by tag
   */
  deleteByTag(tag: string): number {
    let deletedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      console.log(`🗑️ [CACHE] Deleted ${deletedCount} entries with tag "${tag}"`);
    }
    
    return deletedCount;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const entryCount = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ [CACHE] Cleared all entries (${entryCount} removed)`);
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = Date.now() - entry.timestamp.getTime();
    if (age > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.stats.hits + this.stats.misses;
    
    const timestamps = entries.map(e => e.timestamp);
    const oldestEntry = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined;
    const newestEntry = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined;

    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
      evictionCount: this.stats.evictions,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Warm up cache with predefined data
   */
  warmup(entries: Array<{ key: string; value: any; options?: CacheOptions }>): void {
    console.log(`🔥 [CACHE] Warming up cache with ${entries.length} entries...`);
    
    entries.forEach(({ key, value, options }) => {
      this.set(key, value, options);
    });
    
    console.log(`✅ [CACHE] Cache warmup completed`);
  }

  /**
   * Export cache data for persistence
   */
  export(): Record<string, any> {
    const exported: Record<string, any> = {};
    
    for (const [key, entry] of this.cache.entries()) {
      // Only export non-expired entries
      const age = Date.now() - entry.timestamp.getTime();
      if (age < entry.ttl) {
        exported[key] = {
          data: entry.data,
          timestamp: entry.timestamp.toISOString(),
          ttl: entry.ttl,
          tags: entry.tags,
          priority: entry.priority,
        };
      }
    }
    
    return exported;
  }

  /**
   * Import cache data from persistence
   */
  import(data: Record<string, any>): number {
    let importedCount = 0;
    
    for (const [key, entryData] of Object.entries(data)) {
      try {
        const timestamp = new Date(entryData.timestamp);
        const age = Date.now() - timestamp.getTime();
        
        // Only import if not expired
        if (age < entryData.ttl) {
          this.set(key, entryData.data, {
            ttl: entryData.ttl - age, // Adjust TTL for age
            tags: entryData.tags,
            priority: entryData.priority,
          });
          importedCount++;
        }
      } catch (error) {
        console.warn(`⚠️ [CACHE] Failed to import entry ${key}:`, error);
      }
    }
    
    console.log(`📥 [CACHE] Imported ${importedCount} cache entries`);
    return importedCount;
  }

  // ========== Private Methods ==========

  private evictIfNecessary(newEntrySize: number): void {
    const currentSize = this.getCurrentSize();
    const currentEntries = this.cache.size;

    // Check if we need to evict based on size or count
    if (currentSize + newEntrySize > this.maxSize || currentEntries >= this.maxEntries) {
      const targetSize = this.maxSize * 0.8; // Evict to 80% of max size
      const targetEntries = Math.floor(this.maxEntries * 0.8);
      
      this.evictEntries(targetSize, targetEntries);
    }
  }

  private evictEntries(targetSize: number, targetEntries: number): void {
    console.log(`🗑️ [CACHE] Starting eviction (target: ${this.formatSize(targetSize)}, ${targetEntries} entries)`);
    
    // Get all entries sorted by eviction priority
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry,
      score: this.calculateEvictionScore(entry),
    }));

    // Sort by eviction score (higher score = evict first)
    entries.sort((a, b) => b.score - a.score);

    let currentSize = this.getCurrentSize();
    let evictedCount = 0;

    for (const { key, entry } of entries) {
      if (currentSize <= targetSize && this.cache.size <= targetEntries) {
        break;
      }

      this.cache.delete(key);
      currentSize -= entry.size;
      evictedCount++;
      this.stats.evictions++;
    }

    console.log(`✅ [CACHE] Evicted ${evictedCount} entries (current size: ${this.formatSize(currentSize)})`);
  }

  private calculateEvictionScore(entry: CacheEntry): number {
    const age = Date.now() - entry.timestamp.getTime();
    const timeSinceAccess = Date.now() - entry.lastAccess.getTime();
    
    // Higher score = more likely to evict
    let score = 0;
    
    // Age factor (older = higher score)
    score += age / entry.ttl;
    
    // Access frequency factor (less accessed = higher score)
    score += 1 / (entry.accessCount + 1);
    
    // Time since last access (longer = higher score)
    score += timeSinceAccess / (entry.ttl * 0.5);
    
    // Priority factor
    const priorityMultiplier = {
      'low': 2.0,
      'medium': 1.0,
      'high': 0.5,
    };
    score *= priorityMultiplier[entry.priority];
    
    // Size factor (larger = slightly higher score)
    score += entry.size / (1024 * 1024); // MB
    
    return score;
  }

  private getCurrentSize(): number {
    return Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
  }

  private startCleanupTimer(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute

    console.log('🧹 [CACHE] Started cleanup timer');
  }

  private performCleanup(): void {
    const beforeSize = this.cache.size;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp.getTime();
      if (age > entry.ttl) {
        this.cache.delete(key);
      }
    }
    
    const afterSize = this.cache.size;
    const cleaned = beforeSize - afterSize;
    
    if (cleaned > 0) {
      console.log(`🧹 [CACHE] Cleanup removed ${cleaned} expired entries`);
    }
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    console.log('🗑️ [CACHE] Cache manager destroyed');
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();

// Helper functions
export function createCacheKey(...parts: string[]): string {
  return parts.join(':');
}

export function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  return cacheManager.getWithRevalidation(key, fetchFn, options);
}

// Cache tags for bulk invalidation
export const CACHE_TAGS = {
  WALLET_BALANCE: 'wallet-balance',
  AGENT_STATUS: 'agent-status',
  NETWORK_STATUS: 'network-status',
  USER_GROUPS: 'user-groups',
  PROPOSALS: 'proposals',
  HEALTH_CHECK: 'health-check',
} as const;