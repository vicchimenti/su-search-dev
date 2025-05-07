/**
 * @fileoverview Client for backend API with IP resolution
 * 
 * This module provides a configured Axios client for communicating
 * with the backend search API. Includes IP resolution functionality
 * to preserve original client IPs and enhanced cache awareness.
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 2.2.0
 * @lastModified 2025-05-07
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosRequestHeaders } from 'axios';

// Get backend API URL from environment variables, with fallback
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'https://funnelback-proxy-dev.vercel.app/proxy';

// Define log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Set default log level (can be overridden via environment variable)
let currentLogLevel = process.env.API_CLIENT_LOG_LEVEL
  ? parseInt(process.env.API_CLIENT_LOG_LEVEL, 10)
  : LogLevel.INFO;

// Flag to determine if we're in a server context
const isServer = typeof window === 'undefined';

// Client IP cache (server-side only)
let cachedClientIp: string | null = null;
let cachedClientIpTimestamp = 0;
const CLIENT_IP_CACHE_DURATION = 60 * 1000; // 1 minute in milliseconds

/**
 * Logger function with level-based filtering
 * @param message - The message to log
 * @param level - The log level for this message
 * @param data - Optional data to include in the log
 */
export function log(message: string, level: LogLevel = LogLevel.INFO, data?: any): void {
  if (level <= currentLogLevel) {
    const prefix = getLogPrefix(level);
    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

/**
 * Get the prefix for a log level
 * @param level - The log level
 * @returns The prefix string
 */
function getLogPrefix(level: LogLevel): string {
  switch (level) {
    case LogLevel.ERROR:
      return '[API-CLIENT-ERROR]';
    case LogLevel.WARN:
      return '[API-CLIENT-WARN]';
    case LogLevel.INFO:
      return '[API-CLIENT-INFO]';
    case LogLevel.DEBUG:
      return '[API-CLIENT-DEBUG]';
    default:
      return '[API-CLIENT]';
  }
}

/**
 * Set the current log level
 * @param level - The new log level
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  log(`Log level set to ${LogLevel[level]}`, LogLevel.INFO);
}

/**
 * Resolves the client IP address from request headers in server context
 * @param headers - Request headers
 * @returns Resolved IP address
 */
function resolveClientIpFromHeaders(headers: any): string {
  log('Resolving client IP from headers', LogLevel.INFO);

  // Log available headers at DEBUG level
  log('Available headers:', LogLevel.DEBUG, headers);

  // Check x-forwarded-for header (common for proxied requests)
  if (headers['x-forwarded-for']) {
    const forwardedIps = Array.isArray(headers['x-forwarded-for'])
      ? headers['x-forwarded-for'][0]
      : headers['x-forwarded-for'];

    // Extract the first IP in the list (the original client)
    const clientIp = forwardedIps.split(',')[0].trim();
    log(`Extracted IP from x-forwarded-for: ${clientIp}`, LogLevel.INFO);
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
      log(`Extracted IP from ${header}: ${ip}`, LogLevel.INFO);
      return ip;
    }
  }

  log('Could not extract IP address from headers', LogLevel.WARN);
  return '0.0.0.0';
}

/**
 * Sets client IP for server-side requests
 * @param ip - Client IP address
 */
export function setClientIp(ip: string): void {
  if (isServer) {
    log(`Setting cached client IP to ${ip}`, LogLevel.INFO);
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
    log(`Using cached client IP: ${cachedClientIp}`, LogLevel.DEBUG);
    return cachedClientIp;
  }

  log('Cached client IP expired or not set', LogLevel.DEBUG);
  return null;
}

/**
 * Create an axios instance with client IP inclusion and optional cache awareness
 * @param headers - Optional request headers
 * @param options - Additional client options (including cache awareness)
 * @returns Configured axios instance
 */
export function createApiClient(headers?: any, options: { cacheAware?: boolean } = {}): AxiosInstance {
  log('Creating API client instance', LogLevel.INFO);

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
    log(`Created client with IP headers set to ${clientIp}`, LogLevel.INFO);
  } else {
    log('Created client without IP headers (will be resolved later for client-side requests)', LogLevel.INFO);
  }

  // Add request interceptor to include client IP in all requests
  apiClient.interceptors.request.use(async (config) => {
    // For server-side requests, we already added the IP to the default headers
    if (isServer) {
      return config;
    }

    // For client-side requests, fetch the IP from our client-info endpoint
    try {
      log('Attempting to fetch client IP for client-side request', LogLevel.DEBUG);

      // Check if we already have client info headers
      if (config.headers && (config.headers['X-Client-IP'] || config.headers['X-Forwarded-For'])) {
        log('Request already has client IP headers', LogLevel.DEBUG);
        return config;
      }

      // Fetch client IP from our dedicated endpoint
      const response = await fetch('/api/client-info');
      if (!response.ok) {
        throw new Error(`Failed to fetch client info: ${response.status} ${response.statusText}`);
      }

      const clientInfo = await response.json();
      log(`Received client info: IP=${clientInfo.ip}, Source=${clientInfo.source}`, LogLevel.DEBUG);

      // Add client IP to request headers
      if (clientInfo.ip) {
        if (!config.headers) {
          config.headers = {} as AxiosRequestHeaders;
        }
        config.headers['X-Forwarded-For'] = clientInfo.ip;
        config.headers['X-Client-IP'] = clientInfo.ip;
        log(`Added client IP ${clientInfo.ip} to request headers`, LogLevel.DEBUG);
      }
    } catch (error) {
      log(`Error fetching client IP: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);
      // Continue with request even if IP fetch fails
    }

    return config;
  });

  // Add request logging for all log levels
  apiClient.interceptors.request.use(request => {
    // For INFO level, log minimal information
    if (currentLogLevel >= LogLevel.INFO) {
      log(`Request: ${request.method} ${request.url}`, LogLevel.INFO);
    }

    // For DEBUG level, log more detailed information
    if (currentLogLevel >= LogLevel.DEBUG) {
      log('Request details:', LogLevel.DEBUG, {
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

  // Add response logging
  apiClient.interceptors.response.use(
    response => {
      // For INFO level, log minimal information
      if (currentLogLevel >= LogLevel.INFO) {
        const cacheStatus = response.headers['x-cache-status'];
        log(`Response: ${response.status} ${response.statusText}${cacheStatus ? ` (Cache: ${cacheStatus})` : ''}`, LogLevel.INFO);
      }

      // For DEBUG level, log more detailed information
      if (currentLogLevel >= LogLevel.DEBUG) {
        const cacheStatus = response.headers['x-cache-status'];
        const cacheAge = response.headers['x-cache-age'];

        log('Response details:', LogLevel.DEBUG, {
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
      // Always log errors at ERROR level
      log('API Error:', LogLevel.ERROR, {
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
export async function fetchFromBackend<T = any>(
  endpoint: string,
  params: any = {},
  options: { cacheAware?: boolean } = {},
  headers?: any
): Promise<T> {
  try {
    // Create a client instance with provided headers (useful for server-side requests)
    const client = headers ?
      createApiClient(headers, options) :
      options.cacheAware ? cacheAwareApiClient : backendApiClient;

    log(`Fetching from ${endpoint}`, LogLevel.INFO);
    log(`Request params:`, LogLevel.DEBUG, params);

    // Set custom headers for cache awareness if needed
    const requestConfig: AxiosRequestConfig = { params };
    if (options.cacheAware) {
      requestConfig.headers = {
        'X-Cache-Aware': 'true'
      };
    }

    const response = await client.get(endpoint, requestConfig);

    // Log response data at debug level
    log(`Response received from ${endpoint}`, LogLevel.INFO);
    log(`Response data:`, LogLevel.DEBUG, response.data);

    return response.data;
  } catch (error) {
    log(`Error fetching from ${endpoint}: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);
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
export async function postToBackend<T = any>(
  endpoint: string,
  data: any = {},
  params: any = {},
  headers?: any
): Promise<T> {
  try {
    // Create a client instance with provided headers (useful for server-side requests)
    const client = headers ? createApiClient(headers) : backendApiClient;

    log(`Posting to ${endpoint}`, LogLevel.INFO);
    log(`Request data:`, LogLevel.DEBUG, data);
    log(`Request params:`, LogLevel.DEBUG, params);

    const response = await client.post(endpoint, data, { params });

    // Log response data at debug level
    log(`Response received from ${endpoint}`, LogLevel.INFO);
    log(`Response data:`, LogLevel.DEBUG, response.data);

    return response.data;
  } catch (error) {
    log(`Error posting to ${endpoint}: ${error instanceof Error ? error.message : 'Unknown error'}`, LogLevel.ERROR);
    throw error;
  }
}