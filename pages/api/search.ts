/**
 * @fileoverview Server-side API for rendered search results
 * 
 * This API endpoint handles search requests, fetches results from the backend API,
 * and returns server-side rendered search results. Includes tab content caching.
 *
 * @author Victor Chimenti
 * @version 2.0.0
 * @lastModified 2025-04-16
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { backendApiClient } from '../../lib/api-client';
import {
  getCachedData,
  setCachedData,
  generateSearchCacheKey,
  getCachedTabContent,
  setCachedTabContent
} from '../../lib/cache';

// List of frequently accessed tabs for extended caching
const POPULAR_TABS = ['general', 'news', 'programs', 'people', 'events'];

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

  const { query, collection, profile, sessionId, form, tab } = req.query;

  // Basic validation
  if (!query) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  try {
    // Determine if this is a tab request
    const isTabRequest = isTabContentRequest(req);
    const tabId = getTabId(req);

    // Add cache info to response headers for debugging/monitoring
    res.setHeader('X-Cache-Enabled', 'true');

    // For tab requests, try to get from tab-specific cache first
    if (isTabRequest && tabId) {
      const cachedTabContent = await getCachedTabContent(
        query as string,
        collection as string || 'seattleu~sp-search',
        profile as string || '_default',
        tabId
      );

      if (cachedTabContent) {
        console.log(`Tab cache hit for query: ${query}, tab: ${tabId}`);
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('X-Cache-Type', 'tab');

        // Return cached tab content
        return res.status(200).send(cachedTabContent);
      }

      res.setHeader('X-Cache-Status', 'MISS');
      console.log(`Tab cache miss for query: ${query}, tab: ${tabId}`);
    } else {
      // For non-tab requests, use regular search cache

      // Generate cache key
      const cacheKey = generateSearchCacheKey(
        query as string,
        collection as string || 'seattleu~sp-search',
        profile as string || '_default'
      );

      // Try to get from cache first
      const cachedResult = await getCachedData(cacheKey);
      if (cachedResult) {
        console.log(`Cache hit for ${cacheKey}`);
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('X-Cache-Type', 'search');

        return res.status(200).send(cachedResult);
      }

      res.setHeader('X-Cache-Status', 'MISS');
      console.log(`Cache miss for ${cacheKey}`);
    }

    // Define an interface for the params object that includes all possible properties
    interface SearchParams {
      query: string | string[];
      collection: string | string[];
      profile: string | string[];
      form: string | string[];
      tab?: string | string[]; // Optional tab parameter
      sessionId: string | string[];
    }

    // Then use that interface for your params object
    const params: SearchParams = {
      query,
      collection: collection || 'seattleu~sp-search',
      profile: profile || '_default',
      form: form || 'partial',
      sessionId: sessionId || ''
    };

    // Add tab parameter if it exists
    if (tab) {
      params.tab = tab;
    }

    // Fetch from backend API
    console.log(`Fetching from backend for query: ${query}${tabId ? `, tab: ${tabId}` : ''}`);
    const result = await backendApiClient.get('/funnelback/search', { params });

    // Cache the result
    if (isTabRequest && tabId) {
      // Cache as tab content
      const isPopularTab = POPULAR_TABS.includes(tabId) ||
        POPULAR_TABS.includes(profile as string);

      await setCachedTabContent(
        query as string,
        collection as string || 'seattleu~sp-search',
        profile as string || '_default',
        tabId,
        result.data,
        isPopularTab
      );

      console.log(`Cached tab content for query: ${query}, tab: ${tabId}, popular: ${isPopularTab}`);
    } else {
      // Cache as regular search result
      const cacheKey = generateSearchCacheKey(
        query as string,
        collection as string || 'seattleu~sp-search',
        profile as string || '_default'
      );

      await setCachedData(cacheKey, result.data, 60 * 10); // 10 minutes TTL
      console.log(`Cached search result for key: ${cacheKey}`);
    }

    // Return the result
    res.status(200).send(result.data);
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
}

/**
 * Determine if request is for tab content
 * @param req - Next API request
 * @returns Whether this is a tab content request
 */
function isTabContentRequest(req: NextApiRequest): boolean {
  const { form, tab, profile } = req.query;

  // Check for explicit tab parameter
  if (tab) {
    return true;
  }

  // Check for tab-related profile
  if (profile && profile !== '_default') {
    return true;
  }

  // Check for form=partial which is often used for tabs
  if (form === 'partial') {
    return true;
  }

  // Check URL if available (for direct tab URLs)
  const referer = req.headers.referer || '';
  if (typeof referer === 'string' &&
    (referer.includes('tab=') || referer.includes('profile='))) {
    return true;
  }

  return false;
}

/**
 * Extract tab identifier from request
 * @param req - Next API request
 * @returns Tab identifier or null if not found
 */
function getTabId(req: NextApiRequest): string | null {
  const { tab, profile } = req.query;

  // If tab parameter exists, use it
  if (tab) {
    return tab as string;
  }

  // Otherwise use profile if it's not the default
  if (profile && profile !== '_default') {
    return profile as string;
  }

  // Try to extract from referer URL
  const referer = req.headers.referer || '';
  if (typeof referer === 'string') {
    // Try to extract tab parameter from URL
    const tabMatch = referer.match(/[?&]tab=([^&]+)/);
    if (tabMatch && tabMatch[1]) {
      return tabMatch[1];
    }

    // Try to extract profile parameter from URL
    const profileMatch = referer.match(/[?&]profile=([^&]+)/);
    if (profileMatch && profileMatch[1] && profileMatch[1] !== '_default') {
      return profileMatch[1];
    }
  }

  return null;
}