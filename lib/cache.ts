/**
 * @fileoverview Redis caching implementation
 * 
 * This module provides Redis caching functionality for the frontend API,
 * improving performance by caching API responses. Includes enhanced
 * support for tab content caching, metrics tracking, and tiered TTL based
 * on query popularity.
 *
 * @author Victor Chimenti
 * @version 3.0.1
 * @lastModified 2025-05-06
 * @license MIT
 */

import Redis from 'ioredis';

// Initialize Redis client
const redisClient = process.env.front_dev_REDIS_URL
  ? new Redis(process.env.front_dev_REDIS_URL)
  : process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : null;

// Fallback in-memory cache for local development
const memoryCache = new Map();

// Default TTL values (in seconds)
const DEFAULT_TTL = 3600; // 1 hour
const TAB_CONTENT_TTL = 1800; // 30 minutes
const POPULAR_TAB_TTL = 7200; // 2 hours
const SEARCH_DEFAULT_TTL = 600; // 10 minutes
const SEARCH_POPULAR_TTL = 1800; // 30 minutes
const SEARCH_HIGH_VOLUME_TTL = 3600; // 1 hour
const SUGGESTIONS_TTL = 300; // 5 minutes

// Cache metrics tracking
interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
  lastHitTimestamp?: number;
  lastMissTimestamp?: number;
  lastSetTimestamp?: number;
  lastError?: string;
  lastErrorTimestamp?: number;
}

// Global metrics object
const cacheMetrics: Record<string, CacheMetrics> = {
  search: { hits: 0, misses: 0, sets: 0, errors: 0 },
  tabs: { hits: 0, misses: 0, sets: 0, errors: 0 },
  suggestions: { hits: 0, misses: 0, sets: 0, errors: 0 },
  prefetch: { hits: 0, misses: 0, sets: 0, errors: 0 },
};

// Popularity tracking for queries
interface QueryPopularity {
  count: number;
  lastAccessed: number;
}

// In-memory store for query popularity (avoid Redis overhead for this)
const queryPopularity: Record<string, QueryPopularity> = {};

// Set a refresh interval to clean up stale popularity data (every hour)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

    Object.keys(queryPopularity).forEach(key => {
      if (now - queryPopularity[key].lastAccessed > staleThreshold) {
        delete queryPopularity[key];
      }
    });
  }, 60 * 60 * 1000); // Run every hour
}

/**
 * Track a query for popularity metrics
 * @param query - The normalized query string
 * @param type - The type of cache operation (hit, miss, set)
 */
export function trackQueryPopularity(query: string, type: 'hit' | 'miss' | 'set'): void {
  if (!query) return;

  // Normalize query for consistent tracking
  const normalizedQuery = query.trim().toLowerCase();

  // Initialize if not exists
  if (!queryPopularity[normalizedQuery]) {
    queryPopularity[normalizedQuery] = {
      count: 0,
      lastAccessed: Date.now()
    };
  }

  // Update stats
  queryPopularity[normalizedQuery].count++;
  queryPopularity[normalizedQuery].lastAccessed = Date.now();

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[CACHE-METRICS] Query popularity for "${normalizedQuery}": ${queryPopularity[normalizedQuery].count} (${type})`);
  }
}

/**
 * Determine if a query is popular or high volume
 * @param query - The query to check
 * @returns The popularity level (default, popular, high_volume)
 */
export function getQueryPopularityLevel(query: string): 'default' | 'popular' | 'high_volume' {
  if (!query) return 'default';

  const normalizedQuery = query.trim().toLowerCase();
  const queryStats = queryPopularity[normalizedQuery];

  if (!queryStats) return 'default';

  // Define thresholds
  const popularThreshold = 5; // 5+ accesses makes a query "popular"
  const highVolumeThreshold = 20; // 20+ accesses makes a query "high volume"

  if (queryStats.count >= highVolumeThreshold) {
    return 'high_volume';
  } else if (queryStats.count >= popularThreshold) {
    return 'popular';
  }

  return 'default';
}

/**
 * Get TTL for search results based on query popularity
 * @param query - The search query
 * @param defaultTTL - Optional default TTL to use if not specified
 * @returns Appropriate TTL in seconds
 */
export function getSearchTTL(query: string, defaultTTL: number = SEARCH_DEFAULT_TTL): number {
  const popularityLevel = getQueryPopularityLevel(query);

  switch (popularityLevel) {
    case 'high_volume':
      return SEARCH_HIGH_VOLUME_TTL;
    case 'popular':
      return SEARCH_POPULAR_TTL;
    default:
      return defaultTTL;
  }
}

/**
 * Update cache metrics for a specific operation
 * @param type - Cache type (search, tabs, suggestions, prefetch)
 * @param operation - Operation type (hit, miss, set, error)
 * @param details - Optional details about the operation
 */
export function updateCacheMetrics(
  type: 'search' | 'tabs' | 'suggestions' | 'prefetch',
  operation: 'hit' | 'miss' | 'set' | 'error',
  details?: string
): void {
  // Initialize if not exists
  if (!cacheMetrics[type]) {
    cacheMetrics[type] = { hits: 0, misses: 0, sets: 0, errors: 0 };
  }

  // Update appropriate counter
  switch (operation) {
    case 'hit':
      cacheMetrics[type].hits++;
      cacheMetrics[type].lastHitTimestamp = Date.now();
      break;
    case 'miss':
      cacheMetrics[type].misses++;
      cacheMetrics[type].lastMissTimestamp = Date.now();
      break;
    case 'set':
      cacheMetrics[type].sets++;
      cacheMetrics[type].lastSetTimestamp = Date.now();
      break;
    case 'error':
      cacheMetrics[type].errors++;
      cacheMetrics[type].lastError = details || 'Unknown error';
      cacheMetrics[type].lastErrorTimestamp = Date.now();
      break;
  }

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[CACHE-METRICS] ${type.toUpperCase()} ${operation.toUpperCase()}${details ? `: ${details}` : ''}`);
  }
}

/**
 * Calculate cache hit rate for a specific cache type
 * @param type - Cache type to calculate hit rate for
 * @returns Hit rate as a percentage, or null if no data
 */
export function getCacheHitRate(type: 'search' | 'tabs' | 'suggestions' | 'prefetch'): number | null {
  const metrics = cacheMetrics[type];

  if (!metrics) return null;

  const totalAccesses = metrics.hits + metrics.misses;
  if (totalAccesses === 0) return null;

  return (metrics.hits / totalAccesses) * 100;
}

/**
 * Get detailed cache stats
 * @returns Object with cache statistics and metrics
 */
export async function getCacheStats(): Promise<any> {
  try {
    // Basic stats for each cache type
    const stats: any = {
      timestamp: new Date().toISOString(),
      metrics: { ...cacheMetrics },
      hitRates: {
        search: getCacheHitRate('search'),
        tabs: getCacheHitRate('tabs'),
        suggestions: getCacheHitRate('suggestions'),
        prefetch: getCacheHitRate('prefetch'),
      },
      queryPopularity: {
        total: Object.keys(queryPopularity).length,
        popular: Object.keys(queryPopularity).filter(
          key => getQueryPopularityLevel(key) === 'popular'
        ).length,
        highVolume: Object.keys(queryPopularity).filter(
          key => getQueryPopularityLevel(key) === 'high_volume'
        ).length
      }
    };

    // Add Redis stats if available
    if (redisClient) {
      try {
        // Get Redis info
        const info = await redisClient.info();

        // Parse relevant metrics
        const memoryMatch = info.match(/used_memory_human:(.+?)\r\n/);
        const connectedClients = info.match(/connected_clients:(.+?)\r\n/);
        const keyspaceHits = info.match(/keyspace_hits:(.+?)\r\n/);
        const keyspaceMisses = info.match(/keyspace_misses:(.+?)\r\n/);

        stats.redis = {
          available: true,
          memory: memoryMatch ? memoryMatch[1].trim() : 'unknown',
          clients: connectedClients ? parseInt(connectedClients[1].trim()) : 'unknown',
          keyspaceHits: keyspaceHits ? parseInt(keyspaceHits[1].trim()) : 0,
          keyspaceMisses: keyspaceMisses ? parseInt(keyspaceMisses[1].trim()) : 0,
          keyspaceHitRate: keyspaceHits && keyspaceMisses ?
            (parseInt(keyspaceHits[1].trim()) / (parseInt(keyspaceHits[1].trim()) + parseInt(keyspaceMisses[1].trim()))) * 100 :
            null
        };

        // Get key counts by type
        const searchKeys = await redisClient.keys('search:*');
        const tabKeys = await redisClient.keys('tab:*');
        const suggestionKeys = await redisClient.keys('suggestion:*');

        stats.redis.keys = {
          total: await redisClient.dbsize(),
          search: searchKeys.length,
          tabs: tabKeys.length,
          suggestions: suggestionKeys.length
        };
      } catch (error) {
        stats.redis = {
          available: true,
          error: error instanceof Error ? error.message : 'Unknown Redis info error'
        };
      }
    } else {
      // Memory cache stats
      stats.memoryCache = {
        size: memoryCache.size,
        searchKeys: Array.from(memoryCache.keys()).filter(k => k.startsWith('search:')).length,
        tabKeys: Array.from(memoryCache.keys()).filter(k => k.startsWith('tab:')).length,
        suggestionKeys: Array.from(memoryCache.keys()).filter(k => k.startsWith('suggestion:')).length
      };
    }

    return stats;
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error getting cache stats',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Add timestamp and ttl information to cache entry
 * @param data - Data to cache
 * @param ttlSeconds - TTL in seconds
 * @returns Enhanced cache entry
 */
function enhanceCacheEntry(data: any, ttlSeconds: number): any {
  return {
    data,
    timestamp: Date.now(),
    expires: Date.now() + (ttlSeconds * 1000),
    ttl: ttlSeconds
  };
}

/**
 * Get data from cache
 * @param key - Cache key
 * @param cacheType - Type of cached content (for metrics)
 * @returns Cached data or null if not found
 */
export async function getCachedData(
  key: string,
  cacheType: 'search' | 'tabs' | 'suggestions' | 'prefetch' = 'search'
): Promise<any> {
  try {
    // Extract query from key for popularity tracking
    let query = '';
    if (key.startsWith('search:')) {
      query = key.split(':')[1] || '';
    } else if (key.startsWith('tab:')) {
      query = key.split(':')[1] || '';
    }

    // Try Redis first if available
    if (redisClient) {
      const cachedData = await redisClient.get(key);

      if (cachedData) {
        // Update metrics
        updateCacheMetrics(cacheType, 'hit', key);
        if (query) trackQueryPopularity(query, 'hit');

        // Parse and return the data
        const parsedData = JSON.parse(cachedData);

        // Check if data includes timestamp info
        if (parsedData.timestamp && parsedData.data) {
          // Calculate age in seconds
          const ageSeconds = Math.floor((Date.now() - parsedData.timestamp) / 1000);

          // Log age in development
          if (process.env.NODE_ENV === 'development') {
            console.log(`[CACHE] HIT for ${key} (age: ${ageSeconds}s)`);
          }

          return parsedData;
        }

        // If old format (direct data), add metadata
        return enhanceCacheEntry(parsedData, DEFAULT_TTL);
      }

      // Cache miss
      updateCacheMetrics(cacheType, 'miss', key);
      if (query) trackQueryPopularity(query, 'miss');

      if (process.env.NODE_ENV === 'development') {
        console.log(`[CACHE] MISS for ${key}`);
      }

      return null;
    }

    // Fall back to memory cache
    if (memoryCache.has(key)) {
      const { data, expiry, timestamp } = memoryCache.get(key);

      if (expiry > Date.now()) {
        // Cache hit
        updateCacheMetrics(cacheType, 'hit', key);
        if (query) trackQueryPopularity(query, 'hit');

        // Calculate age in seconds
        const ageSeconds = Math.floor((Date.now() - timestamp) / 1000);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[CACHE] HIT for ${key} (age: ${ageSeconds}s, memory cache)`);
        }

        return {
          data,
          timestamp,
          expires: expiry,
          ttl: Math.floor((expiry - timestamp) / 1000)
        };
      }

      // Expired data
      memoryCache.delete(key);
    }

    // Cache miss
    updateCacheMetrics(cacheType, 'miss', key);
    if (query) trackQueryPopularity(query, 'miss');

    if (process.env.NODE_ENV === 'development') {
      console.log(`[CACHE] MISS for ${key} (memory cache)`);
    }

    return null;
  } catch (error) {
    // Log error and update metrics
    console.error('Cache error:', error);
    updateCacheMetrics(cacheType, 'error', error instanceof Error ? error.message : 'Unknown error');

    return null;
  }
}

/**
 * Set data in cache
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlSeconds - Time to live in seconds
 * @param cacheType - Type of cached content (for metrics)
 * @returns Whether the operation was successful
 */
export async function setCachedData(
  key: string,
  data: any,
  ttlSeconds: number = DEFAULT_TTL,
  cacheType: 'search' | 'tabs' | 'suggestions' | 'prefetch' = 'search'
): Promise<boolean> {
  try {
    // Extract query from key for popularity tracking
    let query = '';
    if (key.startsWith('search:')) {
      query = key.split(':')[1] || '';
    } else if (key.startsWith('tab:')) {
      query = key.split(':')[1] || '';
    }

    // Create enhanced cache entry with metadata
    const cacheEntry = enhanceCacheEntry(data, ttlSeconds);
    const serializedData = JSON.stringify(cacheEntry);

    // Try Redis first if available
    if (redisClient) {
      await redisClient.set(key, serializedData, 'EX', ttlSeconds);

      // Update metrics
      updateCacheMetrics(cacheType, 'set', key);
      if (query) trackQueryPopularity(query, 'set');

      if (process.env.NODE_ENV === 'development') {
        console.log(`[CACHE] SET for ${key} (TTL: ${ttlSeconds}s)`);
      }

      return true;
    }

    // Fall back to memory cache
    memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + (ttlSeconds * 1000)
    });

    // Update metrics
    updateCacheMetrics(cacheType, 'set', key);
    if (query) trackQueryPopularity(query, 'set');

    if (process.env.NODE_ENV === 'development') {
      console.log(`[CACHE] SET for ${key} (TTL: ${ttlSeconds}s, memory cache)`);
    }

    return true;
  } catch (error) {
    // Log error and update metrics
    console.error('Cache set error:', error);
    updateCacheMetrics(cacheType, 'error', error instanceof Error ? error.message : 'Unknown error');

    return false;
  }
}

/**
 * Check if a cache entry exists without retrieving the full content
 * This is more efficient than getCachedData for existence checks
 * 
 * @param key - Cache key to check
 * @returns Whether the key exists in cache
 */
export async function cacheKeyExists(key: string): Promise<boolean> {
  try {
    // Try Redis first if available
    if (redisClient) {
      const exists = await redisClient.exists(key);
      return exists === 1;
    }

    // Fall back to memory cache
    if (memoryCache.has(key)) {
      const { expiry } = memoryCache.get(key);

      // Check if expired
      if (expiry > Date.now()) {
        return true;
      }

      // Remove expired entry
      memoryCache.delete(key);
    }

    return false;
  } catch (error) {
    console.error('Cache exists error:', error);
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

          if (process.env.NODE_ENV === 'development') {
            console.log(`[CACHE] CLEAR for pattern ${key} (${keys.length} keys)`);
          }
        }
      } else {
        // Single key delete
        await redisClient.del(key);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[CACHE] CLEAR for key ${key}`);
        }
      }
      return true;
    }

    // Clear from memory cache
    if (key.includes('*')) {
      const pattern = new RegExp(key.replace('*', '.*'));
      for (const k of memoryCache.keys()) {
        if (pattern.test(k)) {
          memoryCache.delete(k);
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[CACHE] CLEAR for pattern ${key} (memory cache)`);
      }
    } else {
      memoryCache.delete(key);

      if (process.env.NODE_ENV === 'development') {
        console.log(`[CACHE] CLEAR for key ${key} (memory cache)`);
      }
    }

    return true;
  } catch (error) {
    console.error('Cache clear error:', error);
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
  // Normalize inputs for consistent key generation
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
  // Normalize inputs for consistent key generation
  const normalizedQuery = (query || '').trim().toLowerCase();
  const normalizedCollection = (collection || 'default').trim();
  const normalizedProfile = (profile || 'default').trim();
  const normalizedTabId = (tabId || 'default').trim();

  return `tab:${normalizedQuery}:${normalizedCollection}:${normalizedProfile}:${normalizedTabId}`;
}

/**
 * Generate a suggestion-specific cache key
 * @param query - Search query
 * @returns Formatted suggestions cache key
 */
export function generateSuggestionsCacheKey(query: string): string {
  // Normalize query for consistent key generation
  const normalizedQuery = (query || '').trim().toLowerCase();

  return `suggestion:${normalizedQuery}`;
}

/**
 * Get search results from cache
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
  return getCachedData(cacheKey, 'search');
}

/**
 * Set search results in cache
 * @param query - Search query
 * @param collection - Collection name
 * @param profile - Profile name
 * @param content - Search results to cache
 * @returns Whether the operation was successful
 */
export async function setCachedSearchResults(
  query: string,
  collection: string,
  profile: string,
  content: any
): Promise<boolean> {
  const cacheKey = generateSearchCacheKey(query, collection, profile);

  // Determine appropriate TTL based on query popularity
  const ttl = getSearchTTL(query);

  return setCachedData(cacheKey, content, ttl, 'search');
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
  return getCachedData(cacheKey, 'tabs');
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

  return setCachedData(cacheKey, content, ttl, 'tabs');
}

/**
 * Get suggestions from cache
 * @param query - Search query for suggestions
 * @returns Cached suggestions or null if not found
 */
export async function getCachedSuggestions(query: string): Promise<any> {
  const cacheKey = generateSuggestionsCacheKey(query);
  return getCachedData(cacheKey, 'suggestions');
}

/**
 * Set suggestions in cache
 * @param query - Search query
 * @param suggestions - Suggestions data to cache
 * @returns Whether the operation was successful
 */
export async function setCachedSuggestions(
  query: string,
  suggestions: any
): Promise<boolean> {
  const cacheKey = generateSuggestionsCacheKey(query);
  return setCachedData(cacheKey, suggestions, SUGGESTIONS_TTL, 'suggestions');
}

/**
 * Clear all cached content for a specific query
 * @param query - Search query to clear cache for
 * @returns Whether the operation was successful
 */
export async function clearQueryCache(query: string): Promise<boolean> {
  // Normalize query for consistent pattern matching
  const normalizedQuery = (query || '').trim().toLowerCase();

  // Clear search results for this query
  await clearCachedData(`*:${normalizedQuery}:*`);

  // Also clear exact match for suggestions
  await clearCachedData(`suggestion:${normalizedQuery}`);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[CACHE] Cleared all cache entries for query: ${normalizedQuery}`);
  }

  return true;
}

/**
 * Clear all cached tab content
 * @returns Whether the operation was successful
 */
export async function clearAllTabCache(): Promise<boolean> {
  return clearCachedData('tab:*');
}

/**
 * Clear all cached search results
 * @returns Whether the operation was successful
 */
export async function clearAllSearchCache(): Promise<boolean> {
  return clearCachedData('search:*');
}

/**
 * Check if search results exist in cache without retrieving content
 * @param query - Search query
 * @param collection - Collection name
 * @param profile - Profile name
 * @returns Whether results exist in cache
 */
export async function searchResultsExistInCache(
  query: string,
  collection: string,
  profile: string
): Promise<boolean> {
  const cacheKey = generateSearchCacheKey(query, collection, profile);
  return cacheKeyExists(cacheKey);
}

/**
 * Check if tab content exists in cache without retrieving content
 * @param query - Search query
 * @param collection - Collection name
 * @param profile - Profile name
 * @param tabId - Tab identifier
 * @returns Whether tab content exists in cache
 */
export async function tabContentExistsInCache(
  query: string,
  collection: string,
  profile: string,
  tabId: string
): Promise<boolean> {
  const cacheKey = generateTabCacheKey(query, collection, profile, tabId);
  return cacheKeyExists(cacheKey);
}

/**
 * Check if suggestions exist in cache without retrieving content
 * @param query - Search query
 * @returns Whether suggestions exist in cache
 */
export async function suggestionsExistInCache(query: string): Promise<boolean> {
  const cacheKey = generateSuggestionsCacheKey(query);
  return cacheKeyExists(cacheKey);
}

// Health check method for Redis connection
export async function isRedisHealthy(): Promise<boolean> {
  try {
    if (!redisClient) return false;

    // Ping Redis to check connection
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error('Redis health check error:', error);
    return false;
  }
}