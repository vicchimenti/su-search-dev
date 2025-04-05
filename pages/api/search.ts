/**
 * @fileoverview Server-side API for rendered search results
 * 
 * This API endpoint handles search requests, fetches results from the backend API,
 * and returns server-side rendered search results.
 *
 * @author Victor Chimenti
 * @version 1.1.0
 * @lastModified 2025-04-04
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { backendApiClient } from '../../lib/api-client';
import { getCachedData, setCachedData } from '../../lib/cache';
// Import the session manager
import SessionManager, { getSessionId } from '../../lib/session-manager';

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

  const { query, collection, profile, sessionId: requestSessionId } = req.query;

  // Basic validation
  if (!query) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  // Get a consistent session ID (either from request or generate a new one)
  const sessionId = (requestSessionId as string) || getSessionId();

  try {
    // Generate cache key
    const cacheKey = `search:${query}:${collection || 'default'}:${profile || 'default'}`;

    // Try to get from cache first
    const cachedResult = await getCachedData(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.status(200).send(cachedResult);
    }

    // Prepare parameters for backend API
    const params = {
      query,
      collection: collection || 'seattleu~sp-search',
      profile: profile || '_default',
      sessionId, // Send the consistent session ID
      form: 'partial'
    };

    // Fetch from backend API
    const result = await backendApiClient.get('/funnelback/search', { params });
    
    // Cache the result
    await setCachedData(cacheKey, result.data, 60 * 10); // 10 minutes TTL
    
    // Return the result
    res.status(200).send(result.data);
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
}