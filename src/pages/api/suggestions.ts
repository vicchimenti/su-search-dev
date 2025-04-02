import type { NextApiRequest, NextApiResponse } from 'next';
import { getSearchSuggestions } from '@/lib/api-client';
import { getCachedData, setCachedData, generateCacheKey, CACHE_TTL } from '@/lib/cache';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, partial_query, collection, profile, ...rest } = req.query;
    
    // Use either query or partial_query
    const searchQuery = query || partial_query;
    
    // Validate required parameters
    if (!searchQuery) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Prepare parameters for backend API
    const params = {
      partial_query: searchQuery,
      collection: collection || process.env.DEFAULT_COLLECTION || 'seattleu~sp-search',
      profile: profile || process.env.DEFAULT_PROFILE || '_default',
      ...rest
    };

    // Generate cache key
    const cacheKey = generateCacheKey('suggestions', params);
    
    // Try to get cached data first
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // If not cached, fetch from backend API
    const response = await getSearchSuggestions(params);
    
    // Cache the response
    await setCachedData(cacheKey, response.data, CACHE_TTL.suggestions);
    
    // Return the response
    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Suggestions API error:', error);
    return res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error.message 
    });
  }
}