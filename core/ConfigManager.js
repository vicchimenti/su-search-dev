/**
 * @fileoverview ConfigManager - Centralized Configuration for Seattle University Search
 * 
 * This module provides a centralized configuration system for the search application.
 * It manages default settings, environment-specific configurations, and runtime changes.
 * 
 * Features:
 * - Environment detection (dev/prod)
 * - Centralized configuration
 * - Deep merging of configuration objects
 * - Validation of required settings
 * - API endpoint management
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace ConfigManager
 * @lastUpdated 2025-04-02
 */

/**
 * Default configuration values
 * @type {Object}
 */
const DEFAULT_CONFIG = {
    // Environment
    environment: 'production', // 'development' or 'production'
    
    // API endpoints
    endpoints: {
      baseUrl: 'https://funnelback-proxy-dev.vercel.app/proxy',
      search: '/funnelback/search',
      suggest: '/funnelback/suggest',
      suggestPeople: '/suggestPeople',
      suggestPrograms: '/suggestPrograms',
      tools: '/funnelback/tools',
      spelling: '/funnelback/spelling',
      analytics: '/analytics',
      click: '/analytics/click'
    },
    
    // Search parameters
    defaultCollection: 'seattleu~sp-search',
    staffCollection: 'seattleu~ds-staff',
    programsCollection: 'seattleu~ds-programs',
    defaultProfile: '_default',
    
    // Input settings
    minQueryLength: 3,
    debounceTime: 200,
    
    // Results settings
    resultsPerPage: 10,
    maxSuggestions: 10,
    maxStaffSuggestions: 5,
    maxProgramSuggestions: 5,
    
    // Cache settings
    cacheEnabled: true,
    searchCacheTTL: 10 * 60 * 1000, // 10 minutes
    suggestionCacheTTL: 5 * 60 * 1000, // 5 minutes
    maxCacheItems: 100,
    
    // Analytics
    analyticsEnabled: true,
    
    // UI settings
    scrollToResults: true,
    mobileBreakpoint: 768,
    animations: true,
    
    // Development helpers
    debug: false,
    logApiCalls: false
  };
  
  /**
   * Development environment overrides
   * @type {Object}
   */
  const DEV_CONFIG = {
    environment: 'development',
    endpoints: {
      baseUrl: 'https://funnelback-proxy-dev.vercel.app/proxy',
    },
    debug: true,
    logApiCalls: true
  };
  
  /**
   * Production environment overrides
   * @type {Object}
   */
  const PROD_CONFIG = {
    environment: 'production',
    endpoints: {
      baseUrl: 'https://funnelback-proxy-one.vercel.app/proxy',
    },
    debug: false,
    logApiCalls: false
  };
  
  /**
   * ConfigManager - Manage application configuration
   */
  class ConfigManager {
    /**
     * Create a new ConfigManager
     * @param {Object} customConfig - Custom configuration to merge with defaults
     */
    constructor(customConfig = {}) {
      // Detect environment
      const isDev = this._detectDevEnvironment();
      
      // Merge configurations
      this.config = this._mergeConfigs(
        DEFAULT_CONFIG,
        isDev ? DEV_CONFIG : PROD_CONFIG,
        customConfig
      );
      
      // Validate critical configuration
      this._validateConfig();
      
      // Log configuration in debug mode
      if (this.config.debug) {
        console.log('SearchConfig initialized:', this.config);
      }
    }
    
    /**
     * Detect if running in development environment
     * @private
     * @returns {boolean} True if in development
     */
    _detectDevEnvironment() {
      // Check for development hostname patterns
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || 
               hostname.includes('dev.') || 
               hostname.includes('.local') ||
               hostname.includes('-dev.vercel.app');
      }
      
      // Default to production if not in browser
      return false;
    }
    
    /**
     * Merge multiple configuration objects
     * @private
     * @param {...Object} configs - Configuration objects to merge
     * @returns {Object} Merged configuration
     */
    _mergeConfigs(...configs) {
      // Start with empty object
      const result = {};
      
      // Process each config object
      configs.forEach(config => {
        if (!config) return;
        
        // Iterate through all properties
        Object.keys(config).forEach(key => {
          const value = config[key];
          
          // Recursively merge objects, otherwise overwrite
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result[key] = this._mergeConfigs(result[key] || {}, value);
          } else {
            result[key] = value;
          }
        });
      });
      
      return result;
    }
    
    /**
     * Validate critical configuration properties
     * @private
     * @throws {Error} If required configuration is missing
     */
    _validateConfig() {
      // Check for required fields
      const requiredFields = [
        'endpoints.baseUrl',
        'endpoints.search',
        'endpoints.suggest',
        'defaultCollection'
      ];
      
      requiredFields.forEach(field => {
        // Handle nested properties
        const parts = field.split('.');
        let current = this.config;
        
        for (const part of parts) {
          if (current[part] === undefined) {
            throw new Error(`Missing required configuration: ${field}`);
          }
          current = current[part];
        }
      });
    }
    
    /**
     * Get the full configuration
     * @returns {Object} Complete configuration
     */
    getConfig() {
      return { ...this.config };
    }
    
    /**
     * Get API configuration for services
     * @returns {Object} API configuration
     */
    getApiConfig() {
      return {
        baseUrl: this.config.endpoints.baseUrl,
        endpoints: { ...this.config.endpoints },
        defaultCollection: this.config.defaultCollection,
        defaultProfile: this.config.defaultProfile,
        debug: this.config.logApiCalls
      };
    }
    
    /**
     * Get cache configuration
     * @returns {Object} Cache configuration
     */
    getCacheConfig() {
      return {
        enabled: this.config.cacheEnabled,
        searchTTL: this.config.searchCacheTTL,
        suggestionTTL: this.config.suggestionCacheTTL,
        maxItems: this.config.maxCacheItems
      };
    }
    
    /**
     * Get the full endpoint URL for a specific API
     * @param {string} endpoint - Endpoint key from configuration
     * @returns {string} Complete endpoint URL
     */
    getEndpointUrl(endpoint) {
      const baseUrl = this.config.endpoints.baseUrl;
      const path = this.config.endpoints[endpoint];
      
      if (!path) {
        throw new Error(`Unknown endpoint: ${endpoint}`);
      }
      
      return `${baseUrl}${path}`;
    }
    
    /**
     * Update configuration at runtime
     * @param {Object} newConfig - New configuration values to apply
     */
    updateConfig(newConfig) {
      this.config = this._mergeConfigs(this.config, newConfig);
      
      // Revalidate after updating
      this._validateConfig();
      
      // Log updated configuration in debug mode
      if (this.config.debug) {
        console.log('SearchConfig updated:', this.config);
      }
    }
    
    /**
     * Get a specific configuration value
     * @param {string} key - Configuration key (supports dot notation)
     * @param {*} defaultValue - Default value if key not found
     * @returns {*} Configuration value
     */
    get(key, defaultValue = null) {
      const parts = key.split('.');
      let current = this.config;
      
      for (const part of parts) {
        if (current[part] === undefined) {
          return defaultValue;
        }
        current = current[part];
      }
      
      return current;
    }
    
    /**
     * Set a specific configuration value
     * @param {string} key - Configuration key (supports dot notation)
     * @param {*} value - New value to set
     */
    set(key, value) {
      const parts = key.split('.');
      let current = this.config;
      
      // Navigate to the correct nesting level
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        
        // Create path if it doesn't exist
        if (current[part] === undefined) {
          current[part] = {};
        } else if (typeof current[part] !== 'object') {
          // Convert primitive to object if needed
          current[part] = {};
        }
        
        current = current[part];
      }
      
      // Set the value at the final level
      current[parts[parts.length - 1]] = value;
      
      // Log updated configuration in debug mode
      if (this.config.debug) {
        console.log(`SearchConfig updated: ${key} =`, value);
      }
    }
  }
