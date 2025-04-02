/**
 * @fileoverview API for client-side enhancements
 * 
 * This API provides enhanced functionality for the client-side search experience,
 * including analytics tracking, personalization, and additional features.
 *
 * @author Victor Chimenti
 * @version 1.0.0
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
      // Handle click tracking
      if (req.body.type === 'click') {
        return handleClickTracking(req, res);
      }
      
      // Handle other enhancement requests
      return res.status(400).json({ error: 'Unknown enhancement type' });
      
    case 'GET':
      // Return configuration for client-side
      return res.status(200).json({
        endpoints: {
          search: '/api/search',
          suggestions: '/api/suggestions',
          enhance: '/api/enhance'
        },
        defaultCollection: 'seattleu~sp-search',
        defaultProfile: '_default',
        minQueryLength: 3,
        version: '1.0.0'
      });
      
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle click tracking requests
 */
async function handleClickTracking(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { originalQuery, clickedUrl, clickedTitle, clickPosition, sessionId } = req.body;
    
    // Validate required fields
    if (!originalQuery || !clickedUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Forward to backend API
    await backendApiClient.post('/analytics/click', {
      originalQuery,
      clickedUrl,
      clickedTitle: clickedTitle || '',
      clickPosition: clickPosition || -1,
      sessionId: sessionId || '',
      timestamp: new Date().toISOString()
    });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Click tracking error:', error);
    return res.status(500).json({ error: 'Failed to record click' });
  }
}