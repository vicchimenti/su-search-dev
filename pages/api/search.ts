/**
 * @fileoverview Server-side API for rendered search results
 * 
 * This API endpoint handles search requests, fetches results from the backend API,
 * and returns server-side rendered search results. Includes tab content caching
 * and IP resolution for accurate client tracking.
 *
 * @author Victor Chimenti
 * @version 3.1.2
 * @lastModified 2025-09-08
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createApiClient } from '../../lib/api-client';
import {
  getCachedData,
  setCachedData,
  getCachedSearchResults,
  setCachedSearchResults,
  getCachedTabContent,
  setCachedTabContent,
  generateSearchCacheKey,
  generateTabCacheKey,
  getRecommendedTtl
} from '../../lib/cache';
import {
  isTabRequest,
  extractTabId,
  normalizeTabId,
  parseTabRequestUrl
} from '../../lib/utils';
import {
  getClientInfo,
  getClientIpHeaders
} from '../../lib/ip-service';

// List of frequently accessed tabs for extended caching
const POPULAR_TABS = ['Results', 'Programs', 'Faculty_Staff', 'News'];

// Define an interface for the params object
interface SearchParams {
  query: string | string[];
  collection: string | string[];
  profile: string | string[];
  form: string | string[];
  sessionId: string | string[];
  [key: string]: string | string[] | undefined;
}

/**
 * Add cache status headers to the response
 * This is non-intrusive and doesn't affect the response content
 * 
 * @param res - NextApiResponse object
 * @param status - Cache status (HIT or MISS)
 * @param type - Cache type (search or tab)
 * @param metadata - Additional metadata
 */
function addCacheHeaders(
  res: NextApiResponse,
  status: 'HIT' | 'MISS',
  type: 'search' | 'tab',
  metadata: any = {}
): void {
  // Add standard cache headers
  res.setHeader('X-Cache-Status', status);
  res.setHeader('X-Cache-Type', type);

  // Add additional metadata if available
  if (metadata.tabId) {
    res.setHeader('X-Cache-Tab-ID', metadata.tabId);
  }

  if (metadata.age) {
    res.setHeader('X-Cache-Age', metadata.age.toString());
  }

  if (metadata.ttl) {
    res.setHeader('X-Cache-TTL', metadata.ttl.toString());
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[SEARCH-API] Cache ${status} for ${type}${metadata.tabId ? ` (tab: ${metadata.tabId})` : ''}`);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.seattleu.edu');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Cache-Only, X-Requested-With');

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

  // Extract and log the full request URL for debugging
  const fullUrl = req.url || '';
  console.log(`[SEARCH-API] Received request: ${fullUrl}`);

  console.log('[CACHE-DEBUG] Starting cache operations');
  // Resolve client IP information
  console.log(`[CACHE-DEBUG] Resolving client IP information`);
  const clientInfo = await getClientInfo(req.headers);
  console.log(`[CACHE-DEBUG] Resolved client IP: ${clientInfo.ip} (${clientInfo.source})`);

  const { query, collection, profile, form, sessionId } = req.query;
  console.log('[CACHE-DEBUG] Query params:', { query, collection, profile, form });

  // Basic validation
  if (!query) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  try {
    // Special case: Check if this is a cache-check-only request
    const cacheCheckOnly = req.headers['x-cache-only'] === 'true';

    // Resolve client IP information
    console.log(`[SEARCH-API] Resolving client IP information`);
    const clientInfo = await getClientInfo(req.headers);
    console.log(`[SEARCH-API] Resolved client IP: ${clientInfo.ip} (${clientInfo.source})`);

    // Add IP metadata to response headers for debugging/monitoring
    res.setHeader('X-Client-IP-Source', clientInfo.source);

    // Try to identify if this is a tab request
    let tabRequestDetected = false;
    let tabId = null;

    try {
      // First attempt with isTabRequest function
      tabRequestDetected = isTabRequest(fullUrl);

      // If detected as tab request, try to extract tab ID
      if (tabRequestDetected) {
        tabId = extractTabId(fullUrl);
        tabId = normalizeTabId(tabId);
      }

      console.log(`[SEARCH-API] Tab request detection: ${tabRequestDetected}, Tab ID: ${tabId}`);
    } catch (tabError) {
      console.error('[SEARCH-API] Error parsing tab request:', tabError);
      // Continue with request even if tab detection fails
      tabRequestDetected = false;
      tabId = null;
    }

    // Fall back to checking query parameters directly if URL parsing fails
    if (!tabRequestDetected) {
      // Check for form=partial which is a strong indicator of tab request
      if (form === 'partial') {
        tabRequestDetected = true;

        // Try to determine tab from other parameters if not already set
        if (!tabId) {
          // Check known tab-specific URL patterns
          if (fullUrl.includes('Faculty') || fullUrl.includes('Staff')) {
            tabId = 'Faculty_Staff';
          } else if (fullUrl.includes('Programs')) {
            tabId = 'Programs';
          } else if (fullUrl.includes('News')) {
            tabId = 'News';
          } else {
            // Default to Results tab
            tabId = 'Results';
          }
        }

        console.log(`[SEARCH-API] Tab detection from params: ${tabRequestDetected}, Tab ID: ${tabId}`);
      }
    }

    // For tab requests, try to get from tab-specific cache first
    if (tabRequestDetected && tabId) {
      console.log(`[SEARCH-API] Request for tab '${tabId}' with query '${query}'`);

      // Check if this is a popular tab
      const isPopularTab = POPULAR_TABS.includes(tabId);

      // Try to get from cache using enhanced function
      const cachedTabContent = await getCachedTabContent(
        query as string,
        collection as string || 'seattleu~sp-search',
        profile as string || '_default',
        tabId
      );

      if (cachedTabContent) {
        console.log(`[SEARCH-API] Cache HIT for tab '${tabId}'`);

        // Add cache status headers - non-intrusive enhancement
        addCacheHeaders(res, 'HIT', 'tab', {
          tabId,
          popular: isPopularTab
        });

        // Handle cache-check-only requests
        if (cacheCheckOnly) {
          return res.status(200).json({ cacheStatus: 'HIT', tabId });
        }

        // Return cached tab content as-is to preserve the exact HTML structure
        return res.status(200).send(cachedTabContent);
      }

      console.log(`[SEARCH-API] Cache MISS for tab '${tabId}'`);

      // Add cache status headers - non-intrusive enhancement
      addCacheHeaders(res, 'MISS', 'tab', { tabId });

      // Handle cache-check-only requests
      if (cacheCheckOnly) {
        return res.status(404).json({ cacheStatus: 'MISS', tabId });
      }
    } else {

      console.log('[CACHE-DEBUG] Starting cache check for query:', query);
      // For non-tab requests, use general search cache
      const cachedResult = await getCachedSearchResults(
        query as string,
        collection as string || 'seattleu~sp-search',
        profile as string || '_default'
      );

      console.log('[CACHE-DEBUG] Cache result:', cachedResult ? 'HIT' : 'MISS');

      if (cachedResult) {
        console.log(`[SEARCH-API] Cache HIT for search: ${query}`);

        // Add cache status headers - non-intrusive enhancement
        addCacheHeaders(res, 'HIT', 'search');

        // Handle cache-check-only requests
        if (cacheCheckOnly) {
          return res.status(200).json({ cacheStatus: 'HIT' });
        }

        // Return cached search results as-is to preserve the exact HTML structure
        return res.status(200).send(cachedResult);
      }

      console.log(`[SEARCH-API] Cache MISS for search: ${query}`);

      // Add cache status headers - non-intrusive enhancement
      addCacheHeaders(res, 'MISS', 'search');

      // Handle cache-check-only requests
      if (cacheCheckOnly) {
        return res.status(404).json({ cacheStatus: 'MISS' });
      }
    }

    // Cache miss - prepare parameters for backend API
    const params: SearchParams = {
      query,
      collection: collection || 'seattleu~sp-search',
      profile: profile || '_default',
      form: form || 'partial',
      sessionId: sessionId || ''
    };

    // Add any additional parameters from the original request
    // Including facet parameters like f.Tabs which are critical for tab content
    Object.keys(req.query).forEach(key => {
      if (!['query', 'collection', 'profile', 'form', 'sessionId'].includes(key)) {
        params[key] = req.query[key];
      }
    });

    // Log the full parameters being sent to backend
    console.log(`[SEARCH-API] Sending to backend API:`, params);

    // Create cache-aware API client with client IP propagation
    const apiClient = createApiClient(req.headers, { cacheAware: true });

    // Fetch from backend API with client IP
    console.log(`[SEARCH-API] Fetching from backend for query: ${query}${tabId ? `, tab: ${tabId}` : ''}`);
    const result = await apiClient.get('/funnelback/search', { params });

    // Parse string query safely
    const queryStr = typeof query === 'string' ? query : Array.isArray(query) ? query[0] : '';
    const collectionStr = typeof collection === 'string' ? collection :
      Array.isArray(collection) ? collection[0] : 'seattleu~sp-search';
    const profileStr = typeof profile === 'string' ? profile :
      Array.isArray(profile) ? profile[0] : '_default';

    // Cache the result based on request type
    if (tabRequestDetected && tabId) {
      // For tab content requests
      const isPopularTab = POPULAR_TABS.includes(tabId);

      // Use enhanced function
      await setCachedTabContent(
        queryStr,
        collectionStr,
        profileStr,
        tabId,
        result.data,
        isPopularTab
      );

      console.log(`[SEARCH-API] Cached tab content for '${tabId}', popular: ${isPopularTab}`);
    } else {
      // For general search requests - use enhanced function
      await setCachedSearchResults(
        queryStr,
        collectionStr,
        profileStr,
        result.data
      );

      console.log(`[SEARCH-API] Cached search result with tiered TTL`);
    }

    // Return the result as-is to preserve the exact HTML structure
    res.status(200).send(result.data);
  } catch (error) {
    console.error('[SEARCH-API] Search API error:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
}