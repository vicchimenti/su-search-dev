/**
 * @fileoverview Cache Check API Endpoint
 * 
 * This endpoint provides a lightweight mechanism to check if search results
 * for a specific query are already cached, without performing a full search.
 * It serves as the foundation for the cache-first approach in the search
 * optimization strategy.
 *
 * Features:
 * - Ultra-fast cache key generation matching main search
 * - Minimal payload responses with appropriate HTTP statuses
 * - Early returns for invalid queries and cache misses
 * - Integration with Redis cache and in-memory fallback
 * - Comprehensive logging with configurable levels
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 1.0.1
 * @lastModified 2025-05-07
 */

import { NextApiRequest, NextApiResponse } from 'next';
import {
    searchResultsExistInCache,
    generateSearchCacheKey,
    getKeyTTL,
    LogLevel,
    log as cacheLog
} from '../../lib/cache';

/**
 * Normalize a query string for consistent cache key generation
 * This function must match the client-side implementation in integration.js
 * 
 * @param query - The original query string
 * @returns Normalized query string
 */
function normalizeQuery(query: string): string {
    if (!query) return "";

    // Convert to lowercase
    let normalized = query.toLowerCase();

    // Remove extra whitespace
    normalized = normalized.trim().replace(/\s+/g, " ");

    // Remove certain special characters
    normalized = normalized.replace(/['"?!.,]/g, "");

    return normalized;
}

/**
 * Interface for cache check response
 */
interface CacheCheckResponse {
    exists: boolean;
    cacheKey?: string;
    ttl?: number;
    timestamp: number;
}

/**
 * Cache check API handler
 * Checks if search results exist in cache for the specified query
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 * @returns Promise resolving to API response
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<CacheCheckResponse>
): Promise<void> {
    // Start timing for performance logging
    const startTime = Date.now();

    // Only accept GET requests
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    try {
        // Extract query parameters
        const { query, collection, profile } = req.query;

        // Early return for missing query
        if (!query || typeof query !== 'string' || query.trim().length < 2) {
            cacheLog('Cache check rejected: Missing or invalid query', LogLevel.INFO);
            res.status(400).json({
                exists: false,
                timestamp: Date.now()
            });
            return;
        }

        // Normalize parameters
        const normalizedQuery = normalizeQuery(query);
        const normalizedCollection = typeof collection === 'string' ? collection : 'seattleu~sp-search';
        const normalizedProfile = typeof profile === 'string' ? profile : '_default';

        // Generate cache key matching main search
        const cacheKey = generateSearchCacheKey(normalizedQuery, normalizedCollection, normalizedProfile);

        // Check cache existence without retrieving full content
        const exists = await searchResultsExistInCache(
            normalizedQuery,
            normalizedCollection,
            normalizedProfile
        );

        // Performance tracking
        const processingTime = Date.now() - startTime;

        // Get TTL if exists
        let ttl: number | null = null;
        if (exists) {
            ttl = await getKeyTTL(cacheKey);
            cacheLog(`Cache HIT for ${cacheKey}, TTL: ${ttl || 'unknown'}, processing time: ${processingTime}ms`, LogLevel.INFO);
        } else {
            cacheLog(`Cache MISS for ${cacheKey}, processing time: ${processingTime}ms`, LogLevel.INFO);
        }

        // Set cache-related headers
        res.setHeader('X-Cache-Check-Time', processingTime.toString());
        res.setHeader('X-Cache-Status', exists ? 'HIT' : 'MISS');
        if (ttl) {
            res.setHeader('X-Cache-TTL', ttl.toString());
        }

        // For cache misses, use 404 status but with JSON response
        // This makes it easy to distinguish in client code
        if (!exists) {
            res.status(404).json({
                exists: false,
                timestamp: Date.now()
            });
            return;
        }

        // Return minimal response for cache hits
        res.status(200).json({
            exists: true,
            cacheKey,
            ttl: ttl || undefined,
            timestamp: Date.now()
        });
    } catch (error) {
        // Log error details with appropriate level
        cacheLog(`Cache check error: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);

        // Return error response
        res.status(500).json({
            exists: false,
            timestamp: Date.now()
        });
    }
}