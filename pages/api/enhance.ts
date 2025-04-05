/**
 * @fileoverview API for client-side enhancements
 * 
 * This API provides enhanced functionality for the client-side search experience,
 * including analytics tracking, personalization, and additional features.
 *
 * @author Victor Chimenti
 * @version 1.1.0
 * @lastModified 2025-04-05
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { backendApiClient } from '../../lib/api-client';
// Import the session manager
import SessionManager, { getSessionId } from '../../lib/session-manager';

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
      
      // Handle event tracking
      if (req.body.type === 'events') {
        return handleEventTracking(req, res);
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
    // Get fields from request body
    const { originalQuery, clickedUrl, clickedTitle, clickPosition, sessionId: requestSessionId } = req.body;
    
    // Validate required fields
    if (!originalQuery || !clickedUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get a consistent session ID (either from request or generate a new one)
    const sessionId = requestSessionId || getSessionId();
    
    // Forward to backend API
    await backendApiClient.post('/analytics/click', {
      originalQuery,
      clickedUrl,
      clickedTitle: clickedTitle || '',
      clickPosition: clickPosition || -1,
      sessionId,
      timestamp: new Date().toISOString()
    });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Click tracking error:', error);
    return res.status(500).json({ error: 'Failed to record click' });
  }
}

/**
 * Handle batch event tracking requests
 */
async function handleEventTracking(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { events, sessionId: requestSessionId } = req.body;
    
    // Validate required fields
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid events array' });
    }
    
    // Get a consistent session ID (either from request or generate a new one)
    const sessionId = requestSessionId || getSessionId();
    
    // Process each event and forward to backend API
    const results = await Promise.all(events.map(async (event) => {
      try {
        // Ensure each event has the consistent sessionId
        const eventData = {
          ...event,
          data: {
            ...event.data,
            sessionId
          },
          timestamp: event.timestamp || new Date().toISOString()
        };
        
        await backendApiClient.post('/analytics/event', eventData);
        return { success: true, event: event.type };
      } catch (error) {
        console.error(`Error processing event ${event.type}:`, error);
        return { success: false, event: event.type, error: (error as Error).message };
      }
    }));
    
    return res.status(200).json({ 
      success: true,
      results,
      processedCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length
    });
  } catch (error) {
    console.error('Event tracking error:', error);
    return res.status(500).json({ error: 'Failed to process events' });
  }
}