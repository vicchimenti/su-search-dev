import type { NextApiRequest, NextApiResponse } from 'next';
import { getSearchSuggestions } from '@/lib/api-client';
import { getCachedData, setCachedData, generateCacheKey, CACHE_TTL } from '@/lib/cache';

// Define an interface for the search suggestions parameters
interface SearchParams {
  query: string;
  partial_query?: string;
  collection: string;
  profile: string;
  form?: string;
  [key: string]: string | undefined;
}

/**
 * Converts query parameters to a type-safe SearchParams object
 * @param query The query parameters from the request
 * @returns Processed SearchParams object
 */
function getSuggestionsParams(query: NextApiRequest['query']): SearchParams {
  // Prioritize 'query', fall back to 'partial_query'
  const queryValue = Array.isArray(query.query) 
    ? query.query[0] 
    : query.query;

  const partialQueryValue = Array.isArray(query.partial_query) 
    ? query.partial_query[0] 
    : query.partial_query;

  return {
    // Ensure 'query' is always a string, using either query or partial_query
    query: queryValue || partialQueryValue || '',
    partial_query: partialQueryValue,
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
    const params = getSuggestionsParams(req.query);
    
    // Validate required parameters - ensure query is not empty
    if (!params.query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Generate cache key
    const cacheKey = generateCacheKey('suggestions', params);
    
    // Try to get cached data first
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // If not cached, fetch from backend API
    // Use type assertion to match the expected input
    const response = await getSearchSuggestions({
      ...params,
      query: params.query // Ensure query is always present
    });
    
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