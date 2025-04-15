/**
 * @fileoverview Cache Helper Functions
 * 
 * This module provides advanced caching utilities including
 * freshness checking, last-modified validation, and other
 * helper functions for the Seattle University search application.
 *
 * @author Victor Chimenti
 * @version 1.1.0
 * last updated: 2025-04-15
 */

import { getCachedData, setCachedData, extractDataFromTimestamped, addTimestampToData } from './cache';

/**
 * Interface for timestamped data
 */
export interface TimestampedData<T> {
  data: T;
  _timestamp: number;
}

/**
 * Check if cached data needs refresh based on Last-Modified header
 * @param cacheKey - The cache key
 * @param sourceUrl - The backend URL for freshness check
 * @returns Whether the cache needs refreshing
 */
export async function shouldRefreshCache(cacheKey: string, sourceUrl: string): Promise<boolean> {
  try {
    // Get current cached data
    const cachedData = await getCachedData<TimestampedData<any>>(cacheKey);
    
    // If no cached data, definitely need to fetch
    if (!cachedData) {
      return true;
    }
    
    // Check if the backend data is newer with a HEAD request
    const headResponse = await fetch(sourceUrl, { 
      method: 'HEAD',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!headResponse.ok) {
      console.warn(`HEAD request failed for ${sourceUrl}, using cached data`);
      return false; // Use cache on HEAD failure
    }
    
    const lastModified = headResponse.headers.get('last-modified');
    
    // If no last-modified header, use cache
    if (!lastModified) {
      return false;
    }
    
    // Compare last-modified with our cache timestamp
    const cachedTimestamp = cachedData._timestamp || 0;
    const serverTimestamp = new Date(lastModified).getTime();
    
    // Refresh if server data is newer
    return serverTimestamp > cachedTimestamp;
  } catch (error) {
    console.error('Error checking cache freshness:', error);
    // On error, use cached data if available
    return !cachedData; // Fixed: Using the negation of the result from getCachedData
  }
}

/**
 * Get from cache or fetch from source if needed
 * @param cacheKey - The cache key for the data
 * @param fetchFn - Function to fetch data if cache miss 
 * @param ttlSeconds - TTL for the cached data
 * @returns The data from cache or freshly fetched
 */
export async function getOrFetchData<T>(
  cacheKey: string, 
  fetchFn: () => Promise<T>, 
  ttlSeconds: number = 600
): Promise<T> {
  try {
    // Try to get from cache first
    const cachedData = await getCachedData<TimestampedData<T>>(cacheKey);
    
    // If we have cached data, return the actual data
    if (cachedData) {
      return extractDataFromTimestamped(cachedData);
    }
    
    // No cache hit, fetch fresh data
    const freshData = await fetchFn();
    
    // Cache the fresh data with timestamp
    const timestampedData = addTimestampToData(freshData);
    await setCachedData(cacheKey, timestampedData, ttlSeconds);
    
    return freshData;
  } catch (error) {
    console.error(`Cache helper error for ${cacheKey}:`, error);
    
    // If we have cached data, return it despite the error
    const cachedData = await getCachedData<TimestampedData<T>>(cacheKey);
    if (cachedData) {
      console.log(`Returning cached data for ${cacheKey} after fetch error`);
      return extractDataFromTimestamped(cachedData);
    }
    
    throw error; // Re-throw if we have no cached fallback
  }
}

/**
 * Creates cache key components from a URL
 * @param url - The URL to extract parameters from
 * @returns Object with extracted parameters
 */
export function extractParamsFromUrl(url: string): Record<string, string> {
  try {
    const urlObj = new URL(url, 'https://example.com');
    const params: Record<string, string> = {};
    
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    return params;
  } catch (error) {
    console.error('Error extracting params from URL:', error);
    return {};
  }
}

/**
 * Parse a cache key into its components
 * @param cacheKey - The cache key to parse
 * @returns Object containing the parsed components
 */
export function parseCacheKey(cacheKey: string): Record<string, string> {
  const parts = cacheKey.split(':');
  const result: Record<string, string> = {
    type: parts[0] || ''
  };
  
  if (parts.length > 1) result.query = parts[1];
  if (parts.length > 2) result.collection = parts[2];
  if (parts.length > 3) result.profile = parts[3];
  
  // Handle tab parameter if present
  const tabPart = parts.find(part => part.startsWith('tab-'));
  if (tabPart) {
    result.tab = tabPart.replace('tab-', '');
  }
  
  // Handle other parameters
  const otherParams = parts.find(part => part.includes('='));
  if (otherParams) {
    otherParams.split('&').forEach(param => {
      const [key, value] = param.split('=');
      if (key && value) {
        result[key] = value;
      }
    });
  }
  
  return result;
}

/**
 * Measure and log cache performance
 * @param cacheKey - The cache key
 * @param hit - Whether there was a cache hit
 */
export function logCachePerformance(cacheKey: string, hit: boolean): void {
  const components = parseCacheKey(cacheKey);
  const type = components.type || 'unknown';
  
  // Log cache hit/miss
  console.log(`Cache ${hit ? 'HIT' : 'MISS'} for ${type}: ${cacheKey}`);
  
  // You could implement more sophisticated telemetry here
  // such as sending metrics to a monitoring service
}

/**
 * Check if we should bypass cache for this request
 * @param params - Request parameters
 * @returns Whether to bypass cache
 */
export function shouldBypassCache(params: Record<string, any>): boolean {
  // Skip caching for requests with certain parameters
  
  // Skip caching for requests with cache=false
  if (params.cache === 'false') {
    return true;
  }
  
  // Skip caching for session-specific data
  if (params.personalResults === 'true') {
    return true;
  }
  
  // Skip caching for analytics
  if (params.type === 'analytics' || params.trackingOnly === 'true') {
    return true;
  }
  
  return false;
}