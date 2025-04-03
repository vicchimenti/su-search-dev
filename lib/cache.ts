/**
 * @fileoverview Redis caching implementation
 * 
 * This module provides Redis caching functionality for the frontend API,
 * improving performance by caching API responses.
 *
 * @author Victor Chimenti
 * @version 1.1.0
 * last updated: 2025-04-02
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
export async function setCachedData(key: string, data: any, ttlSeconds: number = 3600): Promise<boolean> {
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