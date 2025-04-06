/**
 * @fileoverview Client for backend API with SessionService integration
 * 
 * This module provides a configured Axios client for communicating
 * with the backend search API. It now uses SessionService for 
 * consistent session ID management.
 * 
 * @author Victor Chimenti
 * @version 1.1.3
 * @lastModified 2025-04-06
 */

import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
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
backendApiClient.interceptors.request.use((request) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Backend API Request:', {
      url: request.url,
      method: request.method,
      params: request.params,
      data: request.data
    });
  }
  
  // Safely check for client-side environment before accessing window
  if (typeof window !== 'undefined' && request.url) {
    // Only apply to search API endpoints to minimize disruption
    if (request.url.includes('/funnelback/search')) {
      try {
        const sessionId = SessionService.getSessionId();
        
        // If request already has params, add sessionId
        if (request.params) {
          // Check if sessionId already exists and remove it
          if ('sessionId' in request.params) {
            delete request.params.sessionId;
          }
          // Add the canonical sessionId
          request.params.sessionId = sessionId;
        } else {
          // Create new params object with sessionId
          request.params = { sessionId };
        }
        
        console.log('Added normalized session ID to request params');
      } catch (e) {
        console.error('Error adding session ID to request:', e);
      }
    }
  }
  
  return request;
});

// Add response logging in development
backendApiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Backend API Response:', {
        status: response.status,
        dataLength: response.data ? 
          (typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length) : 0
      });
    }
    return response;
  },
  (error: any) => {
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
    // Remove any existing sessionId to prevent duplication
    const cleanParams = { ...params };
    if ('sessionId' in cleanParams) {
      delete cleanParams.sessionId;
    }
    
    const response = await backendApiClient.get(endpoint, { params: cleanParams });
    return response.data;
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error);
    throw error;
  }
}

// Helper function for POST requests
export async function postToBackend(endpoint: string, data: any = {}, params: any = {}) {
  try {
    // Remove any existing sessionId to prevent duplication
    const cleanParams = { ...params };
    if ('sessionId' in cleanParams) {
      delete cleanParams.sessionId;
    }
    
    const response = await backendApiClient.post(endpoint, data, { params: cleanParams });
    return response.data;
  } catch (error) {
    console.error(`Error posting to ${endpoint}:`, error);
    throw error;
  }
}
