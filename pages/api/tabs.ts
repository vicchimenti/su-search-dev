/**
 * @fileoverview Dedicated Tab Content API
 * 
 * This API endpoint specifically handles tab content requests with
 * optimized caching, content validation, and format consistency.
 *
 * @author Victor Chimenti
 * @version 1.0.0
 * @lastModified 2025-04-16
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { backendApiClient } from '../../lib/api-client';
import {
  setCachedData,
  getCachedData,
  generateCacheKey,
  ResponseFormat,
  detectFormat,
  validateContent
} from '../../lib/enhanced-cache';

// Tab content TTL constants in seconds for different tab types
const TAB_TTL = {
  // Default tab content TTL
  DEFAULT: 60 * 30, // 30 minutes

  // Content-specific tab TTLs
  ALL: 60 * 20, // 20 minutes - "All" tab changes more frequently
  PROGRAMS: 60 * 60 * 2, // 2 hours - Academic programs tabs
  STAFF: 60 * 60 * 4, // 4 hours - Staff directory tabs
  NEWS: 60 * 15, // 15 minutes - News tabs change frequently

  // Special case: minimal TTL for debugging
  DEBUG: 60 // 1 minute for debugging
};

/**
 * Maps common tab labels to their type for TTL determination
 */
const TAB_TYPE_MAP: Record<string, keyof typeof TAB_TTL> = {
  // Default/general tabs
  'all': 'ALL',
  'results': 'ALL',
  'everything': 'ALL',

  // Program tabs
  'programs': 'PROGRAMS',
  'academics': 'PROGRAMS',
  'courses': 'PROGRAMS',
  'degrees': 'PROGRAMS',
  'majors': 'PROGRAMS',
  'minors': 'PROGRAMS',

  // Staff tabs
  'staff': 'STAFF',
  'faculty': 'STAFF',
  'people': 'STAFF',
  'directory': 'STAFF',

  // News tabs
  'news': 'NEWS',
  'articles': 'NEWS',
  'announcements': 'NEWS',
  'press': 'NEWS'
};

/**
 * Determine appropriate TTL for a tab based on its ID or name
 * @param tabId - The tab ID
 * @param tabName - Optional tab name for better type detection
 * @returns TTL in seconds
 */
function getTabTTL(tabId: string, tabName?: string): number {
  // Debug mode always gets minimal TTL
  if (tabId.toLowerCase().includes('debug')) {
    return TAB_TTL.DEBUG;
  }

  // Use tab name if provided for better type matching
  if (tabName) {
    const normalizedName = tabName.toLowerCase().trim();

    // Check for exact matches in map
    for (const [key, type] of Object.entries(TAB_TYPE_MAP)) {
      if (normalizedName === key || normalizedName.includes(key)) {
        return TAB_TTL[type];
      }
    }
  }

  // No match by name, try to infer from tab ID
  const normalizedId = tabId.toLowerCase().trim();

  for (const [key, type] of Object.entries(TAB_TYPE_MAP)) {
    if (normalizedId === key || normalizedId.includes(key)) {
      return TAB_TTL[type];
    }
  }

  // Default TTL if no match
  return TAB_TTL.DEFAULT;
}

// Custom response type to provide additional metadata
type TabApiResponse = {
  html?: string;
  error?: string;
  cacheInfo?: {
    status: 'hit' | 'miss' | 'error';
    source?: string;
    age?: number;
    ttl?: number;
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TabApiResponse | string>
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
      error: 'Method not allowed'
    });
    return;
  }

  // Start timing for performance measurement
  const startTime = Date.now();

  const {
    query,
    tab,
    collection,
    profile,
    sessionId,
    debug,
    noCache,
    format: requestedFormat
  } = req.query;

  // Basic validation
  if (!query) {
    res.status(400).json({
      error: 'Query parameter is required'
    });
    return;
  }

  if (!tab) {
    res.status(400).json({
      error: 'Tab parameter is required'
    });
    return;
  }

  // Create params object for cache key generation and backend request
  const params: Record<string, any> = {
    query: query as string,
    tab: tab as string,
    collection: (collection as string) || 'seattleu~sp-search',
    profile: (profile as string) || '_default',
    form: 'partial'
  };

  // Add session ID if available (not included in cache key)
  const sessionIdParam = sessionId as string | undefined;

  // Debug mode requested
  const debugMode = debug === 'true';

  try {
    // Check if we should bypass cache
    const bypassCache = noCache === 'true';

    // Generate cache key specifically for this tab
    const cacheKey = generateCacheKey('tab', params);
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

        console.log(`Tab cache hit for ${cacheKey} (age: ${cacheAge}s)`);

        // If debug mode, include cache metadata
        if (debugMode) {
          return res.status(200).json({
            html: cachedResult,
            cacheInfo: {
              status: 'hit',
              source: cacheSource,
              age: cacheAge,
              ttl: getTabTTL(params.tab as string)
            }
          });
        }

        // Otherwise just send the content
        return res.status(200).send(cachedResult);
      }

      console.log(`Tab cache miss for ${cacheKey}`);
    }

    // Include session ID for backend API request (not in cache key)
    if (sessionIdParam) {
      params.sessionId = sessionIdParam;
    }

    // Fetch from backend API
    console.log('Fetching tab content from backend:', params);

    // Construct backend URL that includes the tab parameter
    const apiPath = '/funnelback/search';

    const result = await backendApiClient.get(apiPath, { params });

    // Get content
    const content = result.data;

    // If we're not bypassing cache, cache the result
    if (!bypassCache) {
      // Determine appropriate TTL for this tab
      const ttl = getTabTTL(params.tab as string);

      // Detect content format
      const contentFormat = detectFormat(content, result.headers['content-type']);

      // Validate content before caching
      const validatedContent = validateContent(content, contentFormat);

      // Cache the result with appropriate TTL
      await setCachedData(
        cacheKey,
        validatedContent,
        ttl,
        contentFormat,
        result.headers as unknown as Headers
      );

      console.log(`Cached tab content for ${cacheKey} with TTL ${ttl}s (format: ${contentFormat})`);
    }

    // If debug mode, include cache metadata
    if (debugMode) {
      return res.status(200).json({
        html: content,
        cacheInfo: {
          status: 'miss',
          source: 'backend',
          ttl: getTabTTL(params.tab as string)
        }
      });
    }

    // Return the result
    res.status(200).send(content);
  } catch (error: any) {
    console.error('Tab API error:', error);

    // If debug mode, include error details
    if (debugMode) {
      res.status(500).json({
        error: `Failed to fetch tab content: ${error?.message || 'unknown error'}`,
        cacheInfo: {
          status: 'error'
        }
      });
    } else {
      // User-friendly error for normal mode
      res.status(500).json({
        error: 'Failed to fetch tab content. Please try again later.'
      });
    }
  }
}

// Pre-fetch multiple tabs in the background
export async function prefetchTabs(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    query,
    tabs,
    sessionId,
    priority
  } = req.query;

  // Basic validation
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  if (!tabs || !(tabs as string).includes(',')) {
    return res.status(400).json({ error: 'Multiple tab IDs required, comma-separated' });
  }

  // Parse comma-separated tabs
  const tabIds = (tabs as string).split(',').map(t => t.trim());

  // Only respond quickly if not priority
  if (priority !== 'true') {
    // Send OK response immediately - we'll prefetch in the background
    res.status(202).json({
      message: `Prefetching ${tabIds.length} tabs in the background`
    });
  }

  try {
    // Start prefetching each tab
    const tabPromises = tabIds.map(async (tabId) => {
      const params: Record<string, string> = {
        query: query as string,
        tab: tabId,
        form: 'partial'
      };

      // Add session ID if available
      if (sessionId) {
        params['sessionId'] = sessionId as string;
      }

      // Generate cache key
      const cacheKey = generateCacheKey('tab', params);

      // Check if already cached
      const cachedResult = await getCachedData(cacheKey);
      if (cachedResult) {
        console.log(`Tab ${tabId} already cached, skipping prefetch`);
        return { tabId, status: 'cached' };
      }

      // Fetch tab content
      const result = await backendApiClient.get('/funnelback/search', { params });

      // Determine TTL
      const ttl = getTabTTL(tabId);

      // Cache the content
      const contentFormat = detectFormat(result.data, result.headers['content-type']);
      await setCachedData(
        cacheKey,
        result.data,
        ttl,
        contentFormat,
        result.headers as unknown as Headers
      );

      console.log(`Prefetched tab ${tabId} with TTL ${ttl}s`);
      return { tabId, status: 'prefetched' };
    });

    // If priority, wait for all tabs and return results
    if (priority === 'true') {
      const results = await Promise.all(tabPromises);
      return res.status(200).json({
        results,
        message: `Successfully prefetched ${tabIds.length} tabs`
      });
    }

    // Otherwise, continue in the background (we already sent the response)
    Promise.all(tabPromises)
      .then(() => console.log(`Background prefetch complete for ${tabIds.length} tabs`))
      .catch(err => console.error('Error in background prefetch:', err));

  } catch (error) {
    console.error('Prefetch error:', error);

    // Only send response if priority mode
    if (priority === 'true') {
      return res.status(500).json({
        error: 'Error prefetching tabs',
        details: error.message
      });
    }
  }
}