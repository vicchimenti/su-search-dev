/**
 * @fileoverview Server-side API for rendered suggestions
 * 
 * This API endpoint handles suggestion requests, fetches results from the backend API,
 * and returns server-side rendered suggestions for autocomplete with type-specific caching.
 *
 * @author Victor Chimenti
 * @version 1.2.0
 * @lastModified 2025-04-15
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { backendApiClient } from '../../lib/api-client';
import { getCachedData, setCachedData } from '../../lib/cache';
import { logCachePerformance } from '../../lib/cache-helpers';

// Cache TTL constants in seconds for suggestion types
const SUGGESTION_TTL = {
  // General suggestions should be refreshed fairly frequently 
  GENERAL: 60 * 15, // 15 minutes
  
  // Staff/faculty directory changes infrequently
  STAFF: 60 * 60 * 4, // 4 hours
  
  // Programs change relatively infrequently
  PROGRAMS: 60 * 60 * 2, // 2 hours
  
  // Default for unspecified types
  DEFAULT: 60 * 30 // 30 minutes
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

  const { query, type, collection, profile, sessionId, noCache } = req.query;

  // Basic validation
  if (!query) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  try {
    // Check if we should bypass cache
    const bypassCache = noCache === 'true';

    // Generate cache key
    const cacheKey = `suggestions:${type || 'all'}:${query}:${collection || 'default'}`;

    // Try to get from cache first if not bypassing
    if (!bypassCache) {
      const cachedResult = await getCachedData(cacheKey);
      if (cachedResult) {
        // Log cache hit for analytics
        logCachePerformance(cacheKey, true);
        
        console.log(`Cache hit for ${cacheKey}`);
        return res.status(200).json(cachedResult);
      }
      
      // Log cache miss
      logCachePerformance(cacheKey, false);
    }

    // Handle different suggestion types
    let result;
    
    switch (type) {
      case 'general':
        result = await fetchGeneralSuggestions(query as string, sessionId as string);
        break;
      case 'staff':
        result = await fetchStaffSuggestions(query as string, sessionId as string);
        break;
      case 'programs':
        result = await fetchProgramSuggestions(query as string, sessionId as string);
        break;
      default:
        // Fetch all types in parallel
        const [general, staff, programs] = await Promise.all([
          fetchGeneralSuggestions(query as string, sessionId as string),
          fetchStaffSuggestions(query as string, sessionId as string),
          fetchProgramSuggestions(query as string, sessionId as string)
        ]);
        
        result = {
          general,
          staff,
          programs
        };
    }
    
    // Cache the result with type-specific TTL if not bypassing
    if (!bypassCache) {
      // Determine TTL based on suggestion type
      let ttl = SUGGESTION_TTL.DEFAULT;
      
      if (type === 'general') {
        ttl = SUGGESTION_TTL.GENERAL;
      } else if (type === 'staff') {
        ttl = SUGGESTION_TTL.STAFF;
      } else if (type === 'programs') {
        ttl = SUGGESTION_TTL.PROGRAMS;
      } else {
        // For combined results (when no specific type), 
        // use the lowest TTL to ensure freshness
        ttl = SUGGESTION_TTL.GENERAL;
      }
      
      // Cache with appropriate TTL
      await setCachedData(cacheKey, result, ttl);
      
      console.log(`Cached suggestion results for ${cacheKey} with TTL ${ttl}s`);
    }
    
    // Return the result
    res.status(200).json(result);
  } catch (error) {
    console.error('Suggestions API error:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
}

// Helper functions for fetching different suggestion types
async function fetchGeneralSuggestions(query: string, sessionId?: string) {
  const params = {
    partial_query: query,
    collection: 'seattleu~sp-search',
    profile: '_default',
    sessionId
  };
  
  const response = await backendApiClient.get('/funnelback/suggest', { params });
  return response.data;
}

async function fetchStaffSuggestions(query: string, sessionId?: string) {
  const params = {
    query,
    sessionId
  };
  
  const response = await backendApiClient.get('/suggestPeople', { params });
  return response.data;
}

async function fetchProgramSuggestions(query: string, sessionId?: string) {
  const params = {
    query,
    sessionId
  };
  
  const response = await backendApiClient.get('/suggestPrograms', { params });
  return response.data;
}