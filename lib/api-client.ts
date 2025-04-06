/**
 * @fileoverview Client for backend API with SessionService integration
 * 
 * This module provides a configured Axios client for communicating
 * with the backend search API. It now uses SessionService for 
 * consistent session ID management.
 *
 * @author Victor Chimenti
 * @version 1.0.1
 */

import axios from 'axios';
import SessionService from './SessionService';

// Get backend API URL from environment variables, with fallback
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'https://funnelback-proxy-dev.vercel.app/proxy';

// Create a configured Axios instance for backend API requests
export const backendApiClient = axios.create({
  baseURL: BACKEND_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add request logging in development
backendApiClient.interceptors.request.use(request => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Backend API Request:', {
      url: request.url,
      method: request.method,
      params: request.params,
      data: request.data
    });
  }
  
  // NEW: Normalize session ID in URL if we're on the client side
  if (typeof window !== 'undefined' && request.url) {
    // Only apply to search API endpoints to minimize disruption
    if (request.url.includes('/funnelback/search') && SessionService) {
      const fullUrl = request.baseURL + request.url;
      const normalizedUrl = SessionService.normalizeUrl(fullUrl);
      
      // Extract just the path + query string part
      const urlObj = new URL(normalizedUrl);
      request.url = urlObj.pathname + urlObj.search;
      
      console.log('Normalized session ID in request URL');
    }
  }
  
  return request;
});

// Add response logging in development
backendApiClient.interceptors.response.use(
  response => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Backend API Response:', {
        status: response.status,
        dataLength: response.data ? 
          (typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length) : 0
      });
    }
    return response;
  },
  error => {
    console.error('Backend API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

// Helper function for GET requests
export async function fetchFromBackend(endpoint: string, params: any = {}) {
  try {
    const response = await backendApiClient.get(endpoint, { params });
    return response.data;
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error);
    throw error;
  }
}

// Helper function for POST requests
export async function postToBackend(endpoint: string, data: any = {}, params: any = {}) {
  try {
    const response = await backendApiClient.post(endpoint, data, { params });
    return response.data;
  } catch (error) {
    console.error(`Error posting to ${endpoint}:`, error);
    throw error;
  }
}