/**
 * @fileoverview Server-side API for rendered search results
 * 
 * This API endpoint handles search requests, fetches results from the backend API,
 * and returns server-side rendered search results. Includes tab content caching.
 *
 * @author Victor Chimenti
 * @version 2.2.0
 * @lastModified 2025-04-16
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { backendApiClient } from '../../lib/api-client';
import {
  getCachedData,
  setCachedData,
  getCachedTabContent,
  setCachedTabContent
} from '../../lib/cache';
import {
  isTabRequest,
  extractTabId,
  normalizeTabId,
  generateTabCacheKey,
  parseTabRequestUrl
} from '../../lib/utils';

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

  // Get request URL and parameters
  const requestUrl = req.url || '';
  console.log(`[DEBUG] Received request: ${requestUrl}`);
  console.log(`[DEBUG] Query params:`, req.query);

  const { query, collection, profile, form, sessionId } = req.query;

  // Basic validation
  if (!query) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  try {
    // Use our utility function to check if this is a tab request
    const tabRequestCheck = isTabRequest(requestUrl);
    console.log(`[TAB DEBUG] Checking if tab request: form=${form}, tab=${req.query.tab}, profile=${profile}`);
    console.log(`[TAB DEBUG] Tab request detection result: ${tabRequestCheck}`);

    // Extract tab ID using our utility function
    const extractedTabId = extractTabId(requestUrl);
    const normalizedTabId = normalizeTabId(extractedTabId);
    console.log(`[TAB DEBUG] Extracted tab ID: ${extractedTabId}, Normalized: ${normalizedTabId}`);

    // Parse full request URL for comprehensive parameter extraction
    const parsedRequest = parseTabRequestUrl(requestUrl);
    console.log(`[TAB DEBUG] Parsed request:`, parsedRequest);

    // Add cache info to response headers for debugging/monitoring
    res.setHeader('X-Cache-Enabled', 'true');

    // For tab requests, try to get from tab-specific cache first
    if (tabRequestCheck && normalizedTabId) {
      console.log(`[TAB CACHE] Request for tab '${normalizedTabId}' with query '${query}'`);

      // Generate cache key for this tab request
      const tabCacheKey = generateTabCacheKey(
        query as string,
        collection as string || 'seattleu~sp-search',
        normalizedTabId
      );
      console.log(`[TAB CACHE] Generated cache key: ${tabCacheKey}`);

      // Try to get from cache
      const cachedTabContent = await getCachedData(tabCacheKey);

      if (cachedTabContent) {
        console.log(`[TAB CACHE] HIT - Serving cached content for tab '${normalizedTabId}'`);
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('X-Cache-Type', 'tab');
        res.setHeader('X-Cache-Tab-ID', normalizedTabId);

        // Return cached tab content
        return res.status(200).send(cachedTabContent);
      }

      console.log(`[TAB CACHE] MISS - Fetching content for tab '${normalizedTabId}' from backend`);
      res.setHeader('X-Cache-Status', 'MISS');
      res.setHeader('X-Cache-Type', 'tab');
      res.setHeader('X-Cache-Tab-ID', normalizedTabId);
    } else {
      // For non-tab requests, use general search cache
      const cacheKey = `search:${query}:${collection || 'default'}:${profile || 'default'}`;

      // Try to get from cache
      const cachedResult = await getCachedData(cacheKey);
      if (cachedResult) {
        console.log(`Cache hit for ${cacheKey}`);
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('X-Cache-Type', 'search');

        return res.status(200).send(cachedResult);
      }

      res.setHeader('X-Cache-Status', 'MISS');
      res.setHeader('X-Cache-Type', 'search');
      console.log(`Cache miss for ${cacheKey}`);
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

    // Fetch from backend API
    console.log(`Fetching from backend for query: ${query}${normalizedTabId ? `, tab: ${normalizedTabId}` : ''}`);
    const result = await backendApiClient.get('/funnelback/search', { params });

    // Cache the result based on request type
    if (tabRequestCheck && normalizedTabId) {
      // For tab content requests
      const tabCacheKey = generateTabCacheKey(
        query as string,
        collection as string || 'seattleu~sp-search',
        normalizedTabId
      );

      // Check if this is a popular tab for longer TTL
      const isPopularTab = POPULAR_TABS.includes(normalizedTabId);

      // Store in cache
      await setCachedData(tabCacheKey, result.data, isPopularTab ? 7200 : 1800);
      console.log(`[TAB CACHE] Stored tab content in cache with key: ${tabCacheKey}, popular: ${isPopularTab}`);
    } else {
      // For general search requests
      const cacheKey = `search:${query}:${collection || 'default'}:${profile || 'default'}`;
      await setCachedData(cacheKey, result.data, 600); // 10 minutes TTL
      console.log(`Cached search result for key: ${cacheKey}`);
    }

    // Return the result
    res.status(200).send(result.data);
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
}