/**
 * @fileoverview Client-side bundle for CMS integration
 * 
 * This file provides the client-side functionality for integrating
 * the search system into the Seattle University CMS.
 *
 * @author Victor Chimenti
 * @version 1.2.0
 * @lastModified 2025-04-07
 */

(function() {
  // Configuration with defaults
  const config = window.seattleUConfig?.search || {
    apiBaseUrl: 'https://frontend-search-api.vercel.app',
    backendUrl: 'https://funnelback-proxy-dev.vercel.app/proxy',
    collection: 'seattleu~sp-search',
    profile: '_default'
  };
  
  // Session management - uses SessionService as the single source of truth
  function getSessionId() {
    try {
      // Check for SessionService first - the single source of truth
      if (window.SessionService) {
        const sessionId = window.SessionService.getSessionId();
        console.log('Using SessionService for session ID:', sessionId);
        return sessionId;
      } else {
        console.warn('SessionService not found - analytics tracking will be limited');
        return null;
      }
    } catch (error) {
      console.error('Error accessing SessionService:', error);
      return null;
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
    
    // Get session ID from SessionService
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
        
        // Fetch suggestions
        fetchSuggestions(query, suggestionsContainer, sessionId);
      }, 200);
      
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
        
        // Fetch suggestions
        fetchSuggestions(query, suggestionsContainer, sessionId, true);
      }, 200);
      
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
      
      // Perform search
      performSearch(query, resultsContainer, sessionId);
    }
  }
  
  // Fetch suggestions from API
  async function fetchSuggestions(query, container, sessionId, isPage = false) {
    try {

      container.hidden = false;
      
      // Construct URL with parameters
      let url = `${config.apiBaseUrl}/api/suggestions?query=${encodeURIComponent(query)}`;
      
      // Only add sessionId if it's available
      if (sessionId) {
        url += `&sessionId=${sessionId}`;
      }
      
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
    
    // Add click handlers
    container.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', function() {
        const text = this.querySelector('.suggestion-text').textContent;
        
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
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  container.hidden = false;
  
  // Add click handlers
  container.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', function(e) {
      const text = this.querySelector('.suggestion-text').textContent;
      const type = this.dataset.type;
      const url = this.dataset.url;
      
      // Find the search input and set value
      const searchInput = document.getElementById('autocomplete-concierge-inputField');
      if (searchInput) {
        searchInput.value = text;
      }
      
      // Track click
      trackSuggestionClick(text, type, url, sessionId);
      
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
    
    // Construct URL with parameters
    let url = `${config.apiBaseUrl}/api/search?query=${encodeURIComponent(query)}&collection=${config.collection}&profile=${config.profile}`;
    
    // Only add sessionId if it's available
    if (sessionId) {
      url += `&sessionId=${sessionId}`;
    }
    
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
  }
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
    // Prepare data
    const data = {
      originalQuery: text,
      clickedUrl: url || '',
      clickedTitle: text,
      clickType: type || 'suggestion',
      timestamp: new Date().toISOString()
    };
    
    // Only add sessionId if it's available
    if (sessionId) {
      data.sessionId = sessionId;
    }
    
    // Use sendBeacon if available for non-blocking operation
    const endpoint = `${config.apiBaseUrl}/api/enhance`;
    
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ type: 'click', ...data })], {
        type: 'application/json'
      });
      navigator.sendBeacon(endpoint, blob);
    } else {
      // Fallback to fetch
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'click', ...data }),
        keepalive: true
      }).catch(err => console.error('Error tracking suggestion click:', err));
    }
  } catch (error) {
    console.error('Error tracking suggestion click:', error);
  }
}

// Track result click for analytics
function trackResultClick(query, url, title, position, sessionId) {
  try {
    // Prepare data
    const data = {
      originalQuery: query,
      clickedUrl: url,
      clickedTitle: title,
      clickPosition: position,
      timestamp: new Date().toISOString()
    };
    
    // Only add sessionId if it's available
    if (sessionId) {
      data.sessionId = sessionId;
    }
    
    // Use sendBeacon if available for non-blocking operation
    const endpoint = `${config.apiBaseUrl}/api/enhance`;
    
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ type: 'click', ...data })], {
        type: 'application/json'
      });
      navigator.sendBeacon(endpoint, blob);
    } else {
      // Fallback to fetch
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'click', ...data }),
        keepalive: true
      }).catch(err => console.error('Error tracking result click:', err));
    }
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

// Initialize search when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSearch);
} else {
  initializeSearch();
}
})();