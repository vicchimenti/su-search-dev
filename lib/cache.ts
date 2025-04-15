/**
 * @fileoverview Enhanced Redis caching implementation
 * 
 * This module provides Redis caching functionality for the frontend API,
 * improving performance by caching API responses with timestamp awareness
 * and content-specific TTLs.
 *
 * @author Victor Chimenti
 * @version 2.0.0
 * last updated: 2025-04-15
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

// Interface for timestamped cache data
interface TimestampedData<T> {
  data: T;
  _timestamp: number;
}

/**
 * Add timestamp to data being cached
 * @param data - The data to timestamp
 * @returns Data with timestamp
 */
export function addTimestampToData<T>(data: T): TimestampedData<T> {
  return {
    data,
    _timestamp: Date.now()
  };
}

/**
 * Extract actual data from timestamped cache entry
 * @param timestampedData - Data with timestamp
 * @returns Original data
 */
export function extractDataFromTimestamped<T>(timestampedData: TimestampedData<T>): T {
  return timestampedData.data;
}

/**
 * Get data from cache
 * @param key - Cache key
 * @returns Cached data or null if not found
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
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
export async function setCachedData<T>(key: string, data: T, ttlSeconds: number = 3600): Promise<boolean> {
  try {
    // Add timestamp to data for freshness checking
    const timestampedData = addTimestampToData(data);
    const serializedData = JSON.stringify(timestampedData);
    
    // Try Redis first if available
    if (redisClient) {
      await redisClient.set(key, serializedData, 'EX', ttlSeconds);
      return true;
    }
    
    // Fall back to memory cache
    memoryCache.set(key, {
      data: timestampedData,
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
 * Get the timestamp of cached data
 * @param key - Cache key
 * @returns Timestamp of cached data or null if not found
 */
export async function getCacheTimestamp(key: string): Promise<number | null> {
  try {
    const cachedData = await getCachedData<TimestampedData<any>>(key);
    if (cachedData && cachedData._timestamp) {
      return cachedData._timestamp;
    }
    return null;
  } catch (error) {
    console.error('Error getting cache timestamp:', error);
    return null;
  }
}

/**
 * Determine TTL based on content type
 * @param contentType - The type of content
 * @param baseId - An identifier for more specific TTL determination
 * @returns Appropriate TTL in seconds
 */
export function getContentTypeSpecificTTL(contentType: string, baseId?: string): number {
  switch (contentType) {
    case 'staff':
      return 60 * 60 * 4; // 4 hours for staff directory
    case 'programs':
      return 60 * 60 * 2; // 2 hours for academic programs
    case 'events':
      return 60 * 5; // 5 minutes for events (frequently updated)
    case 'tabs':
      return 60 * 30; // 30 minutes for tab content
    case 'suggestions':
      return 60 * 15; // 15 minutes for suggestions
    case 'search':
    default:
      return 60 * 10; // 10 minutes default
  }
}

/**
 * Generate a standardized cache key
 * @param type - Type of content (search, suggestions, etc.)
 * @param params - Parameters for the key
 * @returns Standardized cache key
 */
export function generateCacheKey(type: string, params: Record<string, any>): string {
  // Extract key parameters
  const { query, collection, profile, tab, sessionId, ...otherParams } = params;
  
  // Build key components
  const keyParts = [
    type,
    query || 'no-query',
    collection || 'default',
    profile || 'default'
  ];
  
  // Add tab if present
  if (tab) {
    keyParts.push(`tab-${tab}`);
  }
  
  // Note: We exclude sessionId from cache keys to enable sharing across sessions
  
  // Add other params as a sorted string
  if (Object.keys(otherParams).length > 0) {
    const sortedParams = Object.entries(otherParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    
    if (sortedParams) {
      keyParts.push(sortedParams);
    }
  }
  
  return keyParts.join(':');
}

// Export the Redis client for direct access if needed
export { redisClient };