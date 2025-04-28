/**
 * @fileoverview Client IP API endpoint
 * 
 * This API endpoint provides a reliable way to determine the client's real IP address
 * from the server-side, extracting it from various request headers. It also returns
 * additional geolocation metadata if available from provider headers.
 *
 * Features:
 * - Intelligent IP extraction from multiple header sources
 * - Prioritizes most reliable sources of client IP
 * - Returns additional geolocation metadata when available
 * - Detailed logging for tracing and debugging
 * - CORS configuration for secure access
 *
 * @author Victor Chimenti
 * @version 2.1.1
 * @lastModified 2025-04-28
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import ipService from '@/lib/ip-service';

interface ClientIPResponse {
  ip: string;
  metadata?: {
    city?: string | null;
    region?: string | null;
    country?: string | null;
    timezone?: string | null;
    latitude?: string | null;
    longitude?: string | null;
  };
  source?: string;
}

// Error response type
interface ErrorResponse {
  error: string;
}

/**
 * Handler for client-ip API endpoint
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClientIPResponse | ErrorResponse>
) {
  console.log('[client-ip API] Received request');

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[client-ip API] Responding to OPTIONS request');
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    console.error(`[client-ip API] Method not allowed: ${req.method}`);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Log all headers for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[client-ip API] Request headers:', req.headers);
    }

    // Extract client IP using intelligent algorithm
    const { ip, source } = extractClientIP(req);
    console.log(`[client-ip API] Extracted client IP: ${ip} (Source: ${source})`);

    // Extract geolocation metadata if available
    const metadata = extractGeolocationMetadata(req);

    // Log the full response in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('[client-ip API] Full response:', { ip, metadata, source });
    }

    // Return the client IP and metadata
    res.status(200).json({
      ip,
      metadata,
      source
    });
  } catch (error) {
    console.error('[client-ip API] Error extracting client IP:', error);
    res.status(500).json({ error: 'Failed to determine client IP' });
  }
}

/**
 * Extract the client IP address from request headers
 * Uses an intelligent algorithm to prioritize the most reliable sources
 * @param req - Next.js API request
 * @returns The client IP and its source
 */
function extractClientIP(req: NextApiRequest): { ip: string; source: string } {
  // Check for Vercel-specific headers first (most reliable in Vercel environment)
  const vercelIP = req.headers['x-vercel-ip'];
  if (vercelIP) {
    const ip = Array.isArray(vercelIP) ? vercelIP[0] : vercelIP;
    return { ip, source: 'x-vercel-ip' };
  }

  // Check for existing Real-Client-IP header (may be set by client)
  const realClientIP = req.headers['x-real-client-ip'];
  if (realClientIP) {
    const ip = Array.isArray(realClientIP) ? realClientIP[0] : realClientIP;
    return { ip, source: 'x-real-client-ip' };
  }

  // Check for Cloudflare headers
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  if (cfConnectingIP) {
    const ip = Array.isArray(cfConnectingIP) ? cfConnectingIP[0] : cfConnectingIP;
    return { ip, source: 'cf-connecting-ip' };
  }

  // Check for x-forwarded-for (common but less reliable)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Get the first IP in the list which is typically the original client
    const ips = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor.split(',')[0].trim();
    return { ip: ips, source: 'x-forwarded-for' };
  }

  // Check for other common headers
  const trueClientIP = req.headers['x-client-ip'];
  if (trueClientIP) {
    const ip = Array.isArray(trueClientIP) ? trueClientIP[0] : trueClientIP;
    return { ip, source: 'x-client-ip' };
  }

  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    const ip = Array.isArray(realIP) ? realIP[0] : realIP;
    return { ip, source: 'x-real-ip' };
  }

  // Use socket address as last resort
  const remoteAddress = req.socket.remoteAddress;
  if (remoteAddress) {
    return { ip: remoteAddress, source: 'socket' };
  }

  // If all else fails, return a placeholder
  console.warn('[client-ip API] Could not determine client IP from any source');
  return { ip: '0.0.0.0', source: 'unknown' };
}

/**
 * Extract geolocation metadata from request headers
 * @param req - Next.js API request
 * @returns Geolocation metadata object
 */
function extractGeolocationMetadata(req: NextApiRequest): ClientIPResponse['metadata'] {
  const metadata: ClientIPResponse['metadata'] = {};

  // Extract location data from Vercel headers
  try {
    // City
    if (req.headers['x-vercel-ip-city']) {
      metadata.city = Array.isArray(req.headers['x-vercel-ip-city'])
        ? req.headers['x-vercel-ip-city'][0]
        : req.headers['x-vercel-ip-city'];
    }

    // Region
    if (req.headers['x-vercel-ip-region']) {
      metadata.region = Array.isArray(req.headers['x-vercel-ip-region'])
        ? req.headers['x-vercel-ip-region'][0]
        : req.headers['x-vercel-ip-region'];
    }

    // Country
    if (req.headers['x-vercel-ip-country']) {
      metadata.country = Array.isArray(req.headers['x-vercel-ip-country'])
        ? req.headers['x-vercel-ip-country'][0]
        : req.headers['x-vercel-ip-country'];
    }

    // Timezone
    if (req.headers['x-vercel-ip-timezone']) {
      metadata.timezone = Array.isArray(req.headers['x-vercel-ip-timezone'])
        ? req.headers['x-vercel-ip-timezone'][0]
        : req.headers['x-vercel-ip-timezone'];
    }

    // Latitude
    if (req.headers['x-vercel-ip-latitude']) {
      metadata.latitude = Array.isArray(req.headers['x-vercel-ip-latitude'])
        ? req.headers['x-vercel-ip-latitude'][0]
        : req.headers['x-vercel-ip-latitude'];
    }

    // Longitude
    if (req.headers['x-vercel-ip-longitude']) {
      metadata.longitude = Array.isArray(req.headers['x-vercel-ip-longitude'])
        ? req.headers['x-vercel-ip-longitude'][0]
        : req.headers['x-vercel-ip-longitude'];
    }
  } catch (error) {
    console.warn('[client-ip API] Error extracting geolocation metadata:', error);
  }

  // Check for Cloudflare headers as fallback
  try {
    if (!metadata.country && req.headers['cf-ipcountry']) {
      metadata.country = Array.isArray(req.headers['cf-ipcountry'])
        ? req.headers['cf-ipcountry'][0]
        : req.headers['cf-ipcountry'];
    }
  } catch (error) {
    console.warn('[client-ip API] Error extracting Cloudflare country:', error);
  }

  return metadata;
}