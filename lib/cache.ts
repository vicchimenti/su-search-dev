/**
 * @fileoverview Redis caching implementation
 * 
 * This module provides Redis caching functionality for the frontend API,
 * improving performance by caching API responses. Includes enhanced
 * support for tab content caching and tiered TTL for popular queries.
 *
 * @author Victor Chimenti
 * @version 3.1.0
 * @license MIT
 * @lastModified 2025-10-01
 */

import Redis from 'ioredis';

// Define log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Set default log level (can be overridden via environment variable)
const DEFAULT_LOG_LEVEL = LogLevel.INFO;
let currentLogLevel = process.env.CACHE_LOG_LEVEL
  ? parseInt(process.env.CACHE_LOG_LEVEL, 10)
  : DEFAULT_LOG_LEVEL;

// Initialize Redis client
// Updated code to use Fall_0925 variables only
const redisClient = process.env.Fall_0925_KV_URL
  ? new Redis(process.env.Fall_0925_KV_URL)
  : process.env.Fall_0925_REDIS_URL
    ? new Redis(process.env.Fall_0925_REDIS_URL)
    : null;

// Fallback in-memory cache for local development
const memoryCache = new Map();

// Updated for daily crawl schedule (12-20 hours)
const DEFAULT_TTL = 12 * 3600; // 12 hours
const TAB_CONTENT_TTL = 14 * 3600; // 14 hours
const POPULAR_TAB_TTL = 20 * 3600; // 20 hours
const SEARCH_DEFAULT_TTL = 12 * 3600; // 12 hours
const SEARCH_POPULAR_TTL = 16 * 3600; // 16 hours
const SEARCH_HIGH_VOLUME_TTL = 18 * 3600; // 18 hours

export {
  DEFAULT_TTL,
  TAB_CONTENT_TTL,
  POPULAR_TAB_TTL,
  SEARCH_DEFAULT_TTL,
  SEARCH_POPULAR_TTL,
  SEARCH_HIGH_VOLUME_TTL
};

// Simple metrics tracking - doesn't affect existing cache behavior
interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
}

// In-memory metrics store (completely separate from cache)
const metrics: {
  [key: string]: CacheMetrics
} = {
  search: { hits: 0, misses: 0, sets: 0 },
  tabs: { hits: 0, misses: 0, sets: 0 },
  total: { hits: 0, misses: 0, sets: 0 }
};

// Simple in-memory store for query popularity tracking
const queryPopularity: {
  [key: string]: {
    count: number,
    lastAccessed: number
  }
} = {};

/**
 * Logger function with level-based filtering
 * @param message - The message to log
 * @param level - The log level for this message
 * @param data - Optional data to include in the log
 */
export function log(message: string, level: LogLevel = LogLevel.INFO, data?: any): void {
  if (level <= currentLogLevel) {
    const prefix = getLogPrefix(level);
    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

/**
 * Get the prefix for a log level
 * @param level - The log level
 * @returns The prefix string
 */
function getLogPrefix(level: LogLevel): string {
  switch (level) {
    case LogLevel.ERROR:
      return '[CACHE-ERROR]';
    case LogLevel.WARN:
      return '[CACHE-WARN]';
    case LogLevel.INFO:
      return '[CACHE-INFO]';
    case LogLevel.DEBUG:
      return '[CACHE-DEBUG]';
    default:
      return '[CACHE]';
  }
}

/**
 * Set the current log level
 * @param level - The new log level
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  log(`Log level set to ${LogLevel[level]}`, LogLevel.INFO);
}

/**
 * Track a query hit for popularity metrics
 * Does not affect existing cache behavior
 * @param query - The query string
 * @param type - The type of operation (hit, miss, set)
 */
export function trackQueryHit(query: string, type: 'hit' | 'miss' | 'set'): void {
  if (!query) return;

  // Normalize query for consistency
  const normalizedQuery = query.trim().toLowerCase();

  // Initialize if not exists
  if (!queryPopularity[normalizedQuery]) {
    queryPopularity[normalizedQuery] = {
      count: 0,
      lastAccessed: Date.now()
    };
  }

  // Increment hit count and update timestamp
  queryPopularity[normalizedQuery].count += 1;
  queryPopularity[normalizedQuery].lastAccessed = Date.now();

  // Log at DEBUG level
  log(`Query "${normalizedQuery}" hit count: ${queryPopularity[normalizedQuery].count} (${type})`, LogLevel.DEBUG);
}

/**
 * Get recommended TTL for a query based on its popularity
 * @param query - The query string
 * @param defaultTtl - Default TTL to use if not a popular query
 * @returns Appropriate TTL in seconds
 */
export function getRecommendedTtl(query: string, defaultTtl: number = SEARCH_DEFAULT_TTL): number {
  if (!query) return defaultTtl;

  // Normalize query for consistency
  const normalizedQuery = query.trim().toLowerCase();

  // Get popularity data
  const popularity = queryPopularity[normalizedQuery];
  if (!popularity) return defaultTtl;

  // Determine TTL based on popularity thresholds
  if (popularity.count >= 20) {
    // High volume query (20+ hits) - 1 hour
    return SEARCH_HIGH_VOLUME_TTL;
  } else if (popularity.count >= 5) {
    // Popular query (5+ hits) - 30 minutes
    return SEARCH_POPULAR_TTL;
  }

  // Default TTL for less popular queries
  return defaultTtl;
}

/**
 * Update cache metrics for tracking
 * Completely separate from the core caching functionality
 * @param category - The category of operation (search, tabs, etc)
 * @param operation - The operation type (hit, miss, set)
 */
export function updateCacheMetrics(
  category: 'search' | 'tabs',
  operation: 'hit' | 'miss' | 'set'
): void {
  // Update category-specific metrics
  if (!metrics[category]) {
    metrics[category] = { hits: 0, misses: 0, sets: 0 };
  }

  // Map operation string to the corresponding property name in CacheMetrics
  let propertyName: keyof CacheMetrics;
  if (operation === 'hit') {
    propertyName = 'hits';
  } else if (operation === 'miss') {
    propertyName = 'misses';
  } else { // operation === 'set'
    propertyName = 'sets';
  }

  // Increment the appropriate counter
  metrics[category][propertyName] += 1;
  metrics.total[propertyName] += 1;

  // Log at DEBUG level
  log(`${category} ${operation} - Total: ${metrics[category][propertyName]}`, LogLevel.DEBUG);
}

/**
 * Get simple cache statistics including metrics
 * @returns Basic cache statistics
 */
export function getCacheHitRate(category: 'search' | 'tabs' | 'total' = 'total'): number | null {
  const categoryMetrics = metrics[category];
  if (!categoryMetrics) return null;

  const totalAccesses = categoryMetrics.hits + categoryMetrics.misses;
  if (totalAccesses === 0) return null;

  return (categoryMetrics.hits / totalAccesses) * 100;
}

/**
 * Get data from cache with optional metrics tracking
 * @param key - Cache key
 * @param options - Optional parameters including which metrics category to update
 * @returns Cached data or null if not found
 */
export async function getCachedData(
  key: string,
  options: {
    trackMetrics?: boolean;
    category?: 'search' | 'tabs';
    trackQuery?: string;
  } = {}
): Promise<any> {
  try {
    // Extract query from key for tracking if needed
    let query = '';
    if (options.trackQuery) {
      query = options.trackQuery;
    } else if (key.startsWith('search:')) {
      query = key.split(':')[1] || '';
    } else if (key.startsWith('tab:')) {
      query = key.split(':')[1] || '';
    }

    // Try Redis first if available
    if (redisClient) {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        // Cache hit - track metrics if requested
        if (options.trackMetrics && options.category) {
          updateCacheMetrics(options.category, 'hit');
        }

        // Track query popularity if we have a query
        if (query && options.trackMetrics) {
          trackQueryHit(query, 'hit');
        }

        log(`HIT for ${key}`, LogLevel.INFO);
        return JSON.parse(cachedData);
      }

      // Cache miss - track metrics if requested
      if (options.trackMetrics && options.category) {
        updateCacheMetrics(options.category, 'miss');
      }

      // Track query popularity for misses too
      if (query && options.trackMetrics) {
        trackQueryHit(query, 'miss');
      }

      log(`MISS for ${key}`, LogLevel.INFO);
      return null;
    }

    // Fall back to memory cache
    if (memoryCache.has(key)) {
      const { data, expiry } = memoryCache.get(key);
      if (expiry > Date.now()) {
        // Cache hit - track metrics if requested
        if (options.trackMetrics && options.category) {
          updateCacheMetrics(options.category, 'hit');
        }

        // Track query popularity if we have a query
        if (query && options.trackMetrics) {
          trackQueryHit(query, 'hit');
        }

        log(`HIT for ${key} (memory cache)`, LogLevel.INFO);
        return data;
      }

      // Expired data
      memoryCache.delete(key);
    }

    // Cache miss - track metrics if requested
    if (options.trackMetrics && options.category) {
      updateCacheMetrics(options.category, 'miss');
    }

    // Track query popularity for misses too
    if (query && options.trackMetrics) {
      trackQueryHit(query, 'miss');
    }

    log(`MISS for ${key} (memory cache)`, LogLevel.INFO);
    return null;
  } catch (error) {
    log(`Error retrieving from cache: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);
    return null;
  }
}

/**
 * Set data in cache with optional metrics tracking
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlSeconds - Time to live in seconds
 * @param options - Optional parameters including which metrics category to update
 * @returns Whether the operation was successful
 */
export async function setCachedData(
  key: string,
  data: any,
  ttlSeconds: number = DEFAULT_TTL,
  options: {
    trackMetrics?: boolean;
    category?: 'search' | 'tabs';
    trackQuery?: string;
  } = {}
): Promise<boolean> {
  try {
    // Extract query from key for tracking if needed
    let query = '';
    if (options.trackQuery) {
      query = options.trackQuery;
    } else if (key.startsWith('search:')) {
      query = key.split(':')[1] || '';
    } else if (key.startsWith('tab:')) {
      query = key.split(':')[1] || '';
    }

    const serializedData = JSON.stringify(data);

    // Try Redis first if available
    if (redisClient) {
      await redisClient.set(key, serializedData, 'EX', ttlSeconds);

      // Track metrics if requested
      if (options.trackMetrics && options.category) {
        updateCacheMetrics(options.category, 'set');
      }

      // Track query popularity if we have a query
      if (query && options.trackMetrics) {
        trackQueryHit(query, 'set');
      }

      log(`SET for ${key} with TTL ${ttlSeconds}s`, LogLevel.INFO);
      return true;
    }

    // Fall back to memory cache
    memoryCache.set(key, {
      data,
      expiry: Date.now() + (ttlSeconds * 1000)
    });

    // Track metrics if requested
    if (options.trackMetrics && options.category) {
      updateCacheMetrics(options.category, 'set');
    }

    // Track query popularity if we have a query
    if (query && options.trackMetrics) {
      trackQueryHit(query, 'set');
    }

    log(`SET for ${key} with TTL ${ttlSeconds}s (memory cache)`, LogLevel.INFO);
    return true;
  } catch (error) {
    log(`Cache set error: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);
    return false;
  }
}

/**
 * Clear cached data
 * @param key - Cache key (or prefix with * for pattern)
 * @returns Whether the operation was successful
 */
export async function clearCachedData(key: string): Promise<boolean> {
  try {
    // Clear from Redis if available
    if (redisClient) {
      if (key.includes('*')) {
        // Pattern delete
        const keys = await redisClient.keys(key);
        if (keys.length > 0) {
          await redisClient.del(keys);
          log(`Cleared ${keys.length} keys matching pattern: ${key}`, LogLevel.INFO);
        } else {
          log(`No keys found matching pattern: ${key}`, LogLevel.INFO);
        }
      } else {
        // Single key delete
        const result = await redisClient.del(key);
        log(`Cleared key: ${key}, result: ${result}`, LogLevel.INFO);
      }
      return true;
    }

    // Clear from memory cache
    if (key.includes('*')) {
      const pattern = new RegExp(key.replace('*', '.*'));
      let count = 0;
      for (const k of memoryCache.keys()) {
        if (pattern.test(k)) {
          memoryCache.delete(k);
          count++;
        }
      }
      log(`Cleared ${count} keys matching pattern: ${key} (memory cache)`, LogLevel.INFO);
    } else {
      memoryCache.delete(key);
      log(`Cleared key: ${key} (memory cache)`, LogLevel.INFO);
    }

    return true;
  } catch (error) {
    log(`Cache clear error: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);
    return false;
  }
}

/**
 * Generate a standard cache key for search results
 * @param query - Search query
 * @param collection - Collection name
 * @param profile - Profile name
 * @returns Formatted cache key
 */
export function generateSearchCacheKey(query: string, collection: string, profile: string): string {
  // Normalize for consistent keys
  const normalizedQuery = (query || '').trim().toLowerCase();
  const normalizedCollection = (collection || 'default').trim();
  const normalizedProfile = (profile || 'default').trim();

  return `search:${normalizedQuery}:${normalizedCollection}:${normalizedProfile}`;
}

/**
 * Generate a tab-specific cache key
 * @param query - Search query
 * @param collection - Collection name
 * @param profile - Profile name
 * @param tabId - Tab identifier
 * @returns Formatted tab cache key
 */
export function generateTabCacheKey(query: string, collection: string, profile: string, tabId: string): string {
  // Normalize for consistent keys
  const normalizedQuery = (query || '').trim().toLowerCase();
  const normalizedCollection = (collection || 'default').trim();
  const normalizedProfile = (profile || 'default').trim();
  const normalizedTabId = (tabId || 'default').trim();

  return `tab:${normalizedQuery}:${normalizedCollection}:${normalizedProfile}:${normalizedTabId}`;
}

/**
 * Get tab content from cache
 * @param query - Search query
 * @param collection - Collection name
 * @param profile - Profile name
 * @param tabId - Tab identifier
 * @returns Cached tab content or null if not found
 */
export async function getCachedTabContent(
  query: string,
  collection: string,
  profile: string,
  tabId: string
): Promise<any> {
  const cacheKey = generateTabCacheKey(query, collection, profile, tabId);
  return getCachedData(cacheKey, {
    trackMetrics: true,
    category: 'tabs',
    trackQuery: query
  });
}

/**
 * Set tab content in cache
 * @param query - Search query
 * @param collection - Collection name
 * @param profile - Profile name
 * @param tabId - Tab identifier
 * @param content - Tab content to cache
 * @param isPopular - Whether this is a popular tab (affects TTL)
 * @returns Whether the operation was successful
 */
export async function setCachedTabContent(
  query: string,
  collection: string,
  profile: string,
  tabId: string,
  content: any,
  isPopular: boolean = false
): Promise<boolean> {
  const cacheKey = generateTabCacheKey(query, collection, profile, tabId);
  const ttl = isPopular ? POPULAR_TAB_TTL : TAB_CONTENT_TTL;

  return setCachedData(cacheKey, content, ttl, {
    trackMetrics: true,
    category: 'tabs',
    trackQuery: query
  });
}

/**
 * Get search results from cache with metrics tracking
 * @param query - Search query
 * @param collection - Collection name
 * @param profile - Profile name
 * @returns Cached search results or null if not found
 */
export async function getCachedSearchResults(
  query: string,
  collection: string,
  profile: string
): Promise<any> {
  const cacheKey = generateSearchCacheKey(query, collection, profile);
  return getCachedData(cacheKey, {
    trackMetrics: true,
    category: 'search',
    trackQuery: query
  });
}

/**
 * Set search results in cache with metrics tracking
 * @param query - Search query
 * @param collection - Collection name
 * @param profile - Profile name
 * @param content - Search results to cache
 * @param ttlSeconds - Optional override for TTL in seconds
 * @returns Whether the operation was successful
 */
export async function setCachedSearchResults(
  query: string,
  collection: string,
  profile: string,
  content: any,
  ttlSeconds?: number
): Promise<boolean> {
  const cacheKey = generateSearchCacheKey(query, collection, profile);

  // If no TTL provided, use recommended TTL based on query popularity
  const ttl = ttlSeconds || getRecommendedTtl(query);

  return setCachedData(cacheKey, content, ttl, {
    trackMetrics: true,
    category: 'search',
    trackQuery: query
  });
}

/**
 * Clear all cached content for a specific query
 * @param query - Search query to clear cache for
 * @returns Whether the operation was successful
 */
export async function clearQueryCache(query: string): Promise<boolean> {
  // Normalize query for consistent pattern matching
  const normalizedQuery = query.trim().toLowerCase();

  return clearCachedData(`*:${normalizedQuery}:*`);
}

/**
 * Clear all cached tab content
 * @returns Whether the operation was successful
 */
export async function clearAllTabCache(): Promise<boolean> {
  return clearCachedData('tab:*');
}

/**
 * Check if search results exist in cache
 * @param query - Search query
 * @param collection - Collection name
 * @param profile - Profile name 
 * @returns Whether the cache entry exists
 */
export async function searchResultsExistInCache(
  query: string,
  collection: string,
  profile: string
): Promise<boolean> {
  const cacheKey = generateSearchCacheKey(query, collection, profile);

  try {
    if (redisClient) {
      const exists = await redisClient.exists(cacheKey);
      return exists === 1;
    }

    const exists = memoryCache.has(cacheKey);
    if (exists) {
      const { expiry } = memoryCache.get(cacheKey);
      return expiry > Date.now();
    }

    return false;
  } catch (error) {
    log(`Error checking cache existence: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);
    return false;
  }
}

/**
 * Get cache statistics
 * @returns Cache statistics object or null if error
 */
export async function getCacheStats(): Promise<any> {
  try {
    // Basic stats object
    const stats: any = {
      timestamp: new Date().toISOString(),
      metrics: { ...metrics },
      hitRates: {
        search: getCacheHitRate('search'),
        tabs: getCacheHitRate('tabs'),
        total: getCacheHitRate('total')
      },
      queryPopularity: {
        total: Object.keys(queryPopularity).length,
        popular: Object.keys(queryPopularity).filter(k =>
          queryPopularity[k].count >= 5 && queryPopularity[k].count < 20
        ).length,
        highVolume: Object.keys(queryPopularity).filter(k =>
          queryPopularity[k].count >= 20
        ).length
      },
      logLevel: {
        current: LogLevel[currentLogLevel],
        value: currentLogLevel
      }
    };

    if (!redisClient) {
      // For memory cache
      stats.memoryCache = {
        size: memoryCache.size,
        tabKeys: Array.from(memoryCache.keys()).filter(k => k.startsWith('tab:')).length,
        searchKeys: Array.from(memoryCache.keys()).filter(k => k.startsWith('search:')).length
      };

      return stats;
    }

    // For Redis, add info about Redis instance
    try {
      // Get Redis info for stats
      const info = await redisClient.info();

      // Parse key metrics
      const memoryMatch = info.match(/used_memory_human:(.+?)\r\n/);
      const connectedClients = info.match(/connected_clients:(.+?)\r\n/);
      const keyspaceHits = info.match(/keyspace_hits:(.+?)\r\n/);
      const keyspaceMisses = info.match(/keyspace_misses:(.+?)\r\n/);

      stats.redis = {
        available: true,
        memory: memoryMatch && memoryMatch[1] ? memoryMatch[1].trim() : 'unknown',
        clients: connectedClients && connectedClients[1] ? parseInt(connectedClients[1].trim()) : 'unknown',
        keyspaceHits: keyspaceHits && keyspaceHits[1] ? parseInt(keyspaceHits[1].trim()) : 0,
        keyspaceMisses: keyspaceMisses && keyspaceMisses[1] ? parseInt(keyspaceMisses[1].trim()) : 0,
        keyspaceHitRate: keyspaceHits && keyspaceMisses && keyspaceHits[1] && keyspaceMisses[1] ?
          (parseInt(keyspaceHits[1].trim()) / (parseInt(keyspaceHits[1].trim()) + parseInt(keyspaceMisses[1].trim()))) * 100 :
          null
      };

      // Get key counts by type
      const [keyCount, tabKeyCount, searchKeyCount] = await Promise.all([
        redisClient.dbsize(),
        redisClient.keys('tab:*').then(keys => keys.length),
        redisClient.keys('search:*').then(keys => keys.length)
      ]);

      stats.redis.keys = {
        total: keyCount,
        tabKeys: tabKeyCount,
        searchKeys: searchKeyCount
      };
    } catch (redisError) {
      stats.redis = {
        available: true,
        error: redisError instanceof Error ? redisError.message : 'Unknown Redis info error'
      };
    }

    return stats;
  } catch (error) {
    log(`Error getting cache stats: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);
    return null;
  }
}

/**
 * Get the current TTL for a cache key
 * @param key - The cache key
 * @returns The remaining TTL in seconds, or null if key doesn't exist or error
 */
export async function getKeyTTL(key: string): Promise<number | null> {
  try {
    if (redisClient) {
      const ttl = await redisClient.ttl(key);
      return ttl > 0 ? ttl : null;
    }

    if (memoryCache.has(key)) {
      const { expiry } = memoryCache.get(key);
      const now = Date.now();
      if (expiry > now) {
        return Math.round((expiry - now) / 1000);
      }
    }

    return null;
  } catch (error) {
    log(`Error getting key TTL: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);
    return null;
  }
}

// Health check method for Redis connection
export async function isRedisHealthy(): Promise<boolean> {
  try {
    if (!redisClient) return false;

    // Ping Redis to check connection
    const pong = await redisClient.ping();
    const isHealthy = pong === 'PONG';
    log(`Redis health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`, LogLevel.INFO);
    return isHealthy;
  } catch (error) {
    log(`Redis health check error: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);
    return false;
  }
}