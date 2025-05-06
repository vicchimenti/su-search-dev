/**
 * @fileoverview Search API with enhanced cache support
 * 
 * This API endpoint handles search requests with caching and tab-based content
 * management. It includes enhanced cache detection, status headers, and 
 * performance metrics tracking.
 *
 * @author Seattle University
 * @version 4.0.0
 * @lastModified 2025-05-06
 * @license MIT
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createApiClient } from '../../lib/api-client';
import {
  getCachedSearchResults,
  setCachedSearchResults,
  getSearchTTL,
  updateCacheMetrics,
  searchResultsExistInCache
} from '../../lib/cache';
import { getClientInfo } from '../../lib/ip-service';

// Set up CORS headers
const ALLOWED_ORIGINS = [
  'https://www.seattleu.edu',
  'https://seattleu.edu',
  'https://dev.seattleu.edu',
  'http://localhost:3000',
  'http://localhost:8000'
];

/**
 * Handle OPTIONS requests for CORS
 * @param res - NextApiResponse object
 */
function handleCorsOptions(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, X-Cache-Only');
  res.status(200).end();
}

/**
 * Set CORS headers for response
 * @param req - NextApiRequest object
 * @param res - NextApiResponse object
 */
function setCorsHeaders(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Allow any origin in development
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'https://www.seattleu.edu');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, X-Cache-Only');
}

/**
 * Add cache status headers to response
 * @param res - NextApiResponse object
 * @param cacheStatus - Cache status (HIT or MISS)
 * @param cachedAt - Timestamp when the content was cached
 * @param ttl - Time to live in seconds
 */
function addCacheHeaders(
  res: NextApiResponse,
  cacheStatus: 'HIT' | 'MISS',
  cachedAt?: number,
  ttl?: number
) {
  res.setHeader('X-Cache-Status', cacheStatus);

  if (cacheStatus === 'HIT' && cachedAt) {
    const now = Date.now();
    const ageSeconds = Math.floor((now - cachedAt) / 1000);
    res.setHeader('X-Cache-Age', String(ageSeconds));

    if (ttl) {
      const remainingTtl = Math.max(0, ttl - ageSeconds);
      res.setHeader('X-Cache-TTL-Remaining', String(remainingTtl));
    }
  }
}

/**
 * Search API handler
 * 
 * This endpoint handles search requests with tiered caching and enhanced 
 * metrics tracking.
 * 
 * @param req - NextApiRequest object
 * @param res - NextApiResponse object
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  setCorsHeaders(req, res);

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(res);
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    // Extract query parameters
    const {
      query = '',
      collection = 'seattleu~sp-search',
      profile = '_default',
      sessionId = ''
    } = req.query;

    // Validate query
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Check if we should only check cache (indicated by header)
    const cacheOnlyRequest = req.headers['x-cache-only'] === 'true';

    // Normalize collection and profile for consistent cache keys
    const normalizedCollection = Array.isArray(collection) ? collection[0] : collection;
    const normalizedProfile = Array.isArray(profile) ? profile[0] : profile;

    // Check if the search results are in cache
    if (cacheOnlyRequest) {
      const exists = await searchResultsExistInCache(
        query.toString(),
        normalizedCollection,
        normalizedProfile
      );

      if (exists) {
        // If just checking cache existence, return simplified response
        updateCacheMetrics('search', 'hit', query.toString());
        return res.status(200).json({
          cacheStatus: 'HIT',
          query: query.toString(),
          timestamp: Date.now()
        });
      } else {
        // Cache miss for check-only request
        updateCacheMetrics('search', 'miss', query.toString());
        return res.status(404).json({
          cacheStatus: 'MISS',
          query: query.toString(),
          timestamp: Date.now()
        });
      }
    }

    // Try to get from cache first
    const cachedResult = await getCachedSearchResults(
      query.toString(),
      normalizedCollection,
      normalizedProfile
    );

    if (cachedResult) {
      // Update the cache hit metric
      updateCacheMetrics('search', 'hit', query.toString());

      // Log cache hit in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SEARCH-API] Cache HIT for ${query} (age: ${Math.floor((Date.now() - cachedResult.timestamp) / 1000)}s)`);
      }

      // Add cache headers
      addCacheHeaders(res, 'HIT', cachedResult.timestamp, cachedResult.ttl);

      // Return cached data
      return res.status(200).send(cachedResult.data);
    }

    // Cache miss - update metric
    updateCacheMetrics('search', 'miss', query.toString());

    // Log cache miss in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SEARCH-API] Cache MISS for ${query}`);
    }

    // Add cache miss header
    addCacheHeaders(res, 'MISS');

    // Get client info for analytics
    const clientInfo = await getClientInfo(req.headers);

    // Configure API client with IP forwarding
    const apiClient = createApiClient(req.headers);

    // Start backend request timing
    const backendStartTime = Date.now();

    // Forward request to backend search API
    const response = await apiClient.get('/funnelback/search', {
      params: {
        query,
        collection: normalizedCollection,
        profile: normalizedProfile,
        sessionId: Array.isArray(sessionId) ? sessionId[0] : sessionId,
        clientIp: clientInfo?.ip || '',
      }
    });

    // Calculate backend timing
    const backendTime = Date.now() - backendStartTime;

    // Cache the results
    const ttl = getSearchTTL(query.toString());
    await setCachedSearchResults(
      query.toString(),
      normalizedCollection,
      normalizedProfile,
      response.data
    );

    // Log successful cache in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SEARCH-API] Cached results for ${query} with TTL ${ttl}s (backend time: ${backendTime}ms)`);
    }

    // Add timing header
    res.setHeader('X-Backend-Time', String(backendTime));

    // Return the search results
    res.status(200).send(response.data);
  } catch (error) {
    console.error('[SEARCH-API] Error:', error);

    // Return error response
    res.status(500).json({
      error: 'Failed to process search request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    // Log total request time in development
    if (process.env.NODE_ENV === 'development') {
      const totalTime = Date.now() - startTime;
      console.log(`[SEARCH-API] Total request time: ${totalTime}ms`);
    }
  }
}