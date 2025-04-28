/**
 * @fileoverview Server-side API for rendered search results
 * 
 * This API endpoint handles search requests, fetches results from the backend API,
 * and returns server-side rendered search results. Includes tab content caching
 * and IP resolution for accurate client tracking.
 *
 * @author Victor Chimenti
 * @version 3.0.0
 * @lastModified 2025-04-28
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createApiClient } from '../../lib/api-client';
import {
  getCachedData,
  setCachedData
} from '../../lib/cache';
import {
  isTabRequest,
  extractTabId,
  normalizeTabId,
  generateTabCacheKey,
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

  // Extract and log the full request URL for debugging
  const fullUrl = req.url || '';
  console.log(`[SEARCH-API] Received full request URL: ${fullUrl}`);
  console.log(`[SEARCH-API] Query params:`, req.query);

  const { query, collection, profile, form, sessionId } = req.query;

  // Basic validation
  if (!query) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  try {
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

      console.log(`[SEARCH-API] Tab request detection from URL: ${tabRequestDetected}, Tab ID: ${tabId}`);
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

    // Add cache info to response headers for debugging/monitoring
    res.setHeader('X-Cache-Enabled', 'true');

    // For tab requests, try to get from tab-specific cache first
    if (tabRequestDetected && tabId) {
      console.log(`[SEARCH-API] Request for tab '${tabId}' with query '${query}'`);

      // Generate cache key for this tab request
      const tabCacheKey = generateTabCacheKey(
        query as string,
        collection as string || 'seattleu~sp-search',
        tabId
      );
      console.log(`[SEARCH-API] Generated cache key: ${tabCacheKey}`);

      // Try to get from cache
      const cachedTabContent = await getCachedData(tabCacheKey);

      if (cachedTabContent) {
        console.log(`[SEARCH-API] HIT - Serving cached content for tab '${tabId}'`);
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('X-Cache-Type', 'tab');
        res.setHeader('X-Cache-Tab-ID', tabId);

        // Return cached tab content
        return res.status(200).send(cachedTabContent);
      }

      console.log(`[SEARCH-API] MISS - Fetching content for tab '${tabId}' from backend`);
      res.setHeader('X-Cache-Status', 'MISS');
      res.setHeader('X-Cache-Type', 'tab');
      res.setHeader('X-Cache-Tab-ID', tabId);
    } else {
      // For non-tab requests, use general search cache
      const cacheKey = `search:${query}:${collection || 'default'}:${profile || 'default'}`;

      // Try to get from cache
      const cachedResult = await getCachedData(cacheKey);
      if (cachedResult) {
        console.log(`[SEARCH-API] Cache hit for ${cacheKey}`);
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('X-Cache-Type', 'search');

        return res.status(200).send(cachedResult);
      }

      res.setHeader('X-Cache-Status', 'MISS');
      res.setHeader('X-Cache-Type', 'search');
      console.log(`[SEARCH-API] Cache miss for ${cacheKey}`);
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

    // Create API client with client IP propagation
    const apiClient = createApiClient(req.headers);

    // Add the client IP info to request log
    console.log(`[SEARCH-API] Using client IP: ${clientInfo.ip} (${clientInfo.source}) for backend request`);

    // Fetch from backend API with client IP
    console.log(`[SEARCH-API] Fetching from backend for query: ${query}${tabId ? `, tab: ${tabId}` : ''}`);
    const result = await apiClient.get('/funnelback/search', { params });

    // Cache the result based on request type
    if (tabRequestDetected && tabId) {
      // For tab content requests
      const tabCacheKey = generateTabCacheKey(
        query as string,
        collection as string || 'seattleu~sp-search',
        tabId
      );

      // Check if this is a popular tab for longer TTL
      const isPopularTab = POPULAR_TABS.includes(tabId);
      const cacheTTL = isPopularTab ? 7200 : 1800; // 2 hours vs 30 minutes

      // Store in cache
      await setCachedData(tabCacheKey, result.data, cacheTTL);
      console.log(`[SEARCH-API] Stored tab content in cache with key: ${tabCacheKey}, TTL: ${cacheTTL}s, popular: ${isPopularTab}`);
    } else {
      // For general search requests
      const cacheKey = `search:${query}:${collection || 'default'}:${profile || 'default'}`;
      await setCachedData(cacheKey, result.data, 600); // 10 minutes TTL
      console.log(`[SEARCH-API] Cached search result for key: ${cacheKey}, TTL: 600s`);
    }

    // Return the result
    res.status(200).send(result.data);
  } catch (error) {
    console.error('[SEARCH-API] Search API error:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
}