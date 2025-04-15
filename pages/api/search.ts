/**
 * @fileoverview Server-side API for rendered search results
 * 
 * This API endpoint handles search requests, fetches results from the backend API,
 * and returns server-side rendered search results with enhanced tiered caching.
 *
 * @author Victor Chimenti
 * @version 2.1.0
 * @lastModified 2025-04-15
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { backendApiClient } from '../../lib/api-client';
import { 
  getCachedData, 
  setCachedData, 
  generateCacheKey
} from '../../lib/cache';
import { 
  shouldRefreshCache, 
  shouldBypassCache, 
  logCachePerformance 
} from '../../lib/cache-helpers';

// Cache TTL constants in seconds
const TTL = {
  // Time-sensitive content with frequent updates
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
    noCache,
    ttl: customTtl
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
      // Determine appropriate TTL based on content type
      let ttl = TTL.DEFAULT; // Default TTL
      
      // Check for custom TTL parameter
      if (customTtl && !isNaN(Number(customTtl))) {
        ttl = Number(customTtl);
      } else {
        // Determine TTL based on collection and profile
        const collectionStr = String(collection || '').toLowerCase();
        const profileStr = String(profile || '').toLowerCase();
        
        // First check if it's a tab request
        if (tab) {
          ttl = TTL.TABS;
        }
        // Check if it's staff/faculty content
        else if (
          profileStr.includes('staff') || 
          profileStr.includes('faculty') || 
          profileStr.includes('directory') ||
          collectionStr.includes('staff') || 
          collectionStr.includes('faculty') ||
          collectionStr.includes('directory')
        ) {
          ttl = TTL.STAFF;
        }
        // Check if it's academic programs
        else if (
          profileStr.includes('program') || 
          profileStr.includes('academic') || 
          profileStr.includes('degree') ||
          collectionStr.includes('program') || 
          collectionStr.includes('academic') ||
          collectionStr.includes('degree')
        ) {
          ttl = TTL.PROGRAMS;
        }
        // Check if it's courses
        else if (
          profileStr.includes('course') || 
          profileStr.includes('class') ||
          collectionStr.includes('course') || 
          collectionStr.includes('class')
        ) {
          ttl = TTL.COURSES;
        }
        // Check if it's events
        else if (
          profileStr.includes('event') || 
          profileStr.includes('calendar') ||
          collectionStr.includes('event') || 
          collectionStr.includes('calendar')
        ) {
          ttl = TTL.EVENTS;
        }
        // Check if it's news
        else if (
          profileStr.includes('news') || 
          profileStr.includes('article') ||
          collectionStr.includes('news') || 
          collectionStr.includes('article')
        ) {
          ttl = TTL.NEWS;
        }
        // Check if it's locations/places
        else if (
          profileStr.includes('location') || 
          profileStr.includes('building') || 
          profileStr.includes('place') ||
          collectionStr.includes('location') || 
          collectionStr.includes('building') ||
          collectionStr.includes('place')
        ) {
          ttl = TTL.LOCATIONS;
        }
        // Check for static content
        else if (
          profileStr.includes('static') || 
          profileStr.includes('archive') ||
          collectionStr.includes('static') || 
          collectionStr.includes('archive')
        ) {
          ttl = TTL.STATIC;
        }
        
        // Look for time-sensitivity hints in query
        const queryStr = String(query || '').toLowerCase();
        if (
          queryStr.includes('today') || 
          queryStr.includes('now') || 
          queryStr.includes('current') ||
          queryStr.includes('latest') ||
          queryStr.includes('update')
        ) {
          // Reduce TTL for time-sensitive queries, but don't go below REALTIME
          ttl = Math.min(ttl, TTL.NEWS);
        }
      }
      
      // Generate cache key (ensures same key generation)
      const cacheKey = generateCacheKey('search', params);
      
      // Cache the result with appropriate TTL
      await setCachedData(cacheKey, result.data, ttl);
      
      // Log caching details including TTL
      console.log(`Cached search result for ${cacheKey} with TTL ${ttl}s`);
    }
    
    // Return the result
    res.status(200).send(result.data);
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
}