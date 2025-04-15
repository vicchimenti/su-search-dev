/**
 * @fileoverview Server-side API for rendered search results
 * 
 * This API endpoint handles search requests, fetches results from the backend API,
 * and returns server-side rendered search results with enhanced tiered caching.
 *
 * @author Victor Chimenti
 * @version 3.0.0
 * @lastModified 2025-04-16
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { backendApiClient } from '../../lib/api-client';
import { 
  setCachedData, 
  getCachedData, 
  generateCacheKey, 
  getContentSpecificTTL,
  ResponseFormat,
  detectFormat,
  validateContent,
  checkCacheHealth
} from '../../lib/enhanced-cache';

// Custom response type to provide additional metadata
type ApiResponse = {
  content: string;
  cacheInfo?: {
    status: 'hit' | 'miss' | 'error';
    source?: string;
    age?: number;
    ttl?: number;
  };
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse | string>
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ 
      content: '',
      error: 'Method not allowed' 
    });
    return;
  }

  // Start timing for performance measurement
  const startTime = Date.now();

  const { 
    query, 
    collection, 
    profile, 
    sessionId, 
    tab,
    form,
    debug,
    noCache,
    ttl: customTtl,
    format: requestedFormat
  } = req.query;

  // Basic validation
  if (!query) {
    res.status(400).json({ 
      content: '',
      error: 'Query parameter is required' 
    });
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

  // Add session ID if available (not included in cache key)
  const sessionIdParam = sessionId as string | undefined;

  // Debug mode requested
  const debugMode = debug === 'true';

  try {
    // Check if we should bypass cache
    const bypassCache = noCache === 'true';
    
    // Generate cache key
    const cacheKey = generateCacheKey('search', params);
    let cacheHit = false;
    let cacheSource = '';

    // Try to get from cache first if not bypassing
    if (!bypassCache) {
      // Determine expected format
      const expectedFormat = (requestedFormat as string)?.toLowerCase() === 'json' ? 
        ResponseFormat.JSON : ResponseFormat.HTML;
      
      const cachedResult = await getCachedData<string>(cacheKey, expectedFormat);
      
      if (cachedResult) {
        cacheHit = true;
        cacheSource = 'primary';
        
        // Calculate cache age
        const cacheAge = Math.floor((Date.now() - startTime) / 1000);
        
        console.log(`Cache hit for ${cacheKey} (age: ${cacheAge}s)`);
        
        // If debug mode, include cache metadata
        if (debugMode) {
          return res.status(200).json({
            content: cachedResult,
            cacheInfo: {
              status: 'hit',
              source: cacheSource,
              age: cacheAge,
              ttl: getContentSpecificTTL(tab ? 'tab' : 'search', query as string)
            }
          });
        }
        
        // Otherwise just send the content
        return res.status(200).send(cachedResult);
      }
      
      console.log(`Cache miss for ${cacheKey}`);
    }

    // Include session ID for backend API request (not in cache key)
    if (sessionIdParam) {
      params.sessionId = sessionIdParam;
    }

    // Fetch from backend API
    console.log('Fetching from backend:', params);
    const result = await backendApiClient.get('/funnelback/search', { params });
    
    // Get result content
    const content = result.data;
    
    // If we're not bypassing cache, cache the result
    if (!bypassCache) {
      // Determine appropriate TTL based on content type and request
      let ttl = getContentSpecificTTL(tab ? 'tab' : 'search', query as string);
      
      // Check for custom TTL parameter
      if (customTtl && !isNaN(Number(customTtl))) {
        ttl = Number(customTtl);
      }
      
      // Detect content format
      const contentFormat = detectFormat(content, result.headers['content-type']);
      
      // Cache the result with appropriate TTL
      await setCachedData(
        cacheKey, 
        content, 
        ttl, 
        contentFormat, 
        result.headers as unknown as Headers
      );
      
      console.log(`Cached search result for ${cacheKey} with TTL ${ttl}s (format: ${contentFormat})`);
    }
    
    // If debug mode, include cache metadata
    if (debugMode) {
      return res.status(200).json({
        content: content,
        cacheInfo: {
          status: 'miss',
          source: 'backend',
          ttl: getContentSpecificTTL(tab ? 'tab' : 'search', query as string)
        }
      });
    }
    
    // Return the result
    res.status(200).send(content);
  } catch (error : any) {
    console.error('Search API error:', error);
    
    // If debug mode, include error details
    if (debugMode) {
      res.status(500).json({ 
        content: '',
        error: `Failed to fetch search results: ${error.message}`,
        cacheInfo: {
          status: 'error'
        }
      });
    } else {
      // User-friendly error for normal mode
      res.status(500).json({ 
        content: '',
        error: 'Failed to fetch search results. Please try again later.' 
      });
    }
  }
}

// Handler for cache health check endpoint
export async function healthCheckHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const healthStatus = await checkCacheHealth();
    res.status(200).json(healthStatus);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}