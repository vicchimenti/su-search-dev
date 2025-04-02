/**
 * @fileoverview ApiService - Centralized API communication for Seattle University search
 * 
 * This module provides a centralized service for API communication with the
 * Funnelback search proxy. It handles all API requests, error handling, and
 * response processing.
 * 
 * Features:
 * - Centralized API request handling
 * - Consistent error handling
 * - Response normalization
 * - Request caching integration
 * - Analytics tracking
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace ApiService
 * @requires SessionManager
 * @lastUpdated 2025-04-02
 */

import SessionManager from './SessionManager.js';

/**
 * ApiService - Manage API communication for search functionality
 */
class ApiService {
  /**
   * Create a new ApiService instance
   * @param {Object} config - API configuration
   */
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.endpoints = config.endpoints;
    this.defaultCollection = config.defaultCollection;
    this.defaultProfile = config.defaultProfile;
    this.debug = config.debug || false;
    
    // Initialize dependencies
    this.sessionManager = new SessionManager();
  }
  
  /**
   * Get full URL for an endpoint
   * @private
   * @param {string} endpoint - Endpoint key
   * @returns {string} Full URL
   */
  _getUrl(endpoint) {
    if (!this.endpoints[endpoint]) {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }
    
    return `${this.baseUrl}${this.endpoints[endpoint]}`;
  }
  
  /**
   * Add common parameters to request
   * @private
   * @param {Object} params - Request parameters
   * @returns {Object} Enhanced parameters
   */
  _addCommonParams(params = {}) {
    return {
      // Add default parameters if not provided
      collection: params.collection || this.defaultCollection,
      profile: params.profile || this.defaultProfile,
      // Add session ID for analytics
      sessionId: params.sessionId || this.sessionManager.getSessionId(),
      // Pass through other parameters
      ...params
    };
  }
  
  /**
   * Log API request if debug enabled
   * @private
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {Object} params - Request parameters
   */
  _logRequest(method, url, params) {
    if (this.debug) {
      console.log(`[ApiService] ${method} ${url}`, params);
    }
  }
  
  /**
   * Convert parameters object to URLSearchParams
   * @private
   * @param {Object} params - Parameters object
   * @returns {URLSearchParams} URL search parameters
   */
  _createSearchParams(params) {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      // Handle arrays (like multiple filters)
      if (Array.isArray(value)) {
        value.forEach(val => searchParams.append(key, val));
      } else if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    
    return searchParams;
  }
  
  /**
   * Make a GET request to the API
   * @param {string} endpoint - Endpoint key
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, params = {}) {
    const url = this._getUrl(endpoint);
    const enhancedParams = this._addCommonParams(params);
    const searchParams = this._createSearchParams(enhancedParams);
    const fullUrl = `${url}?${searchParams.toString()}`;
    
    this._logRequest('GET', fullUrl, enhancedParams);
    
    try {
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      // Handle different content types
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }
  
  /**
   * Make a POST request to the API
   * @param {string} endpoint - Endpoint key
   * @param {Object} data - Request body data
   * @param {Object} params - URL parameters
   * @returns {Promise<Object>} Response data
   */
  async post(endpoint, data = {}, params = {}) {
    const url = this._getUrl(endpoint);
    const enhancedParams = this._addCommonParams(params);
    const searchParams = this._createSearchParams(enhancedParams);
    const fullUrl = `${url}?${searchParams.toString()}`;
    
    this._logRequest('POST', fullUrl, { params: enhancedParams, body: data });
    
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      // Handle different content types
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }
  
  /**
   * Perform a search using the search API
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async search(params) {
    const searchParams = {
      form: 'partial',
      ...params
    };
    
    // Get search results as HTML
    const response = await this.get('search', searchParams);
    
    // Extract search metadata from HTML response if needed
    const resultCount = this._extractResultCount(response);
    
    // Return processed results
    return {
      html: response,
      resultCount,
      query: params.query,
      // Other metadata
    };
  }
  
  /**
   * Extract result count from HTML response
   * @private
   * @param {string} html - HTML response
   * @returns {number} Result count
   */
  _extractResultCount(html) {
    try {
      // Extract count using regex pattern from previous implementation
      const match = html.match(/totalMatching">([0-9,]+)</);
      if (match && match[1]) {
        return parseInt(match[1].replace(/,/g, ''), 10);
      }
    } catch (error) {
      console.error('Error extracting result count:', error);
    }
    
    return 0;
  }
  
  /**
   * Fetch general search suggestions
   * @param {string} query - Search query
   * @param {Object} params - Additional parameters
   * @returns {Promise<Array>} Search suggestions
   */
  async fetchGeneralSuggestions(query, params = {}) {
    const suggestionParams = {
      partial_query: query,
      ...params
    };
    
    const suggestions = await this.get('suggest', suggestionParams);
    return suggestions || [];
  }
  
  /**
   * Fetch staff/faculty suggestions
   * @param {string} query - Search query
   * @param {Object} params - Additional parameters
   * @returns {Promise<Array>} Staff suggestions
   */
  async fetchStaffSuggestions(query, params = {}) {
    const staffParams = {
      query,
      ...params
    };
    
    const suggestions = await this.get('suggestPeople', staffParams);
    return suggestions || [];
  }
  
  /**
   * Fetch program suggestions
   * @param {string} query - Search query
   * @param {Object} params - Additional parameters
   * @returns {Promise<Object>} Program suggestions
   */
  async fetchProgramSuggestions(query, params = {}) {
    const programParams = {
      query,
      ...params
    };
    
    const suggestions = await this.get('suggestPrograms', programParams);
    return suggestions || { programs: [] };
  }
  
  /**
   * Record a search result click for analytics
   * @param {Object} clickData - Click data
   * @returns {Promise<Object>} Response
   */
  async recordClick(clickData) {
    // Use sendBeacon if available for better UX during page navigation
    if (navigator.sendBeacon && typeof Blob !== 'undefined') {
      const blob = new Blob([JSON.stringify(clickData)], {
        type: 'application/json'
      });
      
      const url = this._getUrl('click');
      return navigator.sendBeacon(url, blob);
    }
    
    // Fall back to regular POST request
    return this.post('click', clickData);
  }
}

export default ApiService;