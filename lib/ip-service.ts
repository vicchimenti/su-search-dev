/**
 * @fileoverview IP Resolution Service
 * 
 * This module provides services for resolving, caching, and managing client IP addresses.
 * It centralizes IP resolution logic for both client and server-side contexts.
 *
 * @author Victor Chimenti
 * @version 1.0.0
 * @lastModified 2025-04-28
 */

// Cache options
const IP_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const FETCH_TIMEOUT = 3000; // 3 seconds timeout for fetch requests

// Type for client information
export interface ClientInfo {
    ip: string;
    source: string;
    timestamp: number;
}

// Cache for client IP information
let cachedClientInfo: ClientInfo | null = null;
let cachedTimestamp = 0;

/**
 * Determines if we're in a server context
 * @returns Whether code is running on server
 */
export function isServer(): boolean {
    return typeof window === 'undefined';
}

/**
 * Extracts client IP from request headers (server-side only)
 * @param headers - Request headers
 * @returns Client information with IP and source
 */
export function extractClientIpFromHeaders(headers: any): ClientInfo {
    console.log('IP-SERVICE: Extracting client IP from headers');

    if (!headers) {
        console.warn('IP-SERVICE: No headers provided for extraction');
        return { ip: '0.0.0.0', source: 'none', timestamp: Date.now() };
    }

    // Log headers for debugging (with sensitive information redacted)
    const redactedHeaders = { ...headers };
    ['cookie', 'authorization'].forEach(key => {
        if (redactedHeaders[key]) redactedHeaders[key] = '[REDACTED]';
    });
    console.log('IP-SERVICE: Headers for extraction:', JSON.stringify(redactedHeaders));

    // Check x-forwarded-for header (common for proxied requests)
    if (headers['x-forwarded-for']) {
        const forwardedIps = Array.isArray(headers['x-forwarded-for'])
            ? headers['x-forwarded-for'][0]
            : headers['x-forwarded-for'];

        // Extract the first IP in the list (the original client)
        const clientIp = forwardedIps.split(',')[0].trim();
        console.log(`IP-SERVICE: Extracted IP from x-forwarded-for: ${clientIp}`);
        return { ip: clientIp, source: 'x-forwarded-for', timestamp: Date.now() };
    }

    // Check x-real-ip header (used by some proxies)
    if (headers['x-real-ip']) {
        const realIp = Array.isArray(headers['x-real-ip'])
            ? headers['x-real-ip'][0]
            : headers['x-real-ip'];
        console.log(`IP-SERVICE: Extracted IP from x-real-ip: ${realIp}`);
        return { ip: realIp, source: 'x-real-ip', timestamp: Date.now() };
    }

    // Check other common headers
    const ipHeaders = [
        'true-client-ip',       // Used by Cloudflare and some CDNs
        'cf-connecting-ip',     // Cloudflare-specific
        'x-client-ip',          // Custom header often used for forwarding
        'x-cluster-client-ip',  // Used by some load balancers
        'forwarded'             // Standard header (RFC 7239)
    ];

    for (const header of ipHeaders) {
        if (headers[header]) {
            const ip = Array.isArray(headers[header]) ? headers[header][0] : headers[header];
            console.log(`IP-SERVICE: Extracted IP from ${header}: ${ip}`);
            return { ip, source: header, timestamp: Date.now() };
        }
    }

    // Fall back to socket address if available in request
    if (headers['x-forwarded-host'] && headers.connection?.remoteAddress) {
        console.log(`IP-SERVICE: Using socket remote address: ${headers.connection.remoteAddress}`);
        return {
            ip: headers.connection.remoteAddress,
            source: 'socket',
            timestamp: Date.now()
        };
    }

    // No IP found
    console.warn('IP-SERVICE: Could not extract IP address from headers');
    return { ip: '0.0.0.0', source: 'unknown', timestamp: Date.now() };
}

/**
 * Sets client info in the cache
 * @param clientInfo - Client information to cache
 */
export function setCachedClientInfo(clientInfo: ClientInfo): void {
    console.log(`IP-SERVICE: Caching client info - IP: ${clientInfo.ip}, Source: ${clientInfo.source}`);
    cachedClientInfo = clientInfo;
    cachedTimestamp = Date.now();
}

/**
 * Gets cached client info if valid
 * @returns Cached client info or null if expired
 */
export function getCachedClientInfo(): ClientInfo | null {
    const now = Date.now();
    if (cachedClientInfo && now - cachedTimestamp < IP_CACHE_DURATION) {
        console.log(`IP-SERVICE: Using cached client info - IP: ${cachedClientInfo.ip}, Age: ${(now - cachedTimestamp) / 1000}s`);
        return cachedClientInfo;
    }

    if (cachedClientInfo) {
        console.log('IP-SERVICE: Cached client info expired');
    } else {
        console.log('IP-SERVICE: No cached client info available');
    }

    return null;
}

/**
 * Clears the client info cache
 */
export function clearClientInfoCache(): void {
    console.log('IP-SERVICE: Clearing client info cache');
    cachedClientInfo = null;
    cachedTimestamp = 0;
}

/**
 * Validates an IP address format
 * @param ip - IP address to validate
 * @returns Whether IP format is valid
 */
export function isValidIpAddress(ip: string): boolean {
    // IPv4 format validation
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = ip.match(ipv4Regex);

    if (ipv4Match) {
        const octets = ipv4Match.slice(1, 5).map(Number);
        return octets.every(octet => octet >= 0 && octet <= 255);
    }

    // IPv6 format validation (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^::1$|^([0-9a-fA-F]{1,4}:){1,7}:$|^:([0-9a-fA-F]{1,4}:){1,7}$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$/;
    return ipv6Regex.test(ip);
}

/**
 * Fetches client info from the client-info API
 * @returns Promise resolving to client info
 */
export async function fetchClientInfo(): Promise<ClientInfo> {
    console.log('IP-SERVICE: Fetching client info from API');

    // First, check if we have a valid cached value
    const cachedInfo = getCachedClientInfo();
    if (cachedInfo) {
        return cachedInfo;
    }

    try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('IP-SERVICE: Client info fetch timeout')), FETCH_TIMEOUT);
        });

        // Create fetch promise
        const fetchPromise = fetch('/api/client-info')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`IP-SERVICE: API responded with status ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`IP-SERVICE: Successfully fetched client info - IP: ${data.ip}, Source: ${data.source}`);

                // Validate the IP address format
                if (!isValidIpAddress(data.ip)) {
                    console.warn(`IP-SERVICE: API returned invalid IP format: ${data.ip}`);
                    data.ip = '0.0.0.0';
                    data.source = 'invalid';
                }

                // Cache the result
                setCachedClientInfo(data);

                return data;
            });

        // Race the fetch against timeout
        return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
        console.error('IP-SERVICE: Error fetching client info:', error);

        // Return a fallback value on error
        return { ip: '0.0.0.0', source: 'error', timestamp: Date.now() };
    }
}

/**
 * Gets client info optimized for the current execution context
 * @param headers - Request headers (server-side only)
 * @returns Promise resolving to client info
 */
export async function getClientInfo(headers?: any): Promise<ClientInfo> {
    // Check if we're on server or client
    if (isServer()) {
        if (headers) {
            console.log('IP-SERVICE: Server-side execution with headers');

            // Extract IP from headers
            const clientInfo = extractClientIpFromHeaders(headers);

            // Cache for future server-side requests
            setCachedClientInfo(clientInfo);

            return clientInfo;
        } else {
            console.log('IP-SERVICE: Server-side execution without headers');

            // Try to use cached info
            const cachedInfo = getCachedClientInfo();
            if (cachedInfo) {
                return cachedInfo;
            }

            // No headers and no cache, return unknown
            return { ip: '0.0.0.0', source: 'server-unknown', timestamp: Date.now() };
        }
    } else {
        console.log('IP-SERVICE: Client-side execution');

        // Client-side: fetch from API
        return fetchClientInfo();
    }
}

/**
 * Gets client IP headers for inclusion in requests
 * @param clientInfo - Client information
 * @returns Object with appropriate IP headers
 */
export function getClientIpHeaders(clientInfo: ClientInfo): Record<string, string> {
    if (!clientInfo || !clientInfo.ip || clientInfo.ip === '0.0.0.0') {
        console.log('IP-SERVICE: No valid client IP available for headers');
        return {};
    }

    console.log(`IP-SERVICE: Creating IP headers for ${clientInfo.ip}`);

    return {
        'X-Forwarded-For': clientInfo.ip,
        'X-Client-IP': clientInfo.ip,
        'X-Original-IP-Source': clientInfo.source
    };
}