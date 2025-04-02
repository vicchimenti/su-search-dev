import type { NextApiRequest, NextApiResponse } from 'next';
import { getSearchResults } from '@/lib/api-client';
import { getCachedData, setCachedData, generateCacheKey, CACHE_TTL } from '@/lib/cache';

// Define an interface for the search parameters
interface SearchParams {
  query: string;
  collection: string;
  profile: string;
  form: string;
  [key: string]: string; // Allow additional string parameters
}

/**
 * Converts query parameters to a type-safe SearchParams object
 * @param query The query parameters from the request
 * @returns Processed SearchParams object
 */
function getSearchParams(query: NextApiRequest['query']): SearchParams {
  return {
    query: Array.isArray(query.query) ? query.query[0] : query.query || '',
    collection: Array.isArray(query.collection) ? query.collection[0] : 
               query.collection || process.env.DEFAULT_COLLECTION || 'seattleu~sp-search',
    profile: Array.isArray(query.profile) ? query.profile[0] : 
             query.profile || process.env.DEFAULT_PROFILE || '_default',
    form: 'partial',
    // Spread any additional string parameters
    ...Object.fromEntries(
      Object.entries(query)
        .filter(([, value]) => typeof value === 'string' || 
                (Array.isArray(value) && value.length > 0))
        .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
    )
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Convert query parameters to type-safe object
    const params = getSearchParams(req.query);
    
    // Validate required parameters
    if (!params.query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Generate cache key
    const cacheKey = generateCacheKey('search', params);
    
    // Try to get cached data first
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // If not cached, fetch from backend API
    const response = await getSearchResults(params);
    
    // Cache the response
    await setCachedData(cacheKey, response.data, CACHE_TTL.search);
    
    // Return the response
    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Search API error:', error);
    return res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error.message 
    });
  }
}