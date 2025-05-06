/**
 * @fileoverview Client for backend API with IP resolution
 * 
 * This module provides a configured Axios client for communicating
 * with the backend search API. Includes IP resolution functionality
 * to preserve original client IPs and enhanced cache awareness.
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 2.1.0
 * @lastModified 2025-05-06
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosRequestHeaders } from 'axios';

// Get backend API URL from environment variables, with fallback
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'https://funnelback-proxy-dev.vercel.app/proxy';

// Flag to determine if we're in a server context
const isServer = typeof window === 'undefined';

// Client IP cache (server-side only)
let cachedClientIp: string | null = null;
let cachedClientIpTimestamp = 0;
const CLIENT_IP_CACHE_DURATION = 60 * 1000; // 1 minute in milliseconds

/**
 * Resolves the client IP address from request headers in server context
 * @param headers - Request headers
 * @returns Resolved IP address
 */
function resolveClientIpFromHeaders(headers: any): string {
  console.log('API-CLIENT: Resolving client IP from headers');
  console.log('API-CLIENT: Available headers:', JSON.stringify(headers));

  // Check x-forwarded-for header (common for proxied requests)
  if (headers['x-forwarded-for']) {
    const forwardedIps = Array.isArray(headers['x-forwarded-for'])
      ? headers['x-forwarded-for'][0]
      : headers['x-forwarded-for'];

    // Extract the first IP in the list (the original client)
    const clientIp = forwardedIps.split(',')[0].trim();
    console.log(`API-CLIENT: Extracted IP from x-forwarded-for: ${clientIp}`);
    return clientIp;
  }

  // Check other common headers
  const ipHeaders = [
    'x-real-ip',
    'true-client-ip',
    'cf-connecting-ip',
    'x-client-ip'
  ];

  for (const header of ipHeaders) {
    if (headers[header]) {
      const ip = Array.isArray(headers[header]) ? headers[header][0] : headers[header];
      console.log(`API-CLIENT: Extracted IP from ${header}: ${ip}`);
      return ip;
    }
  }

  console.warn('API-CLIENT: Could not extract IP address from headers');
  return '0.0.0.0';
}

/**
 * Sets client IP for server-side requests
 * @param ip - Client IP address
 */
export function setClientIp(ip: string): void {
  if (isServer) {
    console.log(`API-CLIENT: Setting cached client IP to ${ip}`);
    cachedClientIp = ip;
    cachedClientIpTimestamp = Date.now();
  }
}

/**
 * Gets the cached client IP (server-side only)
 * @returns Cached client IP or null if expired or not set
 */
export function getCachedClientIp(): string | null {
  if (!isServer) return null;

  const now = Date.now();
  if (cachedClientIp && now - cachedClientIpTimestamp < CLIENT_IP_CACHE_DURATION) {
    console.log(`API-CLIENT: Using cached client IP: ${cachedClientIp}`);
    return cachedClientIp;
  }

  console.log('API-CLIENT: Cached client IP expired or not set');
  return null;
}

/**
 * Create an axios instance with client IP inclusion and optional cache awareness
 * @param headers - Optional request headers
 * @param options - Additional client options (including cache awareness)
 * @returns Configured axios instance
 */
export function createApiClient(headers?: any, options: { cacheAware?: boolean } = {}): AxiosInstance {
  console.log('API-CLIENT: Creating API client instance');

  let clientIp: string | null = null;

  // In server context, try to extract IP from request headers
  if (isServer && headers) {
    clientIp = resolveClientIpFromHeaders(headers);
    if (clientIp) {
      setClientIp(clientIp); // Cache the resolved IP
    } else {
      clientIp = getCachedClientIp(); // Try to use cached IP
    }
  }

  // Create default headers
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Add IP headers if available
  if (clientIp) {
    defaultHeaders['X-Forwarded-For'] = clientIp;
    defaultHeaders['X-Client-IP'] = clientIp;
  }

  // Add cache awareness header if requested
  if (options.cacheAware) {
    defaultHeaders['X-Cache-Aware'] = 'true';
  }

  // Create a configured Axios instance
  const apiClient = axios.create({
    baseURL: BACKEND_API_URL,
    timeout: 10000,
    headers: defaultHeaders
  });

  if (clientIp) {
    console.log(`API-CLIENT: Created client with IP headers set to ${clientIp}`);
  } else {
    console.log('API-CLIENT: Created client without IP headers (will be resolved later for client-side requests)');
  }

  // Add request interceptor to include client IP in all requests
  apiClient.interceptors.request.use(async (config) => {
    // For server-side requests, we already added the IP to the default headers
    if (isServer) {
      return config;
    }

    // For client-side requests, fetch the IP from our client-info endpoint
    try {
      console.log('API-CLIENT: Attempting to fetch client IP for client-side request');

      // Check if we already have client info headers
      if (config.headers && (config.headers['X-Client-IP'] || config.headers['X-Forwarded-For'])) {
        console.log('API-CLIENT: Request already has client IP headers');
        return config;
      }

      // Fetch client IP from our dedicated endpoint
      const response = await fetch('/api/client-info');
      if (!response.ok) throw new Error('Failed to fetch client info');

      const clientInfo = await response.json();
      console.log(`API-CLIENT: Received client info: IP=${clientInfo.ip}, Source=${clientInfo.source}`);

      // Add client IP to request headers
      if (clientInfo.ip) {
        if (!config.headers) {
          config.headers = {} as AxiosRequestHeaders;
        }
        config.headers['X-Forwarded-For'] = clientInfo.ip;
        config.headers['X-Client-IP'] = clientInfo.ip;
        console.log(`API-CLIENT: Added client IP ${clientInfo.ip} to request headers`);
      }
    } catch (error) {
      console.error('API-CLIENT: Error fetching client IP:', error);
      // Continue with request even if IP fetch fails
    }

    return config;
  });

  // Add request logging in development
  apiClient.interceptors.request.use(request => {
    if (process.env.NODE_ENV === 'development') {
      console.log('API-CLIENT: Backend API Request:', {
        url: request.url,
        method: request.method,
        params: request.params,
        data: request.data,
        headers: {
          'X-Forwarded-For': request.headers?.['X-Forwarded-For'],
          'X-Client-IP': request.headers?.['X-Client-IP'],
          'X-Cache-Aware': request.headers?.['X-Cache-Aware'],
        }
      });
    }
    return request;
  });

  // Add response logging in development
  apiClient.interceptors.response.use(
    response => {
      if (process.env.NODE_ENV === 'development') {
        // Log cache status headers if present
        const cacheStatus = response.headers['x-cache-status'];
        const cacheAge = response.headers['x-cache-age'];

        console.log('API-CLIENT: Backend API Response:', {
          status: response.status,
          dataLength: response.data ?
            (typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length) : 0,
          cacheStatus: cacheStatus || 'N/A',
          cacheAge: cacheAge || 'N/A'
        });
      }
      return response;
    },
    error => {
      console.error('API-CLIENT: Backend API Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return Promise.reject(error);
    }
  );

  return apiClient;
}

// Create a default instance for backward compatibility
export const backendApiClient = createApiClient();

// Create a cache-aware instance for use with endpoints that support caching
export const cacheAwareApiClient = createApiClient(undefined, { cacheAware: true });

/**
 * Helper function for GET requests with IP forwarding
 * @param endpoint - API endpoint
 * @param params - Request parameters
 * @param options - Additional request options
 * @param headers - Optional request headers
 * @returns Response data
 */
export async function fetchFromBackend(
  endpoint: string,
  params: any = {},
  options: { cacheAware?: boolean } = {},
  headers?: any
) {
  try {
    // Create a client instance with provided headers (useful for server-side requests)
    const client = headers ?
      createApiClient(headers, options) :
      options.cacheAware ? cacheAwareApiClient : backendApiClient;

    console.log(`API-CLIENT: Fetching from ${endpoint} with params:`, params);

    // Set custom headers for cache awareness if needed
    const requestConfig: AxiosRequestConfig = { params };
    if (options.cacheAware) {
      requestConfig.headers = {
        'X-Cache-Aware': 'true'
      };
    }

    const response = await client.get(endpoint, requestConfig);
    return response.data;
  } catch (error) {
    console.error(`API-CLIENT: Error fetching from ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Helper function for POST requests with IP forwarding
 * @param endpoint - API endpoint
 * @param data - Request body
 * @param params - Request parameters
 * @param headers - Optional request headers
 * @returns Response data
 */
export async function postToBackend(endpoint: string, data: any = {}, params: any = {}, headers?: any) {
  try {
    // Create a client instance with provided headers (useful for server-side requests)
    const client = headers ? createApiClient(headers) : backendApiClient;

    console.log(`API-CLIENT: Posting to ${endpoint} with data:`, data);
    const response = await client.post(endpoint, data, { params });
    return response.data;
  } catch (error) {
    console.error(`API-CLIENT: Error posting to ${endpoint}:`, error);
    throw error;
  }
}