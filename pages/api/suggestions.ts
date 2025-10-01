/**
 * @fileoverview Server-side API for rendered suggestions
 * 
 * This API endpoint handles suggestion requests, fetches results from the backend API,
 * and returns server-side rendered suggestions for autocomplete. Includes client IP
 * preservation for accurate analytics and personalization.
 *
 * @author Victor Chimenti
 * @version 3.1.0
 * @lastModified 2025-10-01
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createApiClient } from '../../lib/api-client';
import { setCachedData, getCachedData, DEFAULT_TTL } from '../../lib/cache';
import { getClientInfo, getClientIpHeaders } from '../../lib/ip-service';

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

  const { query, type, collection, profile, sessionId } = req.query;

  // Basic validation
  if (!query) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  try {
    // Resolve client IP information
    console.log(`[SUGGESTIONS-API] Resolving client IP information`);
    const clientInfo = await getClientInfo(req.headers);
    console.log(`[SUGGESTIONS-API] Resolved client IP: ${clientInfo.ip} (${clientInfo.source})`);

    // Add IP metadata to response headers for debugging/monitoring
    res.setHeader('X-Client-IP-Source', clientInfo.source);

    // Generate cache key
    const cacheKey = `suggestions:${type || 'all'}:${query}:${collection || 'default'}`;

    // Try to get from cache first
    const cachedResult = await getCachedData(cacheKey);
    if (cachedResult) {
      console.log(`[SUGGESTIONS-API] Cache hit for ${cacheKey}`);
      res.setHeader('X-Cache-Status', 'HIT');
      return res.status(200).json(cachedResult);
    }

    console.log(`[SUGGESTIONS-API] Cache miss for ${cacheKey}`);
    res.setHeader('X-Cache-Status', 'MISS');

    // Create API client with client IP propagation
    const apiClient = createApiClient(req.headers);

    // Add the client IP info to request log
    console.log(`[SUGGESTIONS-API] Using client IP: ${clientInfo.ip} (${clientInfo.source}) for backend request`);

    // Handle different suggestion types
    let result;

    switch (type) {
      case 'general':
        console.log(`[SUGGESTIONS-API] Fetching general suggestions for query: ${query}`);
        result = await fetchGeneralSuggestions(query as string, sessionId as string, apiClient);
        break;
      case 'staff':
        console.log(`[SUGGESTIONS-API] Fetching staff suggestions for query: ${query}`);
        result = await fetchStaffSuggestions(query as string, sessionId as string, apiClient);
        break;
      case 'programs':
        console.log(`[SUGGESTIONS-API] Fetching program suggestions for query: ${query}`);
        result = await fetchProgramSuggestions(query as string, sessionId as string, apiClient);
        break;
      default:
        // Fetch all types in parallel
        console.log(`[SUGGESTIONS-API] Fetching all suggestion types for query: ${query}`);
        const [general, staff, programs] = await Promise.all([
          fetchGeneralSuggestions(query as string, sessionId as string, apiClient),
          fetchStaffSuggestions(query as string, sessionId as string, apiClient),
          fetchProgramSuggestions(query as string, sessionId as string, apiClient)
        ]);

        result = {
          general,
          staff,
          programs
        };
    }

    // Cache the result
    await setCachedData(cacheKey, result, DEFAULT_TTL); // 12 hours TTL
    console.log(`[SUGGESTIONS-API] Cached suggestions for key: ${cacheKey}, TTL: ${DEFAULT_TTL}s`);
    
    // Return the result
    res.status(200).json(result);
  } catch (error) {
    console.error('[SUGGESTIONS-API] Suggestions API error:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
}

// Helper functions for fetching different suggestion types
async function fetchGeneralSuggestions(query: string, sessionId?: string, apiClient?: any) {
  console.log(`[SUGGESTIONS-API] Fetching general suggestions for: "${query}"`);

  const params = {
    partial_query: query,
    collection: 'seattleu~sp-search',
    profile: '_default',
    sessionId
  };

  try {
    const client = apiClient || createApiClient();
    const response = await client.get('/funnelback/suggest', { params });
    return response.data;
  } catch (error) {
    console.error('[SUGGESTIONS-API] Error fetching general suggestions:', error);
    throw error;
  }
}

async function fetchStaffSuggestions(query: string, sessionId?: string, apiClient?: any) {
  console.log(`[SUGGESTIONS-API] Fetching staff suggestions for: "${query}"`);

  const params = {
    query,
    sessionId
  };

  try {
    const client = apiClient || createApiClient();
    const response = await client.get('/suggestPeople', { params });
    return response.data;
  } catch (error) {
    console.error('[SUGGESTIONS-API] Error fetching staff suggestions:', error);
    throw error;
  }
}

async function fetchProgramSuggestions(query: string, sessionId?: string, apiClient?: any) {
  console.log(`[SUGGESTIONS-API] Fetching program suggestions for: "${query}"`);

  const params = {
    query,
    sessionId
  };

  try {
    const client = apiClient || createApiClient();
    const response = await client.get('/suggestPrograms', { params });
    return response.data;
  } catch (error) {
    console.error('[SUGGESTIONS-API] Error fetching program suggestions:', error);
    throw error;
  }
}