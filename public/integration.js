/**
 * @fileoverview Frontend Search Integration Script
 * 
 * This script integrates the frontend search API with the Seattle University website.
 * It enhances the existing search functionality by proxying requests through the new API
 * while maintaining compatibility with the current UI components.
 *
 * @author Victor Chimenti
 * @version 1.3.0
 * @lastModified 2025-04-05
 */

(function() {
  // Load the SessionManager if it's available as a script
  const SessionManager = window.SessionManager || {};
  
  // Configuration for the frontend API
  const config = {
    apiBaseUrl: 'https://su-search-dev.vercel.app',
    collection: 'seattleu~sp-search',
    profile: '_default',
    minQueryLength: 3,
    debounceTime: 200
  };
  
  // Make config available globally
  window.seattleUConfig = window.seattleUConfig || {};
  window.seattleUConfig.search = {
    ...config,
    ...window.seattleUConfig?.search
  };

  /**
   * Get session ID using the centralized SessionManager
   * @returns {string} Session ID
   */
  function getSessionId() {
    // Use the centralized SessionManager if available
    if (window.getSessionId) {
      return window.getSessionId();
    }
    
    // Use the manager instance if available
    if (SessionManager.getInstance) {
      return SessionManager.getInstance().getSessionId();
    }
    
    // Fall back to local implementation
    try {
      let sessionId = sessionStorage.getItem('searchSessionId');
      
      if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('searchSessionId', sessionId);
        console.log('🔍 Created new session ID:', sessionId);
      }
      
      return sessionId;
    } catch (e) {
      // Fallback if sessionStorage is unavailable
      const fallbackId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      console.log('🔍 Using fallback session ID (sessionStorage unavailable):', fallbackId);
      return fallbackId;
    }
  }
  
  /**
   * Track an event using the centralized SessionManager
   * @param {string} type - Event type
   * @param {object} data - Event data
   */
  function trackEvent(type, data) {
    // Use the centralized SessionManager if available
    if (window.trackSessionEvent) {
      return window.trackSessionEvent(type, data);
    }
    
    // Use the manager instance if available
    if (SessionManager.getInstance) {
      return SessionManager.getInstance().trackEvent(type, data);
    }
    
    // Fall back to direct API call
    try {
      const sessionId = getSessionId();
      const endpoint = `${config.apiBaseUrl}/api/enhance`;
      const payload = {
        type: 'events',
        events: [{
          type,
          data: {
            ...data,
            sessionId
          },
          timestamp: new Date().toISOString()
        }]
      };
      
      // Use sendBeacon if available
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json'
        });
        navigator.sendBeacon(endpoint, blob);
      } else {
        // Fallback to fetch
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(err => console.error('Error tracking event:', err));
      }
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }
  
  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Frontend Search Integration: Initializing');
    
    // Get session ID for tracking using the centralized SessionManager
    const sessionId = getSessionId();
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
    
    // Track page view event
    trackEvent('page_view', {
      url: window.location.href,
      referrer: document.referrer,
      isResultsPage
    });
    
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
      
      // Track search event
      trackEvent('search_submit', {
        query,
        location: 'header',
        source: 'form_submit'
      });
      
      // Navigate to search page with query
      window.location.href = `/search-test/?query=${encodeURIComponent(query)}`;
    });
    
    // Set up suggestions
    if (component.suggestionsContainer) {
      // Create debounced function for input handling
      const handleInput = debounce(function() {
        const query = component.input.value.trim();
        
        if (query.length < config.minQueryLength) {
          component.suggestionsContainer.innerHTML = '';
          component.suggestionsContainer.hidden = true;
          return;
        }
        
        // Track search typing event
        trackEvent('search_typing', {
          query,
          location: 'header',
          queryLength: query.length
        });
        
        fetchHeaderSuggestions(query, component.suggestionsContainer, sessionId);
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
        
        // Track suggestion click
        trackEvent('suggestion_click', {
          query,
          suggestion: text,
          location: 'header',
          position: parseInt(this.dataset.index) + 1
        });
        
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
      component.form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const query = component.input.value.trim();
        if (!query) return;
        
        // Track search submit event
        trackEvent('search_submit', {
          query,
          location: 'results_page',
          source: 'form_submit'
        });
        
        performSearch(query, component.container, sessionId);
        
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
      
      // Track search from URL event
      trackEvent('search_from_url', {
        query,
        referrer: document.referrer
      });
      
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
        container.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
      
      // Track search results event
      trackEvent('search_results_displayed', {
        query,
        resultCount: getResultCount(html)
      });
    } catch (error) {
      console.error('🔍 Search error:', error);
      container.innerHTML = `
        <div class="search-error">
          <h3>Error Loading Results</h3>
          <p>${error.message}</p>
        </div>
      `;
      
      // Track search error event
      trackEvent('search_error', {
        query,
        error: error.message
      });
    }
  }
  
  /**
   * Get result count from HTML response
   * @param {string} html - HTML response
   * @returns {number} Result count
   */
  function getResultCount(html) {
    try {
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
      link.addEventListener('click', function(e) {
        // Don't prevent default navigation
        
        // Get link details
        const url = link.getAttribute('data-live-url') || link.getAttribute('href') || '';
        const title = link.textContent.trim() || '';
        
        // Track click
        trackResultClick(query, url, title, index + 1, sessionId);
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
      
      // Track using the centralized event tracking
      trackEvent('result_click', {
        query,
        url,
        title,
        position,
        sessionId
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  }
  
  /**
   * Track suggestion click for analytics
   * Exposed globally for use by other modules
   * @param {string} text - Suggestion text
   * @param {string} type - Suggestion type (general, staff, program)
   * @param {string} url - Clicked URL (for staff and programs)
   * @param {string} title - Display title (with additional context)
   * @param {string} sessionId - Session ID
   */
  window.trackSuggestionClick = function(text, type, url, title, sessionId) {
    try {
      console.log('🔍 Tracking suggestion click:', { text, type, url, title });
      
      // Use the centralized event tracking
      trackEvent('suggestion_click', {
        text,
        type,
        url: url || '',
        title: title || text,
        sessionId: sessionId || getSessionId()
      });
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
  
  // Expose session ID function globally for other modules
  window.getOrCreateSearchSessionId = getSessionId;
  
  // Expose event tracking function globally for other modules
  window.trackSearchEvent = trackEvent;
  
  // Expose debounce function globally
  window.debounceFunction = debounce;
  
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
  
  // Expose configuration globally for other modules
  window.searchConfig = config;
  
  /**
   * Perform search via API (exposed globally for other modules)
   * @param {string} query - Search query
   * @param {string|HTMLElement} containerId - Container ID or element for results
   * @param {string} sessionId - Session ID for tracking
   */
  window.performSearch = function(query, containerId, sessionId) {
    const container = typeof containerId === 'string' ? 
                      document.getElementById(containerId) : containerId;
    
    if (!container) {
      console.error('🔍 Container not found:', containerId);
      return;
    }
    
    if (!sessionId) {
      sessionId = getSessionId();
    }
    
    return performSearch(query, container, sessionId);
  };
  
  /**
   * Update URL without page reload (exposed globally for other modules)
   */
  window.updateSearchUrl = updateUrl;
})();