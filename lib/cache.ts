/**
 * @fileoverview Redis caching implementation
 * 
 * This module provides Redis caching functionality for the frontend API,
 * improving performance by caching API responses. Includes enhanced
 * support for tab content caching.
 *
 * @author Victor Chimenti
 * @version 2.0.0
 * @lastModified 2025-04-16
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

/**
 * Get data from cache
 * @param key - Cache key
 * @returns Cached data or null if not found
 */
export async function getCachedData(key: string): Promise<any> {
  try {
    // Try Redis first if available
    if (redisClient) {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      return null;
    }

    // Fall back to memory cache
    if (memoryCache.has(key)) {
      const { data, expiry } = memoryCache.get(key);
      if (expiry > Date.now()) {
        return data;
      }
      // Expired data
      memoryCache.delete(key);
    }

    return null;
  } catch (error) {
    console.error('Cache error:', error);
    return null;
  }
}

/**
 * Set data in cache
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlSeconds - Time to live in seconds
 * @returns Whether the operation was successful
 */
export async function setCachedData(key: string, data: any, ttlSeconds: number = DEFAULT_TTL): Promise<boolean> {
  try {
    const serializedData = JSON.stringify(data);

    // Try Redis first if available
    if (redisClient) {
      await redisClient.set(key, serializedData, 'EX', ttlSeconds);
      return true;
    }

    // Fall back to memory cache
    memoryCache.set(key, {
      data,
      expiry: Date.now() + (ttlSeconds * 1000)
    });

    return true;
  } catch (error) {
    console.error('Cache set error:', error);
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
        }
      } else {
        // Single key delete
        await redisClient.del(key);
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
    } else {
      memoryCache.delete(key);
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
  return `search:${query}:${collection || 'default'}:${profile || 'default'}`;
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
  return `tab:${query}:${collection || 'default'}:${profile || 'default'}:${tabId || 'default'}`;
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
  return getCachedData(cacheKey);
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

  return setCachedData(cacheKey, content, ttl);
}

/**
 * Clear all cached content for a specific query
 * @param query - Search query to clear cache for
 * @returns Whether the operation was successful
 */
export async function clearQueryCache(query: string): Promise<boolean> {
  return clearCachedData(`*:${query}:*`);
}

/**
 * Clear all cached tab content
 * @returns Whether the operation was successful
 */
export async function clearAllTabCache(): Promise<boolean> {
  return clearCachedData('tab:*');
}

/**
 * Get cache statistics
 * @returns Cache statistics object or null if error
 */
export async function getCacheStats(): Promise<any> {
  try {
    if (!redisClient) {
      // For memory cache
      return {
        cacheType: 'memory',
        keys: memoryCache.size,
        tabKeys: Array.from(memoryCache.keys()).filter(k => k.startsWith('tab:')).length,
        searchKeys: Array.from(memoryCache.keys()).filter(k => k.startsWith('search:')).length
      };
    }

    // For Redis
    const [keyCount, tabKeyCount, searchKeyCount] = await Promise.all([
      redisClient.dbsize(),
      redisClient.keys('tab:*').then(keys => keys.length),
      redisClient.keys('search:*').then(keys => keys.length)
    ]);

    return {
      cacheType: 'redis',
      keys: keyCount,
      tabKeys: tabKeyCount,
      searchKeys: searchKeyCount
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
}