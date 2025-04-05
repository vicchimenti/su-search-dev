/**
 * @fileoverview Client-side bundle for CMS integration
 * 
 * This file provides the client-side functionality for integrating
 * the search system into the Seattle University CMS.
 *
 * @author Victor Chimenti
 * @version 1.1.0
 * @lastModified 2025-04-05
 */

(function() {
  // Look for SessionManager if loaded
  const SessionManager = window.SessionManager || {};
  
  // Configuration with defaults
  const config = window.seattleUConfig?.search || {
    apiBaseUrl: 'https://frontend-search-api.vercel.app',
    backendUrl: 'https://funnelback-proxy-dev.vercel.app/proxy',
    collection: 'seattleu~sp-search',
    profile: '_default'
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
      }
      
      return sessionId;
    } catch (e) {
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }
  }
  
  /**
   * Track events using the centralized SessionManager
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
    
    // Fall back to direct API call with the enhance endpoint
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
      
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json'
        });
        navigator.sendBeacon(endpoint, blob);
      } else {
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
  
  // Debounce function for input handling
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  
  // Initialize search on page load
  function initializeSearch() {
    // Find search elements
    const headerSearch = document.getElementById('search-input');
    const headerSearchButton = document.getElementById('search-button');
    const pageSearch = document.getElementById('autocomplete-concierge-inputField');
    const pageSearchButton = document.getElementById('on-page-search-button');
    const resultsContainer = document.getElementById('results');
    const suggestionsContainer = document.getElementById('autocomplete-suggestions') || 
                                document.getElementById('search-suggestions');
    
    // Determine if we're on a search results page
    const isResultsPage = !!resultsContainer;
    
    // Get session ID using SessionManager
    const sessionId = getSessionId();
    
    // Setup header search if present
    if (headerSearch && headerSearchButton) {
      setupHeaderSearch(headerSearch, headerSearchButton, sessionId);
    }
    
    // Setup page search if present (results page)
    if (isResultsPage && pageSearch) {
      setupPageSearch(pageSearch, pageSearchButton, resultsContainer, suggestionsContainer, sessionId);
    }
    
    // Process URL parameters on results page
    if (isResultsPage) {
      processUrlParameters(resultsContainer, sessionId);
    }
    
    // Track page view event
    trackEvent('page_view', {
      url: window.location.href,
      referrer: document.referrer,
      isResultsPage
    });
    
    console.log('Seattle University Search initialized');
  }
  
  // Setup header search functionality
  function setupHeaderSearch(searchInput, searchButton, sessionId) {
    // Handle form submission
    const form = searchInput.closest('form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const query = searchInput.value.trim();
        if (!query) return;
        
        // Track search submit event
        trackEvent('search_submit', {
          query,
          location: 'header',
          source: 'form_submit'
        });
        
        // Navigate to search page with query
        window.location.href = `/search-test/?query=${encodeURIComponent(query)}`;
      });
    }
    
    // Set up suggestions if container exists
    const suggestionsContainer = document.getElementById('search-suggestions');
    if (suggestionsContainer) {
      // Debounced input handler for suggestions
      const handleInput = debounce(function() {
        const query = searchInput.value.trim();
        if (query.length < 3) {
          suggestionsContainer.innerHTML = '';
          suggestionsContainer.hidden = true;
          return;
        }
        
        // Track search typing event
        trackEvent('search_typing', {
          query,
          location: 'header',
          queryLength: query.length
        });
        
        // Fetch suggestions
        fetchSuggestions(query, suggestionsContainer, sessionId);
      }, config.debounceTime || 200);
      
      searchInput.addEventListener('input', handleInput);
    }
  }
  
  // Setup page search functionality
  function setupPageSearch(searchInput, searchButton, resultsContainer, suggestionsContainer, sessionId) {
    // Handle form submission
    const form = searchInput.closest('form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const query = searchInput.value.trim();
        if (!query) return;
        
        // Track search submit event
        trackEvent('search_submit', {
          query,
          location: 'results_page',
          source: 'form_submit'
        });
        
        // Perform search
        performSearch(query, resultsContainer, sessionId);
        
        // Update URL
        updateUrl(query);
      });
    }
    
    // Set up suggestions if container exists
    if (suggestionsContainer) {
      // Debounced input handler for suggestions
      const handleInput = debounce(function() {
        const query = searchInput.value.trim();
        if (query.length < 3) {
          suggestionsContainer.innerHTML = '';
          suggestionsContainer.hidden = true;
          return;
        }
        
        // Track search typing event
        trackEvent('search_typing', {
          query,
          location: 'results_page',
          queryLength: query.length
        });
        
        // Fetch suggestions
        fetchSuggestions(query, suggestionsContainer, sessionId, true);
      }, config.debounceTime || 200);
      
      searchInput.addEventListener('input', handleInput);
    }
  }
  
  // Process URL parameters
  function processUrlParameters(resultsContainer, sessionId) {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    
    if (query) {
      // Set query in input field if it exists
      const searchInput = document.getElementById('autocomplete-concierge-inputField');
      if (searchInput) {
        searchInput.value = query;
      }
      
      // Track search from URL event
      trackEvent('search_from_url', {
        query,
        referrer: document.referrer
      });
      
      // Perform search
      performSearch(query, resultsContainer, sessionId);
    }
  }
  
  // Fetch suggestions from API
  async function fetchSuggestions(query, container, sessionId, isPage = false) {
    try {
      container.innerHTML = '<div class="loading-suggestions">Loading...</div>';
      container.hidden = false;
      
      // Use consistent sessionId
      const url = `${config.apiBaseUrl}/api/suggestions?query=${encodeURIComponent(query)}&sessionId=${sessionId}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Render suggestions
      if (isPage) {
        renderPageSuggestions(data, container, query, sessionId);
      } else {
        renderHeaderSuggestions(data, container, query, sessionId);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      container.innerHTML = '';
      container.hidden = true;
      
      // Track error event
      trackEvent('suggestion_error', {
        query,
        error: error.message
      });
    }
  }
  
  // Render header suggestions
  function renderHeaderSuggestions(data, container, query, sessionId) {
    // Use simplified view for header
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
    
    // Track suggestions shown event
    trackEvent('suggestions_shown', {
      query,
      count: suggestions.length,
      location: 'header'
    });
    
    // Add click handlers
    container.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', function() {
        const text = this.querySelector('.suggestion-text').textContent;
        const position = parseInt(this.dataset.index) + 1;
        
        // Track suggestion click
        trackEvent('suggestion_click', {
          query,
          suggestion: text,
          location: 'header',
          position
        });
        
        // Find the search input and set value
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.value = text;
        }
        
        // Redirect to search page
        window.location.href = `/search-test/?query=${encodeURIComponent(text)}`;
      });
    });
  }
  
  // Render page suggestions (3-column layout)
  function renderPageSuggestions(data, container, query, sessionId) {
    const general = data.general || [];
    const staff = data.staff || [];
    const programs = data.programs?.programs || [];
    
    if (general.length === 0 && staff.length === 0 && programs.length === 0) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }
    
    let html = `
    <div class="suggestions-list">
      <div class="suggestions-columns">
        ${general.length > 0 ? `
          <div class="suggestions-column">
            <div class="column-header">Suggestions</div>
            ${general.map((suggestion, index) => {
              const display = suggestion.display || suggestion;
              return `
                <div class="suggestion-item" role="option" data-index="${index}" data-type="general">
                  <span class="suggestion-text">${display}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
        
        ${staff.length > 0 ? `
          <div class="suggestions-column">
            <div class="column-header">Faculty & Staff</div>
            ${staff.map((person, index) => `
              <div class="suggestion-item staff-item" role="option" data-index="${index}" data-type="staff" data-url="${person.url || '#'}">
                <a href="${person.url || '#'}" class="staff-link" target="_blank" rel="noopener noreferrer">
                  <div class="staff-suggestion">
                    ${person.image ? `
                      <div class="staff-image">
                        <img src="${person.image}" alt="${person.title || ''}" class="staff-thumbnail" loading="lazy">
                      </div>
                    ` : ''}
                    <div class="staff-info">
                      <span class="suggestion-text">${person.title || ''}</span>
                      ${person.position ? `<span class="staff-role">${person.position}</span>` : ''}
                      ${person.department ? `<span class="staff-department">${person.department}</span>` : ''}
                    </div>
                  </div>
                </a>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${programs.length > 0 ? `
          <div class="suggestions-column">
            <div class="column-header">Programs</div>
            ${programs.map((program, index) => `
              <div class="suggestion-item program-item" role="option" data-index="${index}" data-type="program" data-url="${program.url || '#'}">
                <a href="${program.url || '#'}" class="program-link" target="_blank" rel="noopener noreferrer">
                  <div class="program-suggestion">
                    <span class="suggestion-text">${program.title || ''}</span>
                    ${program.details?.school ? `<span class="suggestion-type">${program.details.school}</span>` : ''}
                    ${program.description ? `<span class="program-description">${program.description}</span>` : ''}
                  </div>
                </a>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
  
    container.innerHTML = html;
    container.hidden = false;
    
    // Track suggestions shown event
    trackEvent('suggestions_shown', {
      query,
      general_count: general.length,
      staff_count: staff.length,
      program_count: programs.length,
      location: 'results_page'
    });
    
    // Add click handlers
    container.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', function(e) {
        const text = this.querySelector('.suggestion-text').textContent;
        const type = this.dataset.type;
        const url = this.dataset.url;
        const position = parseInt(this.dataset.index) + 1;
        
        // Track suggestion click
        trackEvent('suggestion_click', {
          text,
          type,
          url: url || '',
          location: 'results_page',
          position
        });
        
        // Find the search input and set value
        const searchInput = document.getElementById('autocomplete-concierge-inputField');
        if (searchInput) {
          searchInput.value = text;
        }
        
        // For staff and program items with URLs
        if ((type === 'staff' || type === 'program') && url && url !== '#') {
          // If click was on a link, let it handle navigation
          if (e.target.closest('a')) {
            return;
          }
          
          // Otherwise open in new tab
          window.open(url, '_blank', 'noopener,noreferrer');
        }
        
        // Hide suggestions
        container.innerHTML = '';
        container.hidden = true;
        
        // Perform search
        const resultsContainer = document.getElementById('results');
        if (resultsContainer) {
          performSearch(text, resultsContainer, sessionId);
        }
        
        // Update URL
        updateUrl(text);
      });
    });
  }
  
  // Perform search with API
  async function performSearch(query, container, sessionId) {
    try {
      // Show loading state
      container.innerHTML = '<div class="loading-results">Loading search results...</div>';
      
      // Use consistent sessionId
      const url = `${config.apiBaseUrl}/api/search?query=${encodeURIComponent(query)}&collection=${config.collection}&profile=${config.profile}&sessionId=${sessionId}`;
      
      // Fetch search results
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      // Get response as text (HTML)
      const html = await response.text();
      
      // Update results container
      container.innerHTML = `
        <div class="funnelback-search-container">
          ${html}
        </div>
      `;
      
      // Track search results event
      trackEvent('search_results_displayed', {
        query,
        resultCount: getResultCount(html)
      });
      
      // Add click tracking to results
      attachResultClickHandlers(container, query, sessionId);
      
      // Scroll to results if not already visible
      if (!isElementInViewport(container)) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (error) {
      console.error('Error performing search:', error);
      container.innerHTML = `
        <div class="search-error">
          <p>Sorry, there was an error performing your search. Please try again later.</p>
          <p>Error details: ${error.message}</p>
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
  
  // Add click tracking to search results
  function attachResultClickHandlers(container, query, sessionId) {
    // Find all result links
    const resultLinks = container.querySelectorAll('.fb-result h3 a, .search-result-item h3 a, .listing-item__title a');
    
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
  
  // Track suggestion click for analytics
  function trackSuggestionClick(text, type, url, sessionId) {
    try {
      // Track using the centralized event tracking
      trackEvent('suggestion_click', {
        text,
        type,
        url: url || '',
        sessionId
      });
    } catch (error) {
      console.error('Error tracking suggestion click:', error);
    }
  }
  
  // Track result click for analytics
  function trackResultClick(query, url, title, position, sessionId) {
    try {
      // Track using the centralized event tracking
      trackEvent('result_click', {
        query,
        url,
        title,
        position,
        sessionId
      });
    } catch (error) {
      console.error('Error tracking result click:', error);
    }
  }
  
  // Update URL without page reload
  function updateUrl(query) {
    if (!window.history || !window.history.pushState) return;
    
    const url = new URL(window.location);
    url.searchParams.set('query', query);
    window.history.pushState({}, '', url);
  }
  
  // Check if element is in viewport
  function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
  
  // Expose for use by other modules
  window.getOrCreateSearchSessionId = getSessionId;
  window.trackSuggestionClick = function(text, type, url, title, sessionId) {
    trackEvent('suggestion_click', {
      text, 
      type, 
      url: url || '', 
      title: title || text,
      sessionId: sessionId || getSessionId()
    });
  };
  
  // Initialize search when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSearch);
  } else {
    initializeSearch();
  }
})();