/**
 * @fileoverview API for client-side enhancements
 * 
 * This API provides enhanced functionality for the client-side search experience,
 * including analytics tracking, personalization, and additional features.
 *
 * @author Victor Chimenti
 * @version 1.1.1
 * @lastModified 2025-04-09
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { backendApiClient } from '../../lib/api-client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.seattleu.edu');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle different request types
  switch (req.method) {
    case 'POST':
      // Notify about deprecated click tracking through this endpoint
      if (req.body.type === 'click') {
        return handleDeprecatedClickTracking(req, res);
      }
      
      // Handle other enhancement requests
      return res.status(400).json({ error: 'Unknown enhancement type' });
      
    case 'GET':
      // Return configuration for client-side
      return res.status(200).json({
        endpoints: {
          search: '/api/search',
          suggestions: '/api/suggestions',
          enhance: '/api/enhance',
          // Add direct analytics endpoints for clarity
          analytics: {
            click: '/proxy/analytics/click',
            clicksBatch: '/proxy/analytics/clicks-batch',
            supplement: '/proxy/analytics/supplement'
          }
        },
        defaultCollection: 'seattleu~sp-search',
        defaultProfile: '_default',
        minQueryLength: 3,
        version: '1.1.1'
      });
      
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle deprecated click tracking requests
 * This function exists to provide backward compatibility
 * but logs a warning that this endpoint should no longer be used for click tracking
 */
async function handleDeprecatedClickTracking(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.warn('Click tracking through /api/enhance is deprecated. Use direct analytics endpoints instead.');
    
    // Still forward the request to maintain backward compatibility
    // but return a message indicating this is deprecated
    const { originalQuery, clickedUrl, clickedTitle, clickPosition, sessionId } = req.body;
    
    // Validate required fields
    if (!originalQuery || !clickedUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Forward to backend API to maintain backward compatibility
    await backendApiClient.post('/analytics/click', {
      originalQuery,
      clickedUrl,
      clickedTitle: clickedTitle || '',
      clickPosition: clickPosition || -1,
      sessionId: sessionId || '',
      timestamp: new Date().toISOString(),
      clickType: 'search' // Add default clickType for compatibility
    });
    
    return res.status(200).json({ 
      success: true,
      message: 'Click tracking through this endpoint is deprecated. Use direct analytics endpoints instead.'
    });
  } catch (error) {
    console.error('Click tracking error:', error);
    return res.status(500).json({ error: 'Failed to record click' });
  }
}