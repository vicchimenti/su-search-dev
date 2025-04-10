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
 * @version 2.3.0
 * @lastModified 2025-04-10
 */

class SearchManager {

  constructor() {
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
    this.sessionId = null;
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
    const searchInput = document.querySelector(this.config.searchInputSelector);
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

      // Always refresh session ID to ensure we have the latest
      this.initializeSessionId();

      // Process based on request type
      switch (type) {
        case 'search':
          // Extract query string
          queryString = url.includes('?') ? url.split('?')[1] : '';

          // Parse and sanitize query parameters
          const searchParams = new URLSearchParams(queryString);

          // Remove any existing sessionId parameters
          if (searchParams.has('sessionId')) {
            const existingValues = searchParams.getAll('sessionId');
            if (existingValues.length > 1) {
              console.warn(`Found multiple sessionId parameters: ${existingValues.join(', ')}. Sanitizing.`);
            }
            searchParams.delete('sessionId');
          }

          // Add our canonical sessionId if available
          if (this.sessionId) {
            searchParams.append('sessionId', this.sessionId);
          }

          // Construct the full URL
          fullUrl = `${endpoint}?${searchParams.toString()}`;
          break;

        case 'tools':
          // Get path from URL
          const path = url.split('/s/')[1];

          // Create parameters object
          const toolsParams = new URLSearchParams({
            path
          });

          // Add canonical sessionId if available
          if (this.sessionId) {
            toolsParams.append('sessionId', this.sessionId);
          }

          // Construct the full URL
          fullUrl = `${endpoint}?${toolsParams.toString()}`;
          break;

        case 'spelling':
          // Extract query string
          queryString = url.includes('?') ? url.split('?')[1] : '';

          // Parse parameters
          const spellingParams = new URLSearchParams(queryString);

          // Remove any existing sessionId parameters
          if (spellingParams.has('sessionId')) {
            const existingValues = spellingParams.getAll('sessionId');
            if (existingValues.length > 1) {
              console.warn(`Found multiple sessionId parameters: ${existingValues.join(', ')}. Sanitizing.`);
            }
            spellingParams.delete('sessionId');
          }

          // Add canonical sessionId if available
          if (this.sessionId) {
            spellingParams.append('sessionId', this.sessionId);
          }

          // Construct the full URL
          fullUrl = `${endpoint}?${spellingParams.toString()}`;
          break;

        default:
          throw new Error(`Unknown request type: ${type}`);
      }

      console.log(`Fetching from ${type} endpoint with sanitized sessionId:`, fullUrl);
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
    const resultsContainer = document.querySelector(this.config.resultsContainerSelector);
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
   * Send analytics data to the appropriate endpoint
   * @param {Object} data - The analytics data to send
   */
  sendAnalyticsData(data) {
    try {
      // Always refresh session ID to ensure we have the latest
      this.initializeSessionId();

      // Create a deep copy of the data to modify
      const analyticsData = JSON.parse(JSON.stringify(data));

      // Only include sessionId if available
      if (this.sessionId) {
        analyticsData.sessionId = this.sessionId;
      }

      // Add timestamp if missing
      if (!analyticsData.timestamp) {
        analyticsData.timestamp = new Date().toISOString();
      }

      // Determine endpoint and prepare data format based on data type
      let endpoint;
      let formattedData;

      // Extract the type from analyticsData and store it
      const dataType = analyticsData.type;

      // IMPORTANT: Remove the type field from analyticsData as this is only used
      // for routing and is not expected by the backend endpoints
      delete analyticsData.type;

      // Format data according to endpoint requirements
      if (dataType === 'click') {
        // Format data for click endpoint
        endpoint = `${this.config.proxyBaseUrl}/analytics/click`;

        // Convert from originalQuery to query if needed
        if (analyticsData.originalQuery && !analyticsData.query) {
          analyticsData.query = analyticsData.originalQuery;
          delete analyticsData.originalQuery;
        }

        // Ensure required fields for click endpoint in a flat structure
        formattedData = {
          originalQuery: analyticsData.originalQuery || analyticsData.query || this.originalQuery || '',
          clickedUrl: analyticsData.clickedUrl || analyticsData.url || '',
          clickedTitle: analyticsData.clickedTitle || analyticsData.title || '',
          clickPosition: analyticsData.clickPosition || analyticsData.position || -1,
          sessionId: analyticsData.sessionId || undefined,
          timestamp: analyticsData.timestamp,
          clickType: analyticsData.clickType || 'search'
        };

        // Log what we're sending to click endpoint
        console.log('Sending click data:', {
          endpoint: endpoint,
          query: formattedData.originalQuery,
          url: formattedData.clickedUrl,
          position: formattedData.clickPosition,
          clickType: formattedData.clickType,
          sessionId: formattedData.sessionId || '(none)'
        });
      }
      else if (dataType === 'batch') {
        // Format data for batch clicks endpoint
        endpoint = `${this.config.proxyBaseUrl}/analytics/clicks-batch`;

        // Format batch data for clicks-batch endpoint
        formattedData = {
          clicks: (analyticsData.clicks || []).map(click => ({
            originalQuery: click.originalQuery || click.query || this.originalQuery || '',
            clickedUrl: click.clickedUrl || click.url || '',
            clickedTitle: click.clickedTitle || click.title || '',
            clickPosition: click.clickPosition || click.position || -1,
            sessionId: this.sessionId || undefined,
            timestamp: click.timestamp || analyticsData.timestamp,
            clickType: click.clickType || 'search'
          }))
        };

        // Log what we're sending to batch endpoint
        console.log('Sending batch click data:', {
          endpoint: endpoint,
          clickCount: formattedData.clicks.length,
          sessionId: this.sessionId || '(none)'
        });
      }
      else {
        // For all other types (facet, pagination, tab, spelling), use supplement endpoint
        endpoint = `${this.config.proxyBaseUrl}/analytics/supplement`;

        // For supplement endpoint, make sure we're using query (not originalQuery)
        // and include enrichmentData as expected by the backend
        if (analyticsData.originalQuery && !analyticsData.query) {
          analyticsData.query = analyticsData.originalQuery;
          delete analyticsData.originalQuery;
        }

        // Ensure we have a valid query
        if (!analyticsData.query) {
          analyticsData.query = this.originalQuery || '';
        }

        // Create a properly formatted object for supplement endpoint
        formattedData = {
          query: analyticsData.query,
          sessionId: analyticsData.sessionId
        };

        // Add resultCount if provided
        if (analyticsData.resultCount !== undefined) {
          formattedData.resultCount = analyticsData.resultCount;
        }

        // Add enrichmentData if provided
        if (analyticsData.enrichmentData) {
          formattedData.enrichmentData = analyticsData.enrichmentData;
        }

        // Log what we're sending to supplement endpoint
        console.log('Sending supplement data:', {
          endpoint: endpoint,
          query: formattedData.query,
          type: dataType, // Log the type for debugging, but don't include in payload
          details: formattedData.enrichmentData,
          sessionId: formattedData.sessionId || '(none)'
        });
      }

      // Send the data using sendBeacon if available (works during page unload)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(formattedData)], {
          type: 'application/json'
        });

        const success = navigator.sendBeacon(endpoint, blob);
        if (!success) {
          console.warn('sendBeacon failed, falling back to fetch');
          this.sendAnalyticsWithFetch(endpoint, formattedData);
        }
        return;
      }

      // Fallback to fetch with keepalive
      this.sendAnalyticsWithFetch(endpoint, formattedData);
    } catch (error) {
      console.error('Failed to send analytics data:', error);
    }
  }

  /**
   * Send analytics data using fetch API (fallback) with detailed error handling
   * @param {string} endpoint - The API endpoint
   * @param {Object} data - The formatted data to send
   */
  sendAnalyticsWithFetch(endpoint, data) {
    // Log exactly what we're sending
    console.log(`Sending analytics to ${endpoint} using fetch:`, data);

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      body: JSON.stringify(data),
      credentials: 'include',
      keepalive: true
    })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            console.error(`Analytics request failed: ${response.status} ${response.statusText}`, {
              endpoint,
              sentData: data,
              responseText: text
            });
          });
        }
        console.log(`Analytics request successful: ${endpoint}`);
      })
      .catch(error => {
        console.error('Error sending analytics data via fetch:', error, {
          endpoint,
          sentData: data
        });
      });
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