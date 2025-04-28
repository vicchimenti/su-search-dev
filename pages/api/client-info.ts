/**
 * @fileoverview Client Information API Endpoint
 * 
 * This API endpoint captures and returns client information including IP address.
 * It serves as the source of truth for client IP addresses throughout the application.
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @lastModified 2025-04-28
 */

import type { NextApiRequest, NextApiResponse } from 'next';

// Interface for the response data
interface ClientInfoResponse {
    ip: string;
    source: string;
    timestamp: number;
}

// Interface for error response
interface ErrorResponse {
    error: string;
}

/**
 * Extracts the client IP address from various request headers
 * @param req - Next.js API request object
 * @returns The extracted IP address and its source
 */
function extractClientIp(req: NextApiRequest): { ip: string; source: string } {
    // Log all headers for debugging
    console.log('CLIENT-INFO: All request headers:', JSON.stringify(req.headers));

    // Check x-forwarded-for header (common for proxied requests)
    if (req.headers['x-forwarded-for']) {
        const forwardedIps = Array.isArray(req.headers['x-forwarded-for'])
            ? req.headers['x-forwarded-for'][0]
            : req.headers['x-forwarded-for'];

        // Extract the first IP in the list (the original client)
        const clientIp = forwardedIps.split(',')[0].trim();
        console.log(`CLIENT-INFO: Extracted IP from x-forwarded-for: ${clientIp}`);
        return { ip: clientIp, source: 'x-forwarded-for' };
    }

    // Check x-real-ip header (used by some proxies)
    if (req.headers['x-real-ip']) {
        const realIp = Array.isArray(req.headers['x-real-ip'])
            ? req.headers['x-real-ip'][0]
            : req.headers['x-real-ip'];
        console.log(`CLIENT-INFO: Extracted IP from x-real-ip: ${realIp}`);
        return { ip: realIp, source: 'x-real-ip' };
    }

    // Check true-client-ip header (used by Cloudflare)
    if (req.headers['true-client-ip']) {
        const trueClientIp = Array.isArray(req.headers['true-client-ip'])
            ? req.headers['true-client-ip'][0]
            : req.headers['true-client-ip'];
        console.log(`CLIENT-INFO: Extracted IP from true-client-ip: ${trueClientIp}`);
        return { ip: trueClientIp, source: 'true-client-ip' };
    }

    // Check cf-connecting-ip header (Cloudflare specific)
    if (req.headers['cf-connecting-ip']) {
        const cfIp = Array.isArray(req.headers['cf-connecting-ip'])
            ? req.headers['cf-connecting-ip'][0]
            : req.headers['cf-connecting-ip'];
        console.log(`CLIENT-INFO: Extracted IP from cf-connecting-ip: ${cfIp}`);
        return { ip: cfIp, source: 'cf-connecting-ip' };
    }

    // Fall back to remoteAddress from the connection
    // Note: In Vercel and other serverless environments, this might not be reliable
    if (req.socket && req.socket.remoteAddress) {
        console.log(`CLIENT-INFO: Extracted IP from socket remoteAddress: ${req.socket.remoteAddress}`);
        return { ip: req.socket.remoteAddress, source: 'socket' };
    }

    // Return unknown if no IP found
    console.warn('CLIENT-INFO: Could not extract IP address from request');
    return { ip: '0.0.0.0', source: 'unknown' };
}

/**
 * API handler for client information
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default function handler(
    req: NextApiRequest,
    res: NextApiResponse<ClientInfoResponse | ErrorResponse>
) {
    // Set CORS headers to allow requests from your main domain
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
        console.error(`CLIENT-INFO: Method not allowed: ${req.method}`);
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        console.log('CLIENT-INFO: Processing client info request');

        // Extract client IP address
        const { ip, source } = extractClientIp(req);

        // Log the final IP resolution
        console.log(`CLIENT-INFO: Resolved IP ${ip} from source ${source}`);

        // Return client information
        const responseData: ClientInfoResponse = {
            ip,
            source,
            timestamp: Date.now()
        };

        // Log full response data
        console.log(`CLIENT-INFO: Returning data: ${JSON.stringify(responseData)}`);

        // Add cache control headers to prevent caching
        res.setHeader('Cache-Control', 'no-store, max-age=0');

        // Send response
        res.status(200).json(responseData);
    } catch (error) {
        // Log any errors
        console.error('CLIENT-INFO: Error processing request:', error);

        // Return error response
        res.status(500).json({ error: 'Failed to process client information' });
    }
}