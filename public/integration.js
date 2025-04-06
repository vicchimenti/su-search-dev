/**
 * @fileoverview Frontend Search Integration Script
 * 
 * This script integrates the frontend search API with the Seattle University website.
 * It enhances the existing search functionality by proxying requests through the new API
 * while maintaining compatibility with the current UI components.
 *
 * @author Victor Chimenti
 * @version 1.3.0
 * @lastModified 2025-04-06
 */

(function() {
  // Configuration for the frontend API
  const config = {
    apiBaseUrl: 'https://su-search-dev.vercel.app',
    collection: 'seattleu~sp-search',
    profile: '_default',
    minQueryLength: 3,
    debounceTime: 200,
    sessionManagerRetries: 5,  // Number of retries to find SessionManager
    sessionManagerRetryDelay: 100  // Milliseconds between retries
  };
  
  // Make config available globally
  window.seattleUConfig = window.seattleUConfig || {};
  window.seattleUConfig.search = {
    ...config,
    ...window.seattleUConfig?.search
  };

  // Local session ID (for fallback only)
  let localSessionId = null;

  /**
   * Get SessionManager with retry mechanism
   * @param {number} retries - Number of retries remaining
   * @returns {Promise<Object|null>} - SessionManager or null if not available
   */
  function getSessionManager(retries = config.sessionManagerRetries) {
    return new Promise(resolve => {
      if (window.SessionService) {
        resolve(window.SessionService);
        return;
      }
      
      if (retries <= 0) {
        console.warn('🔍 SessionManager not available after retries, using local session management');
        resolve(null);
        return;
      }
      
      setTimeout(() => {
        getSessionManager(retries - 1).then(resolve);
      }, config.sessionManagerRetryDelay);
    });
  }
  
  /**
   * Get session ID safely from SessionManager or fallback
   * @returns {Promise<string>} Session ID
   */
  async function getSessionId() {
    // Try to get SessionManager
    const sessionManager = await getSessionManager();
    
    if (sessionManager) {
      try {
        // Use SessionManager if available
        return sessionManager.getSessionId();
      } catch (error) {
        console.error('🔍 Error getting session ID from SessionManager:', error);
        // Fall through to fallback
      }
    }
    
    // Fallback to local session ID
    if (!localSessionId) {
      try {
        // Try to use sessionStorage for persistence
        localSessionId = sessionStorage.getItem('searchSessionId');
        
        if (!localSessionId) {
          localSessionId = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
          sessionStorage.setItem('searchSessionId', localSessionId);
        }
      } catch (e) {
        // Ultimate fallback if even sessionStorage fails
        localSessionId = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      }
      
      console.log('🔍 Using local session ID (fallback):', localSessionId);
    }
    
    return localSessionId;
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔍 Frontend Search Integration: Initializing');
    
    // Get session ID for tracking
    const sessionId = await getSessionId();
    console.log('🔍 Session ID:', sessionId);
    
    // Detect environment
    const isResultsPage = window.location.pathname.includes('search-test');
    console.log('🔍 On results page:', isResultsPage);
    
    // Find search components
    const searchComponents = findSearchComponents();
    
    // Set up integrations based on detected components
    if (searchComponents.header) {
      setupHeaderSearch(searchComponents.header, sessionId);
    }
    
    if (isResultsPage && searchComponents.results) {
      setupResultsSearch(searchComponents.results, sessionId);
      
      // Process URL parameters for initial search
      processUrlParameters(searchComponents.results, sessionId);
    }
    
    console.log('🔍 Frontend Search Integration: Initialized');
  });
  
  /**
   * Find search components on the page
   * @returns {Object} Object containing references to header and results search components
   */
  function findSearchComponents() {
    const components = {
      header: null,
      results: null
    };
    
    // Header search components
    const headerInput = document.getElementById('search-input');
    const headerForm = headerInput?.closest('form');
    const headerButton = headerForm?.querySelector('button[type="submit"]');
    
    if (headerInput && headerForm) {
      components.header = {
        input: headerInput,
        form: headerForm,
        button: headerButton,
        container: document.createElement('div')
      };
      
      // Create suggestions container if not exists
      if (!document.getElementById('header-suggestions')) {
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = 'header-suggestions';
        suggestionsContainer.className = 'header-suggestions-container';
        suggestionsContainer.setAttribute('role', 'listbox');
        suggestionsContainer.hidden = true;
        
        // Insert after search form
        headerForm.parentNode.insertBefore(suggestionsContainer, headerForm.nextSibling);
        components.header.suggestionsContainer = suggestionsContainer;
      } else {
        components.header.suggestionsContainer = document.getElementById('header-suggestions');
      }
    }
    
    // Results page components
    const resultsInput = document.getElementById('autocomplete-concierge-inputField');
    const resultsForm = resultsInput?.closest('form');
    const resultsButton = resultsForm?.querySelector('#on-page-search-button');
    const resultsContainer = document.getElementById('results');
    const suggestionsContainer = document.getElementById('autocomplete-suggestions');
    
    if (resultsInput && resultsContainer) {
      components.results = {
        input: resultsInput,
        form: resultsForm,
        button: resultsButton,
        container: resultsContainer,
        suggestionsContainer: suggestionsContainer
      };
    }
    
    return components;
  }
  
  /**
   * Set up header search integration
   * @param {Object} component - Header search component references
   * @param {string} sessionId - Session ID for tracking
   */
  function setupHeaderSearch(component, sessionId) {
    console.log('🔍 Setting up header search integration');
    
    // Intercept form submission
    component.form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const query = component.input.value.trim();
      if (!query) return;
      
      // Navigate to search page with query
      window.location.href = `/search-test/?query=${encodeURIComponent(query)}`;
    });
    
    // Set up suggestions
    if (component.suggestionsContainer) {
      // Create debounced function for input handling
      const handleInput = debounce(async function() {
        const query = component.input.value.trim();
        
        if (query.length < config.minQueryLength) {
          component.suggestionsContainer.innerHTML = '';
          component.suggestionsContainer.hidden = true;
          return;
        }
        
        // Ensure we have the latest session ID
        const currentSessionId = await getSessionId();
        fetchHeaderSuggestions(query, component.suggestionsContainer, currentSessionId);
      }, config.debounceTime);
      
      component.input.addEventListener('input', handleInput);
    }
    
    // Handle clicks outside
    document.addEventListener('click', function(e) {
      if (component.suggestionsContainer &&
          !component.input.contains(e.target) &&
          !component.suggestionsContainer.contains(e.target)) {
        component.suggestionsContainer.innerHTML = '';
        component.suggestionsContainer.hidden = true;
      }
    });
  }
  
  /**
   * Fetch suggestions for header search
   * @param {string} query - Search query
   * @param {HTMLElement} container - Container for suggestions
   * @param {string} sessionId - Session ID for tracking
   */
  async function fetchHeaderSuggestions(query, container, sessionId) {
    console.log('🔍 Fetching header suggestions for:', query);
    
    try {
      // Show loading state
      // container.innerHTML = '<div class="loading-suggestions">Loading...</div>';
      // container.hidden = false;
      
      // Prepare URL with parameters
      const params = new URLSearchParams({
        query,
        sessionId
      });
      
      // Fetch suggestions from API
      const url = `${config.apiBaseUrl}/api/suggestions?${params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      // Get JSON response
      const data = await response.json();
      
      // Render header suggestions (simple list)
      renderHeaderSuggestions(data, container, query, sessionId);
    } catch (error) {
      console.error('🔍 Header suggestions error:', error);
      container.innerHTML = '';
      container.hidden = true;
    }
  }
  
  /**
   * Render header suggestions (simple list)
   * @param {Object} data - Suggestions data
   * @param {HTMLElement} container - Container for suggestions
   * @param {string} query - Original query
   * @param {string} sessionId - Session ID for tracking
   */
  function renderHeaderSuggestions(data, container, query, sessionId) {
    const suggestions = data.general || [];
    
    if (suggestions.length === 0) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }
    
    let html = '<div class="suggestions-list">';
    
    suggestions.forEach((suggestion, index) => {
      const display = suggestion.display || suggestion;
      html += `
        <div class="suggestion-item" role="option" data-index="${index}">
          <span class="suggestion-text">${display}</span>
        </div>
      `;
    });
    
    html += '</div>';
    
    container.innerHTML = html;
    container.hidden = false;
    
    // Add click handlers
    container.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', function() {
        const text = this.querySelector('.suggestion-text').textContent;
        
        // Set input value
        const input = document.getElementById('search-input');
        if (input) {
          input.value = text;
        }
        
        // Redirect to search page
        window.location.href = `/search-test/?query=${encodeURIComponent(text)}`;
      });
    });
  }

  /**
   * Set up results page search integration
   * @param {Object} component - Results search component references
   * @param {string} sessionId - Session ID for tracking
   */
  function setupResultsSearch(component, sessionId) {
    console.log('🔍 Setting up results page search integration');
    
    // Make sure search button is visible
    if (component.button) {
      component.button.classList.remove('empty-query');
    }
    
    // Intercept form submission
    if (component.form) {
      component.form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const query = component.input.value.trim();
        if (!query) return;
        
        // Ensure we have the latest session ID
        const currentSessionId = await getSessionId();
        performSearch(query, component.container, currentSessionId);
        
        // Update URL without reload
        updateUrl(query);
      });
    }
    
    // Set up click tracking on results
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('query') || '';
    attachResultClickHandlers(component.container, queryParam, sessionId);
  }

  /**
   * Process URL parameters for initial search
   * @param {Object} component - Results search component references
   * @param {string} sessionId - Session ID for tracking
   */
  function processUrlParameters(component, sessionId) {
    console.log('🔍 Processing URL parameters');
    
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    
    if (query) {
      console.log('🔍 Found query parameter:', query);
      
      // Set input value
      if (component.input) {
        component.input.value = query;
      }
      
      // Perform search
      performSearch(query, component.container, sessionId);
    }
  }
  
  /**
   * Perform search via API
   * @param {string} query - Search query
   * @param {HTMLElement} container - Container for results
   * @param {string} sessionId - Session ID for tracking
   */
  async function performSearch(query, container, sessionId) {
    console.log('🔍 Performing search for:', query);
    
    try {
      // Show loading state with spinner
      // container.innerHTML = '<div class="loading-results"><div class="spinner"></div><p>Loading search results...</p></div>';
      
      // Prepare URL with parameters
      const params = new URLSearchParams({
        query,
        collection: config.collection,
        profile: config.profile,
        sessionId
      });
      
      // Fetch results from API
      const url = `${config.apiBaseUrl}/api/search?${params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      // Get HTML response
      const html = await response.text();
      
      // Update results container
      container.innerHTML = `
        <div class="funnelback-search-container">
          ${html}
        </div>
      `;
      
      // Attach click handlers for tracking
      attachResultClickHandlers(container, query, sessionId);
      
      // Scroll to results if not in viewport AND page is not already at the top
      if (!isElementInViewport(container) && window.scrollY > 0) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (error) {
      console.error('🔍 Search error:', error);
      container.innerHTML = `
        <div class="search-error">
          <h3>Error Loading Results</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Attach click handlers to search results for tracking
   * @param {HTMLElement} container - Results container
   * @param {string} query - Search query
   * @param {string} sessionId - Session ID for tracking
   */
  function attachResultClickHandlers(container, query, sessionId) {
    // Find all result links
    const resultLinks = container.querySelectorAll(
      '.fb-result h3 a, .search-result-item h3 a, .listing-item__title a'
    );
    
    resultLinks.forEach((link, index) => {
      link.addEventListener('click', async function(e) {
        // Don't prevent default navigation
        
        // Get link details
        const url = link.getAttribute('data-live-url') || link.getAttribute('href') || '';
        const title = link.textContent.trim() || '';
        
        // Ensure we have the latest session ID
        const currentSessionId = await getSessionId();
        
        // Track click
        trackResultClick(query, url, title, index + 1, currentSessionId);
      });
    });
  }

  /**
   * Track result click via API
   * @param {string} query - Original query
   * @param {string} url - Clicked URL
   * @param {string} title - Result title
   * @param {number} position - Result position (1-based)
   * @param {string} sessionId - Session ID for tracking
   */
  function trackResultClick(query, url, title, position, sessionId) {
    try {
      console.log('🔍 Tracking result click:', { query, url, title, position });
      
      // Prepare data
      const data = {
        type: 'click',
        originalQuery: query,
        clickedUrl: url,
        clickedTitle: title,
        clickPosition: position,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      };
      
      // Use sendBeacon if available for non-blocking operation
      const endpoint = `${config.apiBaseUrl}/api/enhance`;
      
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(data)], {
          type: 'application/json'
        });
        navigator.sendBeacon(endpoint, blob);
      } else {
        // Fallback to fetch with keepalive
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          keepalive: true
        }).catch(err => console.error('Error tracking click:', err));
      }
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  }
  
  /**
   * Track suggestion click for analytics
   * Exposed globally for use by search-page-autocomplete.js
   * @param {string} text - Suggestion text
   * @param {string} type - Suggestion type (general, staff, program)
   * @param {string} url - Clicked URL (for staff and programs)
   * @param {string} title - Display title (with additional context)
   * @param {string} sessionId - Session ID
   */
  window.trackSuggestionClick = async function(text, type, url, title, sessionId) {
    try {
      console.log('🔍 Tracking suggestion click:', { text, type, url, title });
      
      // Get session ID if not provided
      if (!sessionId) {
        sessionId = await getSessionId();
      }
      
      // Prepare data for the API call
      const data = {
        type: 'click',
        originalQuery: text,
        clickedUrl: url || '',
        clickedTitle: title || text,
        clickType: type || 'suggestion',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      };
      
      // Use sendBeacon if available for non-blocking operation
      const endpoint = `${config.apiBaseUrl}/api/enhance`;
      
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(data)], {
          type: 'application/json'
        });
        navigator.sendBeacon(endpoint, blob);
      } else {
        // Fallback to fetch with keepalive
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          keepalive: true
        }).catch(err => console.error('Error tracking suggestion click:', err));
      }
    } catch (error) {
      console.error('Error tracking suggestion click:', error);
    }
  };
  
  /**
   * Update URL without page reload
   * @param {string} query - Search query
   */
  function updateUrl(query) {
    if (!window.history?.pushState) return;
    
    const url = new URL(window.location);
    url.searchParams.set('query', query);
    window.history.pushState({}, '', url);
    console.log('🔍 Updated URL:', url.toString());
  }
  
  /**
   * Get or create a session ID for tracking
   * Exposed globally for use by search-page-autocomplete.js
   * @returns {Promise<string>} Session ID
   */
  async function getOrCreateSearchSessionId() {
    return await getSessionId();
  }
  
  // Expose session ID function globally for search-page-autocomplete.js
  window.getOrCreateSearchSessionId = getOrCreateSearchSessionId;
  
  /**
   * Debounce function to limit execution frequency
   * @param {Function} func - Function to debounce
   * @param {number} wait - Milliseconds to wait between calls
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  
  // Expose debounce function globally for search-page-autocomplete.js
  window.debounceFunction = debounce;
  
  /**
   * Check if element is in viewport
   * @param {HTMLElement} el - Element to check
   * @returns {boolean} Whether element is in viewport
   */
  function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    const isVisible = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
    return isVisible;
  }
  
  // Expose configuration globally for search-page-autocomplete.js
  window.searchConfig = config;
  
  /**
   * Perform search via API (exposed globally for search-page-autocomplete.js)
   * @param {string} query - Search query
   * @param {string|HTMLElement} containerId - Container ID or element for results
   * @param {string} sessionId - Session ID for tracking
   */
  window.performSearch = async function(query, containerId, sessionId) {
    const container = typeof containerId === 'string' ? 
                    document.getElementById(containerId) : containerId;
    
    if (!container) {
      console.error('🔍 Container not found:', containerId);
      return;
    }
    
    if (!sessionId) {
      sessionId = await getSessionId();
    }
    
    return performSearch(query, container, sessionId);
  };
  
  /**
   * Update URL without page reload (exposed globally for search-page-autocomplete.js)
   */
  window.updateSearchUrl = updateUrl;
})();