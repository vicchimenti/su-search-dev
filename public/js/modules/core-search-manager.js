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
 * @version 2.0.0
 * @lastModified 2025-04-05
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
    this.sessionId = this.getOrCreateSessionId();
    this.originalQuery = null;
    this.isInitialized = false;
    this.currentTabId = null;
    
    // Flag to track content updates
    this.isUpdatingContent = false;
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
    console.log('Search Manager: Initializing');
    
    // Extract query from URL or input
    this.extractOriginalQuery();
    
    // Set up observer for dynamic content
    this.initializeObserver();
    
    // Integrate with existing scripts
    this.integrateWithExistingScripts();
    
    // Initialize modules prioritizing the tabs manager first
    await this.loadModules();
    
    // Start observing for DOM changes
    this.startObserving();
    
    console.log('Search Manager initialized with modules:', Object.keys(this.modules));
  }
  
  /**
   * Integrate with existing scripts to avoid conflicts
   */
  integrateWithExistingScripts() {
    // Prioritize our updateResults method if similar functions exist
    if (window.updateResults) {
      console.log('Found existing updateResults function, enhancing it');
      const originalUpdateResults = window.updateResults;
      window.updateResults = (html, container) => {
        this.isUpdatingContent = true;
        const result = this.updateResults(html, container || document.getElementById('results'));
        this.isUpdatingContent = false;
        return result;
      };
    }
  }
  
  /**
   * Load all enabled modules dynamically
   */
  async loadModules() {
    // Prioritize tab manager
    const priorityModules = ['tabs'];
    const normalModules = this.config.enabledModules.filter(m => !priorityModules.includes(m));
    
    // Load priority modules first
    for (const moduleName of priorityModules) {
      if (this.config.enabledModules.includes(moduleName)) {
        await this.loadModule(moduleName);
      }
    }
    
    // Then load other modules
    const modulePromises = normalModules.map(moduleName => this.loadModule(moduleName));
    await Promise.all(modulePromises);
  }
  
  /**
   * Load a single module
   * @param {string} moduleName - Name of the module to load
   */
  async loadModule(moduleName) {
    try {
      // Construct the module path
      const modulePath = `./${moduleName}-manager.js`;
      
      // Attempt import with retry logic
      let retries = 3;
      let module;
      
      while (retries > 0) {
        try {
          module = await import(modulePath);
          break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      const ModuleClass = module.default;
      
      // Initialize the module with a reference to this core manager
      this.modules[moduleName] = new ModuleClass(this);
      console.log(`Loaded module: ${moduleName}`);
      
      return this.modules[moduleName];
    } catch (error) {
      console.error(`Failed to load module: ${moduleName}`, error);
      return null;
    }
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
    const searchInput = document.querySelector(this.config.searchInputSelector);
    if (searchInput && searchInput.value) {
      this.originalQuery = searchInput.value;
    }
  }
  
  /**
   * Get or create a session ID for analytics tracking
   * @returns {string} Session ID
   */
  getOrCreateSessionId() {
    try {
      let sessionId = sessionStorage.getItem('searchSessionId');
      
      if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('searchSessionId', sessionId);
      }
      
      return sessionId;
    } catch (error) {
      // Fallback for private browsing mode
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }
  }
  
  /**
   * Initialize the MutationObserver to watch for DOM changes
   */
  initializeObserver() {
    this.observer = new MutationObserver((mutations) => {
      // Skip if we're the ones updating content
      if (this.isUpdatingContent) {
        return;
      }
      
      let hasRelevantChanges = false;
      let addedNodes = [];
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          hasRelevantChanges = true;
          addedNodes = [...addedNodes, ...Array.from(mutation.addedNodes)];
        }
      });
      
      if (hasRelevantChanges) {
        // Notify all modules about DOM changes
        Object.values(this.modules).forEach(module => {
          if (typeof module.handleDomChanges === 'function') {
            module.handleDomChanges(addedNodes);
          }
        });
      }
    });
  }
  
  /**
   * Start observing the results container for changes
   */
  startObserving() {
    const resultsContainer = document.querySelector(this.config.resultsContainerSelector);
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
      const resultsContainer = document.querySelector(this.config.resultsContainerSelector);
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
          fullUrl = `${endpoint}?${queryString}&sessionId=${this.sessionId}`;
          break;
          
        case 'tools':
          queryString = new URLSearchParams({
            path: url.split('/s/')[1],
            sessionId: this.sessionId
          });
          fullUrl = `${endpoint}?${queryString}`;
          break;
          
        case 'spelling':
          queryString = url.includes('?') ? url.split('?')[1] : '';
          const params = new URLSearchParams(queryString);
          params.append('sessionId', this.sessionId);
          fullUrl = `${endpoint}?${params.toString()}`;
          break;
          
        default:
          throw new Error(`Unknown request type: ${type}`);
      }
      
      console.log(`Fetching from ${type} endpoint:`, fullUrl);
      
      // Add timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(fullUrl, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`Request timeout for ${type} request`);
        return `<p>Request timed out. Please try again later.</p>`;
      }
      
      console.error(`Error with ${type} request:`, error);
      return `<p>Error fetching ${type} request. Please try again later.</p>`;
    }
  }
  
  /**
   * Update the results container with new content
   * @param {string} html - The HTML content to display
   * @param {Element} [container] - Optional container to update (defaults to #results)
   */
  updateResults(html, container) {
    this.isUpdatingContent = true;
    
    // Get container if not provided
    if (!container) {
      container = document.querySelector(this.config.resultsContainerSelector);
    }
    
    if (!container) {
      console.error('Results container not found');
      this.isUpdatingContent = false;
      return;
    }
    
    console.log('Updating results container');
    
    // Create a wrapper if it doesn't exist
    let funnelbackContainer = container.querySelector('.funnelback-search-container');
    
    if (!funnelbackContainer) {
      // Create the container
      container.innerHTML = `<div class="funnelback-search-container"></div>`;
      funnelbackContainer = container.querySelector('.funnelback-search-container');
    }
    
    // Update content
    funnelbackContainer.innerHTML = html || "No results found.";
    
    // Scroll to results if not in viewport and we're not in a tab change
    if (!this.isElementInViewport(container) && !this.modules.tabs?.isFromTabNavigation) {
      container.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
    
    // Extract tab ID if present
    this.extractTabId(container);
    
    // Notify modules about the content update
    setTimeout(() => {
      Object.values(this.modules).forEach(module => {
        if (typeof module.handleContentUpdate === 'function') {
          module.handleContentUpdate(container);
        }
      });
      
      this.isUpdatingContent = false;
    }, 0);
    
    return true;
  }
  
  /**
   * Extract tab ID from the updated content
   * @param {Element} container - The results container
   */
  extractTabId(container) {
    // Look for active tab
    const activeTab = container.querySelector('.tab-list__nav a[aria-selected="true"], [role="tab"][aria-selected="true"]');
    
    if (activeTab) {
      this.currentTabId = activeTab.id || activeTab.getAttribute('data-tab-group-control');
      console.log('Extracted current tab ID:', this.currentTabId);
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
    const endpoint = `${this.config.proxyBaseUrl}/analytics`;
    
    try {
      // Use sendBeacon if available (works during page unload)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(data)], {
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
        body: JSON.stringify(data),
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
   * Get the current state of the search application
   * @returns {Object} Current state
   */
  getState() {
    return {
      query: this.originalQuery,
      sessionId: this.sessionId,
      currentTabId: this.currentTabId,
      isUpdatingContent: this.isUpdatingContent,
      moduleStatus: Object.fromEntries(
        Object.entries(this.modules).map(([key, module]) => [
          key,
          { initialized: !!module.initialized }
        ])
      )
    };
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
    
    console.log('Search Manager destroyed');
  }
}

// Export as a singleton
const searchManager = new SearchManager();
export default searchManager;
