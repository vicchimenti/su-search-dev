/**
 * @fileoverview Enhanced Caching System Implementation
 * 
 * This module provides a robust caching mechanism for the search API,
 * with content validation, format detection, error handling, and 
 * optimal cache control for different content types.
 *
 * @author Victor Chimenti
 * @version 2.1.0
 * @lastModified 2025-04-16
 */

import Redis from 'ioredis';

// Initialize Redis client with failover options
const redisClient = (() => {
    const url = process.env.front_dev_REDIS_URL || process.env.REDIS_URL;
    if (!url) return null;

    try {
        return new Redis(url, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            connectTimeout: 10000,
            enableReadyCheck: true
        });
    } catch (e) {
        console.error('Redis connection error:', e);
        return null;
    }
})();

// Fallback in-memory cache for local development or Redis failures
const memoryCache = new Map();

// Cache response formats
export enum ResponseFormat {
    HTML = 'html',
    JSON = 'json',
    TEXT = 'text',
    UNKNOWN = 'unknown'
}

// Interface for timestamped and validated cache data
export interface EnhancedCacheData<T> {
    data: T;
    format: ResponseFormat;
    _timestamp: number;
    _validated: boolean;
    _etag?: string;
    _lastModified?: string;
}

/**
 * Add enhanced metadata to data being cached
 * @param data - The data to enhance
 * @param format - The format of the data
 * @param responseHeaders - Optional HTTP headers for additional metadata
 * @returns Enhanced data with metadata
 */
export function enhanceData<T>(
    data: T,
    format: ResponseFormat = ResponseFormat.UNKNOWN,
    responseHeaders?: Headers
): EnhancedCacheData<T> {
    const enhanced: EnhancedCacheData<T> = {
        data,
        format,
        _timestamp: Date.now(),
        _validated: true
    };

    if (responseHeaders) {
        const etag = responseHeaders.get('etag');
        const lastModified = responseHeaders.get('last-modified');

        if (etag) enhanced._etag = etag;
        if (lastModified) enhanced._lastModified = lastModified;
    }

    return enhanced;
}

/**
 * Extract actual data from enhanced cache entry
 * @param enhancedData - Data with metadata
 * @returns Original data
 */
export function extractData<T>(enhancedData: EnhancedCacheData<T>): T {
    return enhancedData.data;
}

/**
 * Detect the format of content
 * @param content - The content to analyze
 * @param contentType - Optional content type header
 * @returns Detected format
 */
export function detectFormat(content: any, contentType?: string): ResponseFormat {
    // Check content type header first
    if (contentType) {
        if (contentType.includes('text/html')) return ResponseFormat.HTML;
        if (contentType.includes('application/json')) return ResponseFormat.JSON;
        if (contentType.includes('text/plain')) return ResponseFormat.TEXT;
    }

    // Analyze content
    if (typeof content === 'string') {
        const trimmed = content.trim();

        // Check for JSON
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                JSON.parse(trimmed);
                return ResponseFormat.JSON;
            } catch (e) {
                // Not valid JSON
            }
        }

        // Check for HTML
        if (trimmed.startsWith('<!DOCTYPE html>') ||
            trimmed.startsWith('<html') ||
            (trimmed.includes('<') && trimmed.includes('</') && trimmed.includes('>'))) {
            return ResponseFormat.HTML;
        }

        // Default to TEXT
        return ResponseFormat.TEXT;
    }

    // If it's an object (already parsed)
    if (typeof content === 'object' && content !== null) {
        return ResponseFormat.JSON;
    }

    return ResponseFormat.UNKNOWN;
}

/**
 * Validate content is in the expected format
 * @param content - The content to validate
 * @param expectedFormat - The expected format
 * @returns Validated content (transformed if needed)
 */
export function validateContent(content: any, expectedFormat: ResponseFormat): any {
    const detectedFormat = detectFormat(content);

    // If formats match, return as is
    if (detectedFormat === expectedFormat) {
        return content;
    }

    // Handle format mismatches
    try {
        // Convert JSON string to object
        if (detectedFormat === ResponseFormat.JSON && expectedFormat === ResponseFormat.HTML) {
            if (typeof content === 'string') {
                const parsed = JSON.parse(content);

                // Look for HTML content in common JSON structures
                if (parsed.html) return parsed.html;
                if (parsed.data && typeof parsed.data === 'string') return parsed.data;
                if (parsed.content && typeof parsed.content === 'string') return parsed.content;

                // Create HTML representation
                return `<div class="json-data-warning">Unexpected JSON response received.</div>`;
            }
        }

        // Convert JSON object to HTML
        if (detectedFormat === ResponseFormat.JSON && typeof content === 'object') {
            // Look for HTML content in common JSON structures
            if (content.html) return content.html;
            if (content.data && typeof content.data === 'string') return content.data;
            if (content.content && typeof content.content === 'string') return content.content;
        }

        // Handle string with escape sequences
        if (typeof content === 'string') {
            return content
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
        }
    } catch (error) {
        console.error('Error validating content:', error);
    }

    // Return original content if transformation failed
    return content;
}

/**
 * Get data from cache with format validation
 * @param key - Cache key
 * @param expectedFormat - Expected format of the cached content
 * @returns Cached data or null if not found
 */
export async function getCachedData<T>(
    key: string,
    expectedFormat?: ResponseFormat
): Promise<T | null> {
    try {
        // Try Redis first if available
        if (redisClient) {
            const cachedData = await redisClient.get(key);
            if (cachedData) {
                const parsed = JSON.parse(cachedData) as EnhancedCacheData<T>;

                // Validate format if requested
                if (expectedFormat && parsed.format !== expectedFormat) {
                    parsed.data = validateContent(parsed.data, expectedFormat);
                    parsed._validated = true;
                }

                return parsed.data;
            }
            return null;
        }

        // Fall back to memory cache
        if (memoryCache.has(key)) {
            const { data, expiry, format } = memoryCache.get(key);
            if (expiry > Date.now()) {
                // Validate format if requested
                if (expectedFormat && format !== expectedFormat) {
                    return validateContent(data.data, expectedFormat);
                }
                return data.data;
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
 * Set data in cache with format detection and validation
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlSeconds - Time to live in seconds
 * @param format - Optional format of the data
 * @param responseHeaders - Optional HTTP headers for additional metadata
 * @returns Whether the operation was successful
 */
export async function setCachedData<T>(
    key: string,
    data: T,
    ttlSeconds: number = 3600,
    format?: ResponseFormat,
    responseHeaders?: Headers
): Promise<boolean> {
    try {
        // Auto-detect format if not provided
        const detectedFormat = format || detectFormat(data);

        // Add metadata to data for freshness checking
        const enhancedData = enhanceData(data, detectedFormat, responseHeaders);
        const serializedData = JSON.stringify(enhancedData);

        // Try Redis first if available
        if (redisClient) {
            await redisClient.set(key, serializedData, 'EX', ttlSeconds);
            return true;
        }

        // Fall back to memory cache
        memoryCache.set(key, {
            data: enhancedData,
            format: detectedFormat,
            expiry: Date.now() + (ttlSeconds * 1000)
        });

        return true;
    } catch (error) {
        console.error('Cache set error:', error);
        return false;
    }
}

/**
 * Set data in cache with specific hash field (for complex objects)
 * @param hashKey - The hash key
 * @param field - The field in the hash
 * @param data - Data to cache
 * @param ttlSeconds - Time to live in seconds
 * @returns Whether the operation was successful
 */
export async function setCachedHashField<T>(
    hashKey: string,
    field: string,
    data: T,
    ttlSeconds: number = 3600
): Promise<boolean> {
    try {
        // Only supported with Redis
        if (!redisClient) {
            return false;
        }

        // Add metadata and serialize
        const enhancedData = enhanceData(data);
        const serializedData = JSON.stringify(enhancedData);

        // Set hash field and expiry
        await redisClient.hset(hashKey, field, serializedData);
        await redisClient.expire(hashKey, ttlSeconds);

        return true;
    } catch (error) {
        console.error('Cache hash set error:', error);
        return false;
    }
}

/**
 * Get data from a hash field
 * @param hashKey - The hash key
 * @param field - The field in the hash
 * @returns The data or null if not found
 */
export async function getCachedHashField<T>(
    hashKey: string,
    field: string
): Promise<T | null> {
    try {
        // Only supported with Redis
        if (!redisClient) {
            return null;
        }

        const cachedData = await redisClient.hget(hashKey, field);
        if (!cachedData) {
            return null;
        }

        const parsed = JSON.parse(cachedData) as EnhancedCacheData<T>;
        return parsed.data;
    } catch (error) {
        console.error('Cache hash get error:', error);
        return null;
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
 * Get cache metadata for a key
 * @param key - Cache key
 * @returns Cache metadata or null if not found
 */
export async function getCacheMetadata(key: string): Promise<Partial<EnhancedCacheData<unknown>> | null> {
    try {
        // Try Redis first
        if (redisClient) {
            const cachedData = await redisClient.get(key);
            if (cachedData) {
                const parsed = JSON.parse(cachedData) as EnhancedCacheData<unknown>;
                // Return only metadata, not the actual data
                return {
                    format: parsed.format,
                    _timestamp: parsed._timestamp,
                    _validated: parsed._validated,
                    _etag: parsed._etag,
                    _lastModified: parsed._lastModified
                };
            }
        } else if (memoryCache.has(key)) {
            // Check memory cache
            const { data, expiry } = memoryCache.get(key);
            if (expiry > Date.now()) {
                return {
                    format: data.format,
                    _timestamp: data._timestamp,
                    _validated: data._validated,
                    _etag: data._etag,
                    _lastModified: data._lastModified
                };
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting cache metadata:', error);
        return null;
    }
}

/**
 * Check if cached data needs refresh based on conditional request headers
 * @param key - The cache key
 * @param fetchHeaders - Function to get headers for conditional request
 * @returns Whether the cache needs refreshing
 */
export async function shouldRefreshCache(
    key: string,
    fetchHeaders: () => Promise<Headers>
): Promise<boolean> {
    try {
        // Get cache metadata
        const metadata = await getCacheMetadata(key);

        // If no cached data, definitely need to fetch
        if (!metadata) {
            return true;
        }

        // Check if we have ETag or Last-Modified
        if (!metadata._etag && !metadata._lastModified) {
            // Use time-based expiry check
            const maxAge = 3600 * 1000; // 1 hour in milliseconds
            return Date.now() - (metadata._timestamp || 0) > maxAge;
        }

        // Get headers for conditional request
        const headers = await fetchHeaders();

        // Check ETag
        if (metadata._etag && headers.get('if-none-match') !== metadata._etag) {
            return true;
        }

        // Check Last-Modified
        if (metadata._lastModified && headers.get('if-modified-since') !== metadata._lastModified) {
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error checking cache freshness:', error);
        // On error, assume we need to refresh
        return true;
    }
}

/**
 * Determine appropriate TTL based on content type
 * @param contentType - The content type
 * @param query - Optional query for context-specific TTL
 * @returns Appropriate TTL in seconds
 */
export function getContentSpecificTTL(contentType: string, query?: string): number {
    // Base TTL values
    const TTL = {
        // Time-sensitive content
        REALTIME: 60, // 1 minute
        EVENTS: 60 * 5, // 5 minutes
        NEWS: 60 * 10, // 10 minutes

        // Standard content
        DEFAULT: 60 * 10, // 10 minutes
        SUGGESTIONS: 60 * 15, // 15 minutes
        TABS: 60 * 30, // 30 minutes

        // Relatively static content
        COURSES: 60 * 60, // 1 hour
        PROGRAMS: 60 * 60 * 2, // 2 hours
        STAFF: 60 * 60 * 4, // 4 hours
        LOCATIONS: 60 * 60 * 12, // 12 hours
        STATIC: 60 * 60 * 24 // 24 hours
    };

    // Normalize content type
    const normalizedType = contentType.toLowerCase();

    // First check content type
    if (normalizedType.includes('staff') || normalizedType.includes('faculty') || normalizedType.includes('directory')) {
        return TTL.STAFF;
    }

    if (normalizedType.includes('program') || normalizedType.includes('academic') || normalizedType.includes('degree')) {
        return TTL.PROGRAMS;
    }

    if (normalizedType.includes('event') || normalizedType.includes('calendar')) {
        return TTL.EVENTS;
    }

    if (normalizedType.includes('news') || normalizedType.includes('article')) {
        return TTL.NEWS;
    }

    if (normalizedType.includes('course') || normalizedType.includes('class')) {
        return TTL.COURSES;
    }

    if (normalizedType.includes('location') || normalizedType.includes('building') || normalizedType.includes('place')) {
        return TTL.LOCATIONS;
    }

    if (normalizedType.includes('tab')) {
        return TTL.TABS;
    }

    if (normalizedType.includes('suggestion')) {
        return TTL.SUGGESTIONS;
    }

    // Check query if provided for time-sensitive keywords
    if (query) {
        const normalizedQuery = query.toLowerCase();

        if (
            normalizedQuery.includes('today') ||
            normalizedQuery.includes('now') ||
            normalizedQuery.includes('current') ||
            normalizedQuery.includes('latest') ||
            normalizedQuery.includes('breaking')
        ) {
            return TTL.NEWS; // Time-sensitive query
        }
    }

    // Default TTL
    return TTL.DEFAULT;
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

    // Sanitize query to make it safer as a cache key
    const sanitizedQuery = query
        ? encodeURIComponent(query.toLowerCase().trim())
        : 'no-query';

    // Build key components
    const keyParts = [
        type,
        sanitizedQuery,
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

// Health check function to verify Redis connectivity
export async function checkCacheHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'offline',
    provider: 'redis' | 'memory' | 'none',
    details?: string
}> {
    try {
        if (redisClient) {
            // Check Redis connectivity
            const pong = await redisClient.ping();
            if (pong === 'PONG') {
                return {
                    status: 'healthy',
                    provider: 'redis'
                };
            } else {
                return {
                    status: 'degraded',
                    provider: 'memory',
                    details: 'Redis connected but not responding to PING'
                };
            }
        } else {
            // Using memory cache
            return {
                status: 'degraded',
                provider: 'memory',
                details: 'Using in-memory cache, no Redis connection'
            };
        }
    } catch (error: any) {
        console.error('Cache health check error:', error);
        return {
            status: 'offline',
            provider: 'none',
            details: `Cache error: ${error?.message || 'unknown error'}`
        };
    }
}

// Export Redis client for direct access if needed
export { redisClient };