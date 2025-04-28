/**
 * @fileoverview Client for backend API
 * 
 * This module provides a configured Axios client for communicating
 * with the backend search API. Enhanced with IP tracking capabilities
 * to ensure consistent client IP identification across requests.
 *
 * Features:
 * - Configured Axios instance with proper timeouts and headers
 * - Client IP tracking via IPService integration
 * - Request interceptors for adding IP headers to all requests
 * - Detailed logging for request tracing
 * 
 * @author Victor Chimenti
 * @version 2.1.0
 * @lastModified 2025-04-28
 */

import axios, { AxiosRequestHeaders } from 'axios';
import ipService from './ip-service';

// Get backend API URL from environment variables, with fallback
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'https://funnelback-proxy-dev.vercel.app/proxy';

// Initialize IPService as early as possible, but don't block
console.log('[api-client] Initializing IPService');
ipService.init().catch(error =>
  console.error('[api-client] Failed to initialize IPService:', error)
);

/**
 * Create a configured Axios instance for backend API requests
 */
export const backendApiClient = axios.create({
  baseURL: BACKEND_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * Add request interceptor to include client IP in all requests
 * This ensures the real client IP is passed to the backend API
 */
backendApiClient.interceptors.request.use(async (config) => {
  console.log('[api-client] Preparing request to:', config.url);

  try {
    // Check if IPService is initialized
    if (!ipService.isInitialized()) {
      console.log('[api-client] IPService not yet initialized, waiting...');

      // Try to wait for initialization to complete
      try {
        await ipService.init();
        console.log('[api-client] IPService initialization completed');
      } catch (initError) {
        console.warn('[api-client] Could not initialize IPService:', initError);
      }
    }

    // Get client IP
    const clientIP = ipService.getClientIP();

    if (clientIP) {
      // Ensure headers object exists
      if (!config.headers) {
        config.headers = {} as AxiosRequestHeaders;
      }

      // Add client IP to headers
      config.headers['X-Real-Client-IP'] = clientIP;
      config.headers['X-Original-Client-IP'] = clientIP;

      console.log(`[api-client] Added client IP headers: ${clientIP}`);

      // Add IP metadata if available
      const metadata = ipService.getIPMetadata();
      if (metadata) {
        if (metadata.city) config.headers['X-Client-City'] = metadata.city;
        if (metadata.region) config.headers['X-Client-Region'] = metadata.region;
        if (metadata.country) config.headers['X-Client-Country'] = metadata.country;

        console.log('[api-client] Added IP metadata headers');
      }
    } else {
      console.warn('[api-client] No client IP available to add to request');
    }
  } catch (error) {
    console.error('[api-client] Error adding IP headers to request:', error);
    // Continue with request despite error
  }

  // Add request logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[api-client] Request details:', {
      method: config.method,
      url: config.url,
      params: config.params,
      hasClientIP: !!ipService.getClientIP()
    });
  }

  return config;
});

/**
 * Add response interceptor for logging and error handling
 */
backendApiClient.interceptors.response.use(
  // Success handler
  (response) => {
    console.log(`[api-client] Request succeeded: ${response.config.url}`);
    return response;
  },
  // Error handler
  (error) => {
    console.error('[api-client] Request failed:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message
    });
    return Promise.reject(error);
  }
);

/**
 * Helper function to make API requests with enhanced IP headers
 * @param url - The API endpoint URL
 * @param method - HTTP method (GET, POST, etc.)
 * @param data - Request data (for POST, PUT, etc.)
 * @param params - URL parameters
 * @returns Promise resolving to the API response
 */
export async function makeApiRequest(
  url: string,
  method: string = 'GET',
  data: any = null,
  params: any = null
): Promise<any> {
  try {
    // Ensure IPService is initialized
    if (!ipService.isInitialized()) {
      await ipService.init();
    }

    // Create request configuration
    const config: any = {
      url,
      method,
      params
    };

    // Add data for non-GET requests
    if (method !== 'GET' && data) {
      config.data = data;
    }

    // Add client IP headers
    const clientIP = ipService.getClientIP();
    if (clientIP) {
      if (!config.headers) config.headers = {} as AxiosRequestHeaders;
      config.headers['X-Real-Client-IP'] = clientIP;
      config.headers['X-Original-Client-IP'] = clientIP;
    }

    // Make request
    const response = await backendApiClient(config);
    return response.data;
  } catch (error) {
    console.error('[api-client] Error in makeApiRequest:', error);
    throw error;
  }
}

/**
 * Helper function to extract client IP from the API
 * Useful when IPService needs a reliable way to get the IP
 * @returns Promise resolving to the client IP
 */
export async function fetchClientIP(): Promise<string | null> {
  try {
    console.log('[api-client] Fetching client IP from API');
    const response = await backendApiClient.get('/api/client-ip');

    if (response.data && response.data.ip) {
      console.log('[api-client] Successfully fetched client IP:', response.data.ip);
      return response.data.ip;
    }

    console.warn('[api-client] API did not return valid IP:', response.data);
    return null;
  } catch (error) {
    console.error('[api-client] Error fetching client IP:', error);
    return null;
  }
}

// Export default client
export default backendApiClient;