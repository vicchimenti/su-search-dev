/**
 * @fileoverview CacheService - Performance optimization for search operations
 * 
 * This module provides caching functionality for search results and suggestions,
 * improving performance and reducing API calls for frequently accessed content.
 * 
 * Features:
 * - In-memory caching for fastest access
 * - localStorage persistence for cross-page caching
 * - LRU (Least Recently Used) cache eviction policy
 * - TTL (Time To Live) for cache freshness
 * - Separate search and suggestion caches
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace CacheService
 * @lastUpdated 2025-04-02
 */

/**
 * Storage key constants
 * @enum {string}
 */
const STORAGE_KEYS = {
    SEARCH_CACHE: 'searchResultsCache',
    SUGGESTIONS_CACHE: 'suggestionsCache',
    CACHE_METADATA: 'searchCacheMetadata'
  };
  
  /**
   * Default cache configuration
   * @type {Object}
   */
  const DEFAULT_CONFIG = {
    enabled: true,
    searchTTL: 10 * 60 * 1000, // 10 minutes
    suggestionTTL: 5 * 60 * 1000, // 5 minutes
    maxItems: 50,
    useLocalStorage: true,
    logCacheEvents: false
  };
  
  /**
   * CacheService - Manage caching for search operations
   */
  class CacheService {
    /**
     * Create a new CacheService instance
     * @param {Object} config - Cache configuration
     */
    constructor(config = {}) {
      // Apply configuration with defaults
      this.config = { ...DEFAULT_CONFIG, ...config };
      
      // Initialize cache
      this._initCache();
    }
    
    /**
     * Initialize cache structures
     * @private
     */
    _initCache() {
      // In-memory caches
      this.searchCache = new Map();
      this.suggestionsCache = new Map();
      
      // LRU tracking
      this.searchAccessOrder = [];
      this.suggestionsAccessOrder = [];
      
      // Load from localStorage if available
      if (this.config.useLocalStorage) {
        this._loadFromStorage();
      }
    }
    
    /**
     * Load cache data from localStorage
     * @private
     */
    _loadFromStorage() {
      try {
        // Load search cache
        const searchCacheData = localStorage.getItem(STORAGE_KEYS.SEARCH_CACHE);
        if (searchCacheData) {
          const parsedData = JSON.parse(searchCacheData);
          this._processStoredCache(parsedData, this.searchCache, this.searchAccessOrder, this.config.searchTTL);
        }
        
        // Load suggestions cache
        const suggestionsCacheData = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS_CACHE);
        if (suggestionsCacheData) {
          const parsedData = JSON.parse(suggestionsCacheData);
          this._processStoredCache(parsedData, this.suggestionsCache, this.suggestionsAccessOrder, this.config.suggestionTTL);
        }
        
        if (this.config.logCacheEvents) {
          console.log('Cache loaded from localStorage:', {
            searchItems: this.searchCache.size,
            suggestionsItems: this.suggestionsCache.size
          });
        }
      } catch (error) {
        console.warn('Error loading cache from localStorage:', error);
        
        // Reset caches if loading failed
        this.searchCache.clear();
        this.suggestionsCache.clear();
        this.searchAccessOrder = [];
        this.suggestionsAccessOrder = [];
      }
    }
    
    /**
     * Process stored cache data, removing expired items
     * @private
     * @param {Object} storedData - Data loaded from storage
     * @param {Map} cacheMap - Cache map to update
     * @param {Array} accessOrder - Access order array to update
     * @param {number} ttl - TTL for cache items
     */
    _processStoredCache(storedData, cacheMap, accessOrder, ttl) {
      const now = Date.now();
      cacheMap.clear();
      accessOrder.length = 0;
      
      Object.entries(storedData).forEach(([key, item]) => {
        // Skip expired items
        if (now - item.timestamp > ttl) {
          return;
        }
        
        // Add valid items to cache
        cacheMap.set(key, item);
        accessOrder.push(key);
      });
    }
    
    /**
     * Save cache data to localStorage
     * @private
     */
    _saveToStorage() {
      if (!this.config.useLocalStorage) {
        return;
      }
      
      try {
        // Convert Map to plain object for storage
        const searchCacheObj = {};
        this.searchCache.forEach((value, key) => {
          searchCacheObj[key] = value;
        });
        
        const suggestionsCacheObj = {};
        this.suggestionsCache.forEach((value, key) => {
          suggestionsCacheObj[key] = value;
        });
        
        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.SEARCH_CACHE, JSON.stringify(searchCacheObj));
        localStorage.setItem(STORAGE_KEYS.SUGGESTIONS_CACHE, JSON.stringify(suggestionsCacheObj));
        
        if (this.config.logCacheEvents) {
          console.log('Cache saved to localStorage');
        }
      } catch (error) {
        console.warn('Error saving cache to localStorage:', error);
      }
    }
    
    /**
     * Update access order for LRU tracking
     * @private
     * @param {string} key - Cache key being accessed
     * @param {Array} orderArray - Access order array to update
     */
    _updateAccessOrder(key, orderArray) {
      // Remove existing entry
      const index = orderArray.indexOf(key);
      if (index !== -1) {
        orderArray.splice(index, 1);
      }
      
      // Add to front (most recently used)
      orderArray.unshift(key);
    }
    
    /**
     * Handle cache eviction when cache exceeds maximum size
     * @private
     * @param {Map} cacheMap - Cache map to check
     * @param {Array} accessOrder - Access order array for this cache
     */
    _evictIfNeeded(cacheMap, accessOrder) {
      while (cacheMap.size > this.config.maxItems && accessOrder.length > 0) {
        // Remove least recently used item
        const lruKey = accessOrder.pop();
        cacheMap.delete(lruKey);
        
        if (this.config.logCacheEvents) {
          console.log(`Cache eviction: ${lruKey}`);
        }
      }
    }
    
    /**
     * Generate a cache key for search results
     * @private
     * @param {string} query - Search query
     * @param {Object} params - Additional search parameters
     * @returns {string} Cache key
     */
    _generateSearchKey(query, params = {}) {
      // Include collection and other key parameters in cache key
      const keyParts = [
        query,
        params.collection || '',
        params.profile || ''
      ];
      
      // Include filter parameters
      if (params.filters) {
        keyParts.push(JSON.stringify(params.filters));
      }
      
      return keyParts.join('::');
    }
    
    /**
     * Get search results from cache
     * @param {string} query - Search query
     * @param {Object} params - Additional search parameters
     * @returns {Object|null} Cached search results or null if not found
     */
    getSearchResults(query, params = {}) {
      if (!this.config.enabled) {
        return null;
      }
      
      const cacheKey = this._generateSearchKey(query, params);
      const cachedItem = this.searchCache.get(cacheKey);
      
      if (!cachedItem) {
        if (this.config.logCacheEvents) {
          console.log(`Search cache miss: ${cacheKey}`);
        }
        return null;
      }
      
      // Check if item is expired
      const now = Date.now();
      if (now - cachedItem.timestamp > this.config.searchTTL) {
        this.searchCache.delete(cacheKey);
        
        // Remove from access order
        const index = this.searchAccessOrder.indexOf(cacheKey);
        if (index !== -1) {
          this.searchAccessOrder.splice(index, 1);
        }
        
        if (this.config.logCacheEvents) {
          console.log(`Search cache expired: ${cacheKey}`);
        }
        
        return null;
      }
      
      // Update access order (LRU)
      this._updateAccessOrder(cacheKey, this.searchAccessOrder);
      
      if (this.config.logCacheEvents) {
        console.log(`Search cache hit: ${cacheKey}`);
      }
      
      return cachedItem.data;
    }
    
    /**
     * Set search results in cache
     * @param {string} query - Search query
     * @param {Object} results - Search results to cache
     * @param {Object} params - Additional search parameters
     */
    setSearchResults(query, results, params = {}) {
      if (!this.config.enabled) {
        return;
      }
      
      const cacheKey = this._generateSearchKey(query, params);
      
      // Create cache item
      const cacheItem = {
        data: results,
        timestamp: Date.now()
      };
      
      // Add to cache
      this.searchCache.set(cacheKey, cacheItem);
      
      // Update access order (LRU)
      this._updateAccessOrder(cacheKey, this.searchAccessOrder);
      
      // Handle cache eviction
      this._evictIfNeeded(this.searchCache, this.searchAccessOrder);
      
      // Save to localStorage
      this._saveToStorage();
      
      if (this.config.logCacheEvents) {
        console.log(`Search cache set: ${cacheKey}`);
      }
    }
    
    /**
     * Get suggestions from cache
     * @param {string} query - Search query
     * @returns {Object|null} Cached suggestions or null if not found
     */
    getSuggestions(query) {
      if (!this.config.enabled) {
        return null;
      }
      
      const cacheKey = query.toLowerCase();
      const cachedItem = this.suggestionsCache.get(cacheKey);
      
      if (!cachedItem) {
        if (this.config.logCacheEvents) {
          console.log(`Suggestions cache miss: ${cacheKey}`);
        }
        return null;
      }
      
      // Check if item is expired
      const now = Date.now();
      if (now - cachedItem.timestamp > this.config.suggestionTTL) {
        this.suggestionsCache.delete(cacheKey);
        
        // Remove from access order
        const index = this.suggestionsAccessOrder.indexOf(cacheKey);
        if (index !== -1) {
          this.suggestionsAccessOrder.splice(index, 1);
        }
        
        if (this.config.logCacheEvents) {
          console.log(`Suggestions cache expired: ${cacheKey}`);
        }
        
        return null;
      }
      
      // Update access order (LRU)
      this._updateAccessOrder(cacheKey, this.suggestionsAccessOrder);
      
      if (this.config.logCacheEvents) {
        console.log(`Suggestions cache hit: ${cacheKey}`);
      }
      
      return cachedItem.data;
    }
    
    /**
     * Set suggestions in cache
     * @param {string} query - Search query
     * @param {Object} suggestions - Suggestions to cache
     */
    setSuggestions(query, suggestions) {
      if (!this.config.enabled) {
        return;
      }
      
      const cacheKey = query.toLowerCase();
      
      // Create cache item
      const cacheItem = {
        data: suggestions,
        timestamp: Date.now()
      };
      
      // Add to cache
      this.suggestionsCache.set(cacheKey, cacheItem);
      
      // Update access order (LRU)
      this._updateAccessOrder(cacheKey, this.suggestionsAccessOrder);
      
      // Handle cache eviction
      this._evictIfNeeded(this.suggestionsCache, this.suggestionsAccessOrder);
      
      // Save to localStorage
      this._saveToStorage();
      
      if (this.config.logCacheEvents) {
        console.log(`Suggestions cache set: ${cacheKey}`);
      }
    }
    
    /**
     * Clear search results cache
     * @param {string} [query] - Specific query to clear, or all if not provided
     */
    clearSearchCache(query) {
      if (query) {
        // Clear specific query
        const cacheKeys = Array.from(this.searchCache.keys())
          .filter(key => key.startsWith(query + '::'));
        
        cacheKeys.forEach(key => {
          this.searchCache.delete(key);
          
          // Remove from access order
          const index = this.searchAccessOrder.indexOf(key);
          if (index !== -1) {
            this.searchAccessOrder.splice(index, 1);
          }
        });
      } else {
        // Clear all search cache
        this.searchCache.clear();
        this.searchAccessOrder = [];
      }
      
      // Save changes to localStorage
      this._saveToStorage();
      
      if (this.config.logCacheEvents) {
        console.log('Search cache cleared' + (query ? ` for query: ${query}` : ''));
      }
    }
    
    /**
     * Clear suggestions cache
     * @param {string} [query] - Specific query to clear, or all if not provided
     */
    clearSuggestionsCache(query) {
      if (query) {
        // Clear specific query
        const cacheKey = query.toLowerCase();
        this.suggestionsCache.delete(cacheKey);
        
        // Remove from access order
        const index = this.suggestionsAccessOrder.indexOf(cacheKey);
        if (index !== -1) {
          this.suggestionsAccessOrder.splice(index, 1);
        }
      } else {
        // Clear all suggestions cache
        this.suggestionsCache.clear();
        this.suggestionsAccessOrder = [];
      }
      
      // Save changes to localStorage
      this._saveToStorage();
      
      if (this.config.logCacheEvents) {
        console.log('Suggestions cache cleared' + (query ? ` for query: ${query}` : ''));
      }
    }
    
    /**
     * Clear all caches
     */
    clearAllCaches() {
      this.searchCache.clear();
      this.suggestionsCache.clear();
      this.searchAccessOrder = [];
      this.suggestionsAccessOrder = [];
      
      // Clear localStorage cache
      if (this.config.useLocalStorage) {
        try {
          localStorage.removeItem(STORAGE_KEYS.SEARCH_CACHE);
          localStorage.removeItem(STORAGE_KEYS.SUGGESTIONS_CACHE);
          localStorage.removeItem(STORAGE_KEYS.CACHE_METADATA);
        } catch (error) {
          console.warn('Error clearing localStorage cache:', error);
        }
      }
      
      if (this.config.logCacheEvents) {
        console.log('All caches cleared');
      }
    }
    
    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
      return {
        enabled: this.config.enabled,
        searchItems: this.searchCache.size,
        suggestionsItems: this.suggestionsCache.size,
        searchTTL: this.config.searchTTL,
        suggestionTTL: this.config.suggestionTTL,
        maxItems: this.config.maxItems
      };
    }
  }

  export default CacheService;