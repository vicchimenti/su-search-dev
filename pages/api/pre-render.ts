/**
 * @fileoverview Smart Pre-Render API for Instant Search Results
 * 
 * This endpoint handles background pre-rendering of search results to enable
 * near-instantaneous search redirects. It works by accepting search queries
 * during form submission, fetching results from the Funnelback backend, and
 * caching them for immediate retrieval when the user lands on the search page.
 *
 * Key Features:
 * - Fire-and-forget pre-rendering (non-blocking for user experience)
 * - SessionService integration for analytics continuity
 * - Uses existing cache infrastructure for consistency
 * - Graceful error handling with silent failures
 * - IP forwarding for accurate backend requests
 * - Extended TTL for pre-rendered content (2 hours)
 *
 * Integration:
 * - Called by integration.js during header form submission
 * - Uses established SessionService ID for session continuity
 * - Leverages existing API client and cache systems
 * - Falls back silently on any failures
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 1.0.2
 * @lastModified 2025-09-04
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createApiClient } from '../../lib/api-client';
import { setCachedSearchResults } from '../../lib/cache';
import { getClientInfo } from '../../lib/ip-service';

/**
 * Interface for pre-render request body
 */
interface PreRenderRequest {
  /** Search query to pre-render */
  query: string;
  /** Established session ID from SessionService for continuity */
  sessionId?: string;
  /** Optional collection override */
  collection?: string;
  /** Optional profile override */
  profile?: string;
}

/**
 * Interface for pre-render response
 */
interface PreRenderResponse {
  /** Response status */
  status: string;
  /** Whether the request was accepted for processing */
  accepted?: boolean;
  /** Cache key generated for the query */
  cacheKey?: string;
  /** The query that was processed */
  query?: string;
  /** Session ID used for the request */
  sessionId?: string;
  /** Error message if request failed */
  message?: string;
  /** Error details for debugging */
  error?: string;
}

/**
 * Smart Pre-Render API Handler
 * 
 * This endpoint accepts pre-render requests and initiates background fetching
 * of search results. It's designed to be called during form submission to
 * prepare results before the user lands on the search page.
 * 
 * The implementation is fire-and-forget - it returns immediately to avoid
 * blocking the user's redirect, while the actual fetching and caching
 * happens asynchronously in the background.
 * 
 * @param req - Next.js API request containing the search query and session ID
 * @param res - Next.js API response with acceptance confirmation
 * @returns Promise resolving to API response
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PreRenderResponse>
) {
  // Set CORS headers for cross-origin requests if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests for pre-rendering
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed - use POST' 
    });
  }
  
  const startTime = Date.now();
  
  try {
    // Extract and validate request data
    const { 
      query, 
      sessionId, 
      collection = 'seattleu~sp-search',
      profile = '_default'
    }: PreRenderRequest = req.body;
    
    // Basic validation - query is required
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      console.log('[PRE-RENDER] Invalid query provided:', query);
      return res.status(400).json({ 
        status: 'error', 
        message: 'Valid query parameter is required' 
      });
    }
    
    // Normalize the query string for consistency
    const normalizedQuery = query.trim();
    
    // Use established session ID or create fallback for pre-rendering
    const useSessionId = sessionId || `prerender_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    console.log(`[PRE-RENDER] Initiating pre-render for query: "${normalizedQuery}" with session: ${useSessionId.substring(0, 12)}...`);
    
    // Resolve client IP information for accurate backend request
    const clientInfo = await getClientInfo(req.headers);
    console.log(`[PRE-RENDER] Resolved client IP: ${clientInfo.ip} (${clientInfo.source})`);
    
    // Create API client with client IP forwarding using existing infrastructure
    const apiClient = createApiClient(req.headers, { cacheAware: true });
    
    // Prepare search parameters matching existing API format
    const searchParams: Record<string, string> = {
      query: normalizedQuery,
      collection: collection,
      profile: profile,
      form: 'partial',
      sessionId: useSessionId
    };

    // Add client IP if available for accurate backend tracking
    if (clientInfo?.ip) {
      searchParams.clientIp = clientInfo.ip;
    }

    console.log(`[PRE-RENDER] Search parameters:`, {
      query: normalizedQuery,
      collection,
      profile,
      sessionId: useSessionId.substring(0, 12) + '...',
      hasClientIp: !!clientInfo?.ip
    });

    // Fire-and-forget: Initiate background fetch and cache
    // This Promise runs asynchronously and won't block the response
    apiClient.get('/funnelback/search', { params: searchParams })
      .then(response => {
        const fetchTime = Date.now() - startTime;
        
        if (response.status === 200 && response.data) {
          console.log(`[PRE-RENDER] Backend fetch successful for "${normalizedQuery}" in ${fetchTime}ms`);
          
          // Cache with extended TTL for pre-rendered content (2 hours)
          // Using existing cache infrastructure for consistency
          setCachedSearchResults(normalizedQuery, collection, profile, response.data, 7200)
            .then(cacheSuccess => {
              const totalTime = Date.now() - startTime;
              if (cacheSuccess) {
                console.log(`[PRE-RENDER] Successfully cached results for "${normalizedQuery}" (total: ${totalTime}ms)`);
                
                // Log cache key for debugging if needed
                console.log(`[PRE-RENDER] Cache key: search:${normalizedQuery.toLowerCase()}:${collection}:${profile}`);
              } else {
                console.warn(`[PRE-RENDER] Cache storage failed for "${normalizedQuery}" after ${totalTime}ms`);
              }
            })
            .catch(cacheError => {
              console.error(`[PRE-RENDER] Cache error for "${normalizedQuery}":`, cacheError.message);
            });
            
        } else {
          console.warn(`[PRE-RENDER] Backend returned status ${response.status} for "${normalizedQuery}" in ${fetchTime}ms`);
        }
      })
      .catch(error => {
        const fetchTime = Date.now() - startTime;
        console.error(`[PRE-RENDER] Backend fetch failed for "${normalizedQuery}" after ${fetchTime}ms:`, error.message);
        // Silent failure - pre-rendering is best effort and should never impact user experience
      });

    // Return immediately with acceptance status
    // The user's redirect won't be blocked while caching happens in background
    const responseData: PreRenderResponse = {
      status: 'accepted',
      accepted: true,
      query: normalizedQuery,
      sessionId: useSessionId,
      cacheKey: `search:${normalizedQuery.toLowerCase()}:${collection}:${profile}`
    };

    console.log(`[PRE-RENDER] Request accepted and processing initiated for "${normalizedQuery}"`);
    
    return res.status(202).json(responseData);

  } catch (error) {
    // Log error but don't expose internal details
    const processingTime = Date.now() - startTime;
    console.error(`[PRE-RENDER] Unhandled error after ${processingTime}ms:`, error);
    
    // Return generic error to avoid exposing internals
    return res.status(500).json({ 
      status: 'error',
      message: 'Pre-render request failed - will fall back to standard search',
      error: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    });
  }
}