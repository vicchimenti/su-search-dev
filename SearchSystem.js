/**
 * @fileoverview SearchSystem - Main application coordinator for Seattle University search
 * 
 * This module serves as the entry point for the Seattle University search application,
 * coordinating between the various components and services for the Funnelback proxy system.
 * It handles initialization, configuration, and provides a central coordination point
 * for search functionality across the site.
 * 
 * Features:
 * - Centralized search coordination
 * - Component initialization and management
 * - Default configuration with override options
 * - Debug and analytics support
 * - Session management and tracking
 * - Search results caching
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace SearchSystem
 * @lastUpdated 2025-04-02
 */

import { debounce, createSearchDebounce } from './utils/DebounceUtils';

/**
 * Main SearchSystem class that coordinates search functionality
 */
class SearchSystem {
  /**
   * Create a new SearchSystem instance
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    // Store instance reference
    if (SearchSystem.instance) {
      console.log('SearchSystem already initialized, returning existing instance');
      return SearchSystem.instance;
    }
    
    SearchSystem.instance = this;
    
    // Default configuration
    this.defaultConfig = {
      endpoints: {
        baseUrl: 'https://funnelback-proxy-dev.vercel.app/proxy',
        suggest: '/funnelback/suggest',
        search: '/funnelback/search',
        suggestPeople: '/suggestPeople',
        suggestPrograms: '/suggestPrograms',
        analytics: '/analytics/click'
      },
      searchParams: {
        collection: 'seattleu~sp-search',
        profile: '_default',
        form: 'partial'
      },
      debounce: {
        suggest: 200,
        search: 300
      },
      components: {
        selectors: {
          globalSearch: '#search-input',
          globalSearchButton: '#search-button',
          pageSearch: '#autocomplete-concierge-inputField',
          pageSearchButton: '#on-page-search-button',
          resultsContainer: '#results',
          suggestionsContainer: '#autocomplete-suggestions'
        }
      },
      analytics: true,
      debug: false,
      cache: {
        enabled: true,
        ttl: 10 * 60 * 1000 // 10 minutes
      }
    };
    
    // Merge default config with provided config
    this.config = this.#mergeConfig(this.defaultConfig, config);
    
    // Initialize components
    this.initialized = false;
    this.components = {};
    
    // Initialize session ID
    this.sessionId = this.#getOrCreateSessionId();
    
    // Initialize the search system
    this.#initialize();
  }
  
  /**
   * Initialize the search system
   * @private
   */
  #initialize() {
    console.log('Initializing SearchSystem');
    
    // Find DOM elements
    this.#findDomElements();
    
    // Initialize search handlers with debouncing
    this.#initializeSearchHandlers();
    
    // Set up event listeners
    this.#setupEventListeners();
    
    // Check if this is a search results page and handle URL parameters
    this.#handleUrlParameters();
    
    this.initialized = true;
    console.log('SearchSystem initialized');
  }
  
  /**
   * Find and store DOM elements
   * @private
   */
  #findDomElements() {
    const selectors = this.config.components.selectors;
    
    // Global search components (may be on any page)
    this.elements = {
      globalSearch: document.querySelector(selectors.globalSearch),
      globalSearchButton: document.querySelector(selectors.globalSearchButton),
      pageSearch: document.querySelector(selectors.pageSearch),
      pageSearchButton: document.querySelector(selectors.pageSearchButton),
      resultsContainer: document.querySelector(selectors.resultsContainer),
      suggestionsContainer: document.querySelector(selectors.suggestionsContainer)
    };
    
    // Determine what type of page we're on
    this.isResultsPage = !!this.elements.resultsContainer;
    
    // Log found elements in debug mode
    if (this.config.debug) {
      console.log('SearchSystem DOM elements:', this.elements);
      console.log('Is results page:', this.isResultsPage);
    }
  }
  
  /**
   * Initialize search handlers with debouncing
   * @private
   */
  #initializeSearchHandlers() {
    // Create debounced suggestion handler
    this.handleSuggestInput = debounce(
      this.#fetchSuggestions.bind(this),
      this.config.debounce.suggest
    );
    
    // Create optimized search debounce
    this.handleSearchInput = createSearchDebounce(
      this.#performSearch.bind(this),
      {
        minQueryLength: 3,
        shortQueryDelay: 100,
        longQueryDelay: 300,
        longQueryThreshold: 5
      }
    );
  }
  
  /**
   * Set up event listeners
   * @private
   */
  #setupEventListeners() {
    // Global search input (header)
    if (this.elements.globalSearch) {
      this.elements.globalSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length >= 3) {
          this.handleSuggestInput(query, 'global');
        }
      });
      
      // Global search form submission
      const globalForm = this.elements.globalSearch.closest('form');
      if (globalForm) {
        globalForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const query = this.elements.globalSearch.value.trim();
          if (query) {
            this.#handleGlobalSearch(query);
          }
        });
      }
    }
    
    // Page-specific search (results page)
    if (this.elements.pageSearch) {
      // Usually handled by existing form handlers, but add backup
      const pageForm = this.elements.pageSearch.closest('form');
      if (pageForm) {
        pageForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const query = this.elements.pageSearch.value.trim();
          if (query) {
            this.#performSearch(query);
          }
        });
      }
    }
    
    // Handle clicks outside suggestion containers
    document.addEventListener('click', (e) => {
      // Close any open suggestion containers if clicking outside
      if (this.elements.suggestionsContainer && 
          !this.elements.suggestionsContainer.contains(e.target) &&
          (!this.elements.globalSearch || !this.elements.globalSearch.contains(e.target)) &&
          (!this.elements.pageSearch || !this.elements.pageSearch.contains(e.target))) {
        this.elements.suggestionsContainer.innerHTML = '';
        this.elements.suggestionsContainer.hidden = true;
      }
    });
  }
  
  /**
   * Handle URL parameters for search
   * @private
   */
  #handleUrlParameters() {
    if (!this.isResultsPage) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    
    if (query) {
      // Set the query in the search input
      if (this.elements.pageSearch) {
        this.elements.pageSearch.value = query;
      }
      
      // Perform the search
      this.#performSearch(query);
    }
  }
  
  /**
   * Gets or creates a session ID for analytics tracking
   * @private
   * @returns {string} A unique session ID
   */
  #getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('searchSessionId');
    
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('searchSessionId', sessionId);
    }
    
    return sessionId;
  }
  
  /**
   * Merge configurations with deep object merging
   * @private
   * @param {Object} defaultConfig - Default configuration
   * @param {Object} overrideConfig - Override configuration
   * @returns {Object} Merged configuration
   */
  #mergeConfig(defaultConfig, overrideConfig) {
    const merged = { ...defaultConfig };
    
    for (const [key, value] of Object.entries(overrideConfig)) {
      // If both values are objects and not arrays, merge them recursively
      if (
        typeof value === 'object' && 
        value !== null && 
        !Array.isArray(value) &&
        typeof merged[key] === 'object' && 
        merged[key] !== null && 
        !Array.isArray(merged[key])
      ) {
        merged[key] = this.#mergeConfig(merged[key], value);
      } else {
        // Otherwise just override the value
        merged[key] = value;
      }
    }
    
    return merged;
  }
  
  /**
   * Fetch suggestions from the API
   * @private
   * @param {string} query - The search query
   * @param {string} source - Source of the query ('global' or 'page')
   */
  async #fetchSuggestions(query, source = 'global') {
    if (!query || query.length < 3) return;
    
    try {
      const params = new URLSearchParams({
        partial_query: query,
        collection: this.config.searchParams.collection,
        profile: this.config.searchParams.profile,
        sessionId: this.sessionId
      });
      
      const url = `${this.config.endpoints.baseUrl}${this.config.endpoints.suggest}?${params}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Suggestion request failed: ${response.status}`);
      
      const suggestions = await response.json();
      
      // Display suggestions
      this.#displaySuggestions(suggestions, source);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  }
  
  /**
   * Display suggestions in the appropriate container
   * @private
   * @param {Array} suggestions - Array of suggestions
   * @param {string} source - Source of the suggestions ('global' or 'page')
   */
  #displaySuggestions(suggestions, source = 'global') {
    // Handle differently based on page type and source
    if (source === 'global' && this.elements.suggestionsContainer) {
      // Simple global suggestions
      this.#renderGlobalSuggestions(suggestions);
    } else if (this.isResultsPage && this.elements.suggestionsContainer) {
      // Let the existing handlers manage this
      // This is usually handled by existing code in your dynamic-results-manager.js
    }
  }
  
  /**
   * Render global suggestions in a simple dropdown
   * @private
   * @param {Array} suggestions - Array of suggestions
   */
  #renderGlobalSuggestions(suggestions) {
    if (!this.elements.suggestionsContainer || !suggestions.length) {
      if (this.elements.suggestionsContainer) {
        this.elements.suggestionsContainer.innerHTML = '';
        this.elements.suggestionsContainer.hidden = true;
      }
      return;
    }
    
    const html = `
      <div class="suggestions-list">
        ${suggestions.map((suggestion, index) => `
          <div class="suggestion-item" role="option" data-index="${index}">
            <span class="suggestion-text">${suggestion.display || suggestion}</span>
          </div>
        `).join('')}
      </div>
    `;
    
    this.elements.suggestionsContainer.innerHTML = html;
    this.elements.suggestionsContainer.hidden = false;
    
    // Add click handlers
    const items = this.elements.suggestionsContainer.querySelectorAll('.suggestion-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const text = item.querySelector('.suggestion-text').textContent;
        if (this.elements.globalSearch) {
          this.elements.globalSearch.value = text;
        }
        this.elements.suggestionsContainer.innerHTML = '';
        this.elements.suggestionsContainer.hidden = true;
        
        // Trigger search
        this.#handleGlobalSearch(text);
      });
    });
  }
  
  /**
   * Handle global search action (typically redirect to search page)
   * @private
   * @param {string} query - The search query
   */
  #handleGlobalSearch(query) {
    if (!query) return;
    
    // Construct search URL
    const params = new URLSearchParams({
      query,
      collection: this.config.searchParams.collection,
      profile: this.config.searchParams.profile
    });
    
    // Redirect to search page
    window.location.href = `/search-test/?${params.toString()}`;
  }
  
  /**
   * Perform a direct search and update results container
   * @private
   * @param {string} query - The search query
   */
  async #performSearch(query) {
    if (!query || !this.elements.resultsContainer) return;
    
    try {
      // Show loading state
      this.elements.resultsContainer.innerHTML = '<div class="loading-indicator">Loading results...</div>';
      
      // Prepare search parameters
      const params = new URLSearchParams({
        query,
        collection: this.config.searchParams.collection,
        profile: this.config.searchParams.profile,
        form: this.config.searchParams.form,
        sessionId: this.sessionId
      });
      
      const url = `${this.config.endpoints.baseUrl}${this.config.endpoints.search}?${params}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Search request failed: ${response.status}`);
      
      const html = await response.text();
      
      // Update results container
      this.elements.resultsContainer.innerHTML = `
        <div class="funnelback-search-container">
          ${html}
        </div>
      `;
      
      // Update URL without page reload to reflect the search
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('query', query);
      window.history.pushState({}, '', newUrl);
      
      // Scroll to results if not already visible
      this.elements.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
    } catch (error) {
      console.error('Search error:', error);
      this.elements.resultsContainer.innerHTML = `
        <div class="error-message">
          <p>Search error: ${error.message}</p>
        </div>
      `;
    }
  }
  
  /**
   * Log a search result click for analytics
   * @param {string} url - The clicked URL
   * @param {string} title - The result title
   * @param {number} position - The result position
   */
  logResultClick(url, title, position) {
    if (!this.config.analytics) return;
    
    try {
      const clickData = {
        originalQuery: new URLSearchParams(window.location.search).get('query') || '',
        clickedUrl: url,
        clickedTitle: title,
        clickPosition: position,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      };
      
      // Use sendBeacon for non-blocking operation
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(clickData)], {
          type: 'application/json'
        });
        navigator.sendBeacon(`${this.config.endpoints.baseUrl}/analytics/click`, blob);
        return;
      }
      
      // Fallback to fetch with keepalive
      fetch(`${this.config.endpoints.baseUrl}/analytics/click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(clickData),
        keepalive: true
      }).catch(error => {
        console.error('Error sending click data:', error);
      });
    } catch (error) {
      console.error('Failed to log result click:', error);
    }
  }
}

// Export singleton instance
const searchSystem = new SearchSystem();
export default searchSystem;