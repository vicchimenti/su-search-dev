/**
 * @fileoverview Predictive Search Prefetch API Endpoint
 * 
 * This API endpoint provides a non-blocking way to prefetch and cache search results
 * before the user submits a search query. It works by accepting search
 * queries during typing, initiating a backend search request, and storing the
 * results in Redis cache for later fast retrieval.
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 1.0.0
 * @lastModified 2025-05-06
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createApiClient } from '../../lib/api-client';
import { setCachedData, generateSearchCacheKey } from '../../lib/cache';
import { getClientInfo } from '../../lib/ip-service';

// Define response type
type PrefetchResponse = {
  status: string;
  cacheKey?: string;
  message: string;
  query?: string;
  error?: string;
};

/**
 * Predictive search prefetch handler
 * 
 * This endpoint receives search queries during typing and caches the results
 * in Redis for fast retrieval when the user actually submits the search.
 * It's designed to be non-blocking and returns quickly while the caching
 * happens asynchronously in the background.
 * 
 * @param req - The Next.js API request
 * @param res - The Next.js API response
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PrefetchResponse>
) {
  // Set CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Prefetch-Request, X-Requested-With');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }
  
  const startTime = Date.now();
  const { 
    query = '', 
    collection = 'seattleu~sp-search',
    profile = '_default',
    sessionId = '',
    ttl
  } = req.query;
  
  // Basic validation
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Query parameter is required' 
    });
  }
  
  // Normalize the query string
  const normalizedQuery = query.trim().toLowerCase();
  
  try {
    // Log the prefetch request (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PREFETCH-API] Prefetch request for query: ${normalizedQuery}`);
    }
    
    // Resolve client information for accurate analytics
    const clientInfo = await getClientInfo(req.headers);
    
    // Generate standard cache key
    const cacheKey = generateSearchCacheKey(
      normalizedQuery,
      Array.isArray(collection) ? collection[0] : collection,
      Array.isArray(profile) ? profile[0] : profile
    );
    
    // Store prefetch information for metrics
    const prefetchData = {
      timestamp: new Date().toISOString(),
      query: normalizedQuery,
      clientIp: clientInfo?.ip || null,
      sessionId: Array.isArray(sessionId) ? sessionId[0] : sessionId,
      cacheKey
    };
    
    // Determine cache TTL (Time To Live)
    // Default is 5 minutes, but can be configured via query parameter
    const cacheTTL = ttl 
      ? parseInt(Array.isArray(ttl) ? ttl[0] : ttl, 10) 
      : 300; // 5 minutes default
      
    // Create a copy of the headers to modify
    const headers = { ...req.headers };
    
    // Create API client with client IP forwarding
    const apiClient = createApiClient(headers);
    
    // Use a non-blocking approach - fire and forget the backend request
    // This allows us to return immediately to the client while caching happens
    apiClient.get('/funnelback/search', {
      params: {
        query: normalizedQuery,
        collection: Array.isArray(collection) ? collection[0] : collection,
        profile: Array.isArray(profile) ? profile[0] : profile,
        sessionId: Array.isArray(sessionId) ? sessionId[0] : sessionId,
        prefetch: 'true',
        clientIp: clientInfo?.ip || ''
      }
    })
    .then(response => {
      if (response.status === 200) {
        // Cache the result with the specified TTL
        setCachedData(cacheKey, response.data, cacheTTL)
          .then(success => {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[PREFETCH-API] Cache result for ${cacheKey}: ${success ? 'Success' : 'Failed'}`);
            }
            
            // Track prefetch metrics
            trackPrefetchMetrics({ 
              ...prefetchData, 
              success, 
              responseTime: Date.now() - startTime,
              cached: true
            });
          })
          .catch(cacheError => {
            console.error('[PREFETCH-API] Cache error:', cacheError);
            
            // Track error in metrics
            trackPrefetchMetrics({ 
              ...prefetchData, 
              success: false, 
              responseTime: Date.now() - startTime,
              error: 'cache_error'
            });
          });
      } else {
        console.warn(`[PREFETCH-API] Backend returned non-200 status: ${response.status}`);
        
        // Track non-200 response in metrics
        trackPrefetchMetrics({ 
          ...prefetchData, 
          success: false, 
          responseTime: Date.now() - startTime,
          error: `status_${response.status}`
        });
      }
    })
    .catch(error => {
      console.error('[PREFETCH-API] Backend request error:', error.message);
      
      // Track error in metrics
      trackPrefetchMetrics({ 
        ...prefetchData, 
        success: false, 
        responseTime: Date.now() - startTime,
        error: 'backend_error'
      });
    });
    
    // Return immediately with accepted status
    // The caching will continue in the background
    return res.status(202).json({ 
      status: 'accepted',
      cacheKey,
      query: normalizedQuery,
      message: 'Prefetch request accepted'
    });
    
  } catch (error) {
    console.error('[PREFETCH-API] Unhandled error:', error);
    
    return res.status(500).json({ 
      status: 'error',
      message: 'Failed to process prefetch request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Track prefetch metrics for monitoring cache performance
 * This is a non-blocking operation that logs metrics without affecting response time
 * 
 * @param metrics - Object containing metrics to track
 */
function trackPrefetchMetrics(metrics: any): void {
  // In a production environment, this would send metrics to a monitoring system
  // For now, we'll just log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[PREFETCH-METRICS]', metrics);
  }
  
  // TODO: Add proper metrics tracking in the future
}