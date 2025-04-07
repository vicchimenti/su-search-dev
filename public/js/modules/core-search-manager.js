/**
 * @fileoverview Search Manager Architecture
 * 
 * This architecture provides a modular approach to handling search functionality.
 * It consists of a core manager that coordinates feature-specific modules.
 * 
 * Features:
 * - Modular design with dynamic loading
 * - Centralized event delegation
 * - Optimized performance through targeted updates
 * - Comprehensive analytics tracking
 * 
 * @author Victor Chimenti
 * @version 1.3.0
 * @lastModified 2025-04-07
 */

// Core Search Manager
class SearchManager {
  /**
   * Create a new Search Manager instance
   */
  constructor() {
    // Default configuration
    this.config = {
      proxyBaseUrl: 'https://funnelback-proxy-dev.vercel.app/proxy',
      enabledModules: ['tabs', 'facets', 'pagination', 'spelling', 'analytics'],
      observerConfig: {
        childList: true,
        subtree: true
      },
      searchInputSelector: '#autocomplete-concierge-inputField',
      resultsContainerSelector: '#results',
      defaultResultsPerPage: 10
    };
    
    // Module registry
    this.modules = {};
    
    // State
    this.sessionId = null; // No longer initialize here; will get from SessionService
    this.originalQuery = null;
    this.isInitialized = false;
  }
  
  /**
   * Initialize the search manager with configuration
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    // Prevent multiple initializations
    if (this.isInitialized) {
      console.warn('Search Manager already initialized');
      return this;
    }
    
    // Merge configuration
    this.config = {
      ...this.config,
      ...options
    };
    
    // Initialize if on search page
    if (window.location.pathname.includes('search-test')) {
      this.initialize();
      this.isInitialized = true;
    }
    
    return this;
  }
  
  /**
   * Initialize the search manager and all enabled modules
   */
  async initialize() {
    // Get session ID from SessionService - the single source of truth
    this.initializeSessionId();
    
    // Extract query from URL or input
    this.extractOriginalQuery();
    
    // Set up observer for dynamic content
    this.initializeObserver();
    
    // Initialize modules
    await this.loadModules();
    
    // Start observing for DOM changes
    this.startObserving();
    
    console.log('Search Manager initialized with modules:', Object.keys(this.modules));
  }
  
  /**
   * Initialize session ID using SessionService
   */
  initializeSessionId() {
    try {
      if (window.SessionService) {
        this.sessionId = window.SessionService.getSessionId();
        console.log('Using SessionService for session ID:', this.sessionId);
      } else {
        console.warn('SessionService not found - analytics tracking will be limited');
        this.sessionId = null;
      }
    } catch (error) {
      console.error('Error accessing SessionService:', error);
      this.sessionId = null;
    }
  }
  
  /**
   * Load all enabled modules dynamically
   */
  async loadModules() {
    const modulePromises = this.config.enabledModules.map(async (moduleName) => {
      try {
        // Dynamic import the module
        const module = await import(`./${moduleName}-manager.js`);
        const ModuleClass = module.default;
        
        // Initialize the module
        this.modules[moduleName] = new ModuleClass(this);
        console.log(`Loaded module: ${moduleName}`);
      } catch (error) {
        console.error(`Failed to load module: ${moduleName}`, error);
      }
    });
    
    // Wait for all modules to load
    await Promise.all(modulePromises);
  }
  
  /**
   * Extract the original search query from URL or search input
   */
  extractOriginalQuery() {
    // Try to get query from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlQuery = urlParams.get('query');
    
    if (urlQuery) {
      this.originalQuery = urlQuery;
      return;
    }
    
    // Try to get query from search input field
    const searchInput = document.getElementById('autocomplete-concierge-inputField');
    if (searchInput && searchInput.value) {
      this.originalQuery = searchInput.value;
    }
  }
  
  /**
   * Get session ID - should be called by modules rather than accessing this.sessionId directly
   * Ensures consistent session ID usage across the application
   * @returns {string|null} Session ID or null if unavailable
   */
  getSessionId() {
    // If it's not set yet, try again from SessionService
    if (this.sessionId === null) {
      this.initializeSessionId();
    }
    
    return this.sessionId;
  }
  
  /**
   * Initialize the MutationObserver to watch for DOM changes
   */
  initializeObserver() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Notify all modules about DOM changes
          Object.values(this.modules).forEach(module => {
            if (typeof module.handleDomChanges === 'function') {
              module.handleDomChanges(mutation.addedNodes);
            }
          });
        }
      });
    });
  }
  
  /**
   * Start observing the results container for changes
   */
  startObserving() {
    const resultsContainer = document.getElementById('results');
    if (resultsContainer) {
      this.observer.observe(resultsContainer, this.config.observerConfig);
      console.log('Observer started watching results container');
    } else {
      console.warn('Results container not found, waiting for it to appear');
      this.waitForResultsContainer();
    }
  }
  
  /**
   * Wait for the results container to appear in the DOM
   */
  waitForResultsContainer() {
    const bodyObserver = new MutationObserver((mutations, obs) => {
      const resultsContainer = document.getElementById('results');
      if (resultsContainer) {
        obs.disconnect();
        this.observer.observe(resultsContainer, this.config.observerConfig);
        console.log('Results container found and observer started');
      }
    });
 
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * Fetch data from Funnelback API via proxy
   * @param {string} url - The original Funnelback URL
   * @param {string} type - The type of request (search, tools, spelling)
   * @returns {Promise<string>} The HTML response
   */
  async fetchFromProxy(url, type = 'search') {
    const endpoint = `${this.config.proxyBaseUrl}/funnelback/${type}`;
    
    try {
      let queryString;
      let fullUrl;
      
      switch (type) {
        case 'search':
          queryString = url.includes('?') ? url.split('?')[1] : '';
          // Only include sessionId if available
          fullUrl = this.sessionId 
            ? `${endpoint}?${queryString}&sessionId=${this.sessionId}` 
            : `${endpoint}?${queryString}`;
          break;
          
        case 'tools':
          queryString = new URLSearchParams({
            path: url.split('/s/')[1]
          });
          // Only add sessionId if available
          if (this.sessionId) {
            queryString.append('sessionId', this.sessionId);
          }
          fullUrl = `${endpoint}?${queryString}`;
          break;
          
        case 'spelling':
          queryString = url.includes('?') ? url.split('?')[1] : '';
          const params = new URLSearchParams(queryString);
          // Only add sessionId if available
          if (this.sessionId) {
            params.append('sessionId', this.sessionId);
          }
          fullUrl = `${endpoint}?${params.toString()}`;
          break;
          
        default:
          throw new Error(`Unknown request type: ${type}`);
      }
      
      console.log(`Fetching from ${type} endpoint:`, fullUrl);
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      console.error(`Error with ${type} request:`, error);
      return `<p>Error fetching ${type} request. Please try again later.</p>`;
    }
  }
  
  /**
   * Update the results container with new content
   * @param {string} html - The HTML content to display
   */
  updateResults(html) {
    const resultsContainer = document.getElementById('results');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="funnelback-search-container">
          ${html || "No results found."}
        </div>
      `;

      // Scroll to results if not in viewport and page is not already at the top
      if (!this.isElementInViewport(resultsContainer) && window.scrollY > 0) {
        resultsContainer.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    } else {
      console.error('Results container not found when updating results');
    }
  }
  
  /**
   * Check if an element is visible in the viewport
   * @param {Element} el - The element to check
   * @returns {boolean} True if element is in viewport
   */
  isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Send analytics data
   * @param {Object} data - The analytics data to send
   */
  sendAnalyticsData(data) {
    // Map data types to specific endpoints
    const typeToEndpoint = {
      'click': 'click',
      'facet': 'supplement',
      'pagination': 'supplement',
      'tab': 'supplement',
      'spelling': 'supplement',
      'batchClick': 'clicksBatch'
    };
    
    const endpointType = typeToEndpoint[data.type] || 'click'; // Default to click
    const endpoint = `${this.config.proxyBaseUrl}/analytics/${endpointType}`;
    
    try {
      // Create a copy of the data to modify
      const analyticsData = {...data};
      
      // Only include sessionId if available
      if (this.sessionId) {
        analyticsData.sessionId = this.sessionId;
      }
      
      // Use sendBeacon if available (works during page unload)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(analyticsData)], {
          type: 'application/json'
        });
        
        navigator.sendBeacon(endpoint, blob);
        return;
      } 
      
      // Fallback to fetch with keepalive
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        body: JSON.stringify(analyticsData),
        credentials: 'include',
        keepalive: true
      }).catch(error => {
        console.error('Error sending analytics data:', error);
      });
    } catch (error) {
      console.error('Failed to send analytics data:', error);
    }
  }
  
  /**
   * Clean up resources when the manager is destroyed
   */
  destroy() {
    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Destroy all modules
    Object.values(this.modules).forEach(module => {
      if (typeof module.destroy === 'function') {
        module.destroy();
      }
    });
  }
}

// Export as a singleton
const searchManager = new SearchManager();
export default searchManager;