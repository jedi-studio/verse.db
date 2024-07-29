import { EventEmitter } from "events";
import { logError, logInfo, logSuccess } from "../core/functions/logger";
import {
  DevLogsOptions,
  AdapterSetting,
  AdapterResults,
  CacheAdapter as ICacheAdapter,
  CacheData,
} from "../types/adapter";

export class CacheAdapter extends EventEmitter implements ICacheAdapter {
  public devLogs: DevLogsOptions = { enable: false, path: "" };
  private cache: Map<string, { data: CacheData; expiry: number | null }>;
  private maxSize: number;
  private ttl: number;
  private hitCount: number;
  private missCount: number;
  private evictions: number;

  /**
   * Create a new CacheAdapter instance
   * @param {AdapterSetting & { maxSize?: number, ttl?: number }} options - Cache settings including maxSize and ttl
   */
  constructor(
    options: AdapterSetting & {
      dataPath?: string;
      maxSize?: number;
      ttl?: number;
    }
  ) {
    super();
    this.devLogs = options.devLogs;
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.evictions = 0;

    if (this.devLogs.enable && !this.devLogs.path) {
      logError({
        content: "You need to provide a logs path if devLogs is enabled.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Check if a cache entry is expired
   * @param {{ data: CacheData, expiry: number | null }} entry - Cache entry to check
   * @returns {boolean} - True if the entry is expired, false otherwise
   */
  private isExpired(entry: {
    data: CacheData;
    expiry: number | null;
  }): boolean {
    if (entry.expiry === null) return false;
    return Date.now() > entry.expiry;
  }

  /**
   * Prune the cache to ensure it doesn't exceed the maximum size
   */
  private prune(): void {
    if (this.cache.size > this.maxSize) {
      const keys = Array.from(this.cache.keys());
      for (const key of keys) {
        if (this.cache.size <= this.maxSize) break;
        this.cache.delete(key);
        this.evictions++;
        logInfo({
          content: `Cache entry ${key} evicted`,
          devLogs: this.devLogs,
        });
      }
    }
  }

  /**
   * Load a cache entry by key
   * @param {string} key - The key of the cache entry
   * @returns {Promise<AdapterResults | null>} - A Promise that resolves with the cache entry data or null if not found
   */
  public async load(key: string): Promise<AdapterResults | null> {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.missCount++;
        logInfo({
          content: `Cache entry ${key} expired and removed`,
          devLogs: this.devLogs,
        });
        return null;
      } else {
        this.hitCount++;
        logInfo({
          content: `Cache entry ${key} loaded`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: true,
          message: `Cache entry ${key} loaded`,
          results: entry.data,
        };
      }
    }
    this.missCount++;
    return null;
  }

  /**
   * Add a cache entry
   * @param {string} key - The key of the cache entry
   * @param {CacheData} data - The data to cache
   * @returns {Promise<AdapterResults>} - A Promise that resolves when the cache entry is added
   */
  public async add(key: string, data: CacheData): Promise<AdapterResults> {
    const expiry = this.ttl > 0 ? Date.now() + this.ttl : null;
    this.cache.set(key, { data, expiry });
    this.prune();
    logSuccess({
      content: `Cache entry ${key} added`,
      devLogs: this.devLogs,
    });
    return {
      acknowledged: true,
      message: `Cache entry ${key} added`,
    };
  }

  /**
   * drop a cache entry by key
   * @param {string} key - The key of the cache entry
   * @returns {Promise<AdapterResults>} - A Promise that resolves when the cache entry is droped
   */
  public async drop(key: string): Promise<AdapterResults> {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      logSuccess({
        content: `Cache entry ${key} droped`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: true,
        message: `Cache entry ${key} droped`,
      };
    } else {
      return {
        acknowledged: false,
        errorMessage: `Cache entry ${key} does not exist`,
      };
    }
  }

  /**
   * Clear all cache entries
   * @returns {Promise<AdapterResults>} - A Promise that resolves when all cache entries are cleared
   */
  public async clear(): Promise<AdapterResults> {
    this.cache.clear();
    logSuccess({
      content: "All cache entries cleared",
      devLogs: this.devLogs,
    });
    return {
      acknowledged: true,
      message: "All cache entries cleared",
    };
  }

  /**
   * Get cache statistics
   * @returns {Promise<AdapterResults>} - A Promise that resolves with the cache statistics
   */
  public async stats(): Promise<AdapterResults> {
    return {
      acknowledged: true,
      message: "Cache statistics retrieved",
      results: {
        size: this.cache.size,
        hits: this.hitCount,
        misses: this.missCount,
        evictions: this.evictions,
      },
    };
  }

  /**
   * Invalidate cache entries based on a predicate
   * @param {(key: string, data: CacheData) => boolean} predicate - Predicate function to determine which entries to invalidate
   * @returns {Promise<AdapterResults>} - A Promise that resolves when invalidation is complete
   */
  public async invalidate(
    predicate: (key: string, data: CacheData) => boolean
  ): Promise<AdapterResults> {
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      const entry = this.cache.get(key)!;
      if (predicate(key, entry.data)) {
        this.cache.delete(key);
        logInfo({
          content: `Cache entry ${key} invalidated`,
          devLogs: this.devLogs,
        });
      }
    }
    return {
      acknowledged: true,
      message: "Cache invalidation complete",
    };
  }
}
