/**
 * @fileoverview Server-side API for rendered search results
 * 
 * This API endpoint handles search requests, fetches results from the backend API,
 * and returns server-side rendered search results with enhanced caching.
 *
 * @author Victor Chimenti
 * @version 2.0.0
 * @lastModified 2025-04-15
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { backendApiClient } from '../../lib/api-client';
import { 
  getCachedData, 
  setCachedData, 
  generateCacheKey, 
  getContentTypeSpecificTTL
} from '../../lib/cache';
import { 
  shouldRefreshCache, 
  shouldBypassCache, 
  logCachePerformance 
} from '../../lib/cache-helpers';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.seattleu.edu');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { 
    query, 
    collection, 
    profile, 
    sessionId, 
    tab,
    form,
    noCache 
  } = req.query;

  // Basic validation
  if (!query) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  // Create params object for cache key generation and backend request
  const params: Record<string, any> = {
    query: query as string,
    collection: (collection as string) || 'seattleu~sp-search',
    profile: (profile as string) || '_default',
    form: (form as string) || 'partial'
  };

  // Add tab parameter if present
  if (tab) {
    params.tab = tab;
  }

  // Add session ID if available (but not to cache key)
  const sessionIdParam = sessionId as string | undefined;

  try {
    // Check if we should bypass cache
    const bypassCache = noCache === 'true' || shouldBypassCache(params);

    if (!bypassCache) {
      // Generate cache key
      const cacheKey = generateCacheKey('search', params);

      // Try to get from cache first
      const cachedResult = await getCachedData(cacheKey);
      
      if (cachedResult) {
        // Log cache hit for analytics
        logCachePerformance(cacheKey, true);
        
        console.log(`Cache hit for ${cacheKey}`);
        return res.status(200).send(cachedResult);
      }
      
      // Log cache miss
      logCachePerformance(cacheKey, false);
    }

    // Include session ID for backend API request (not in cache key)
    if (sessionIdParam) {
      params.sessionId = sessionIdParam;
    }

    // Fetch from backend API
    const result = await backendApiClient.get('/funnelback/search', { params });
    
    // If we're not bypassing cache, cache the result
    if (!bypassCache) {
      // Determine appropriate TTL based on content
      let contentType = 'search';
      
      if (params.profile && typeof params.profile === 'string') {
        if (params.profile.includes('staff')) {
          contentType = 'staff';
        } else if (params.profile.includes('program')) {
          contentType = 'programs';
        } else if (params.profile.includes('event')) {
          contentType = 'events';
        }
      }
      
      // Add tab type if present
      if (params.tab) {
        contentType = 'tabs';
      }
      
      // Get TTL based on content type
      const ttl = getContentTypeSpecificTTL(contentType, 
        params.collection as string | undefined);
      
      // Generate cache key (ensures same key generation)
      const cacheKey = generateCacheKey('search', params);
      
      // Cache the result
      await setCachedData(cacheKey, result.data, ttl);
      
      console.log(`Cached search result for ${cacheKey} with TTL ${ttl}s`);
    }
    
    // Return the result
    res.status(200).send(result.data);
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
}