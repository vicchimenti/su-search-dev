/**
 * @fileoverview Enhanced search page autocomplete functionality
 * 
 * This implementation provides a three-column layout for search suggestions
 * on the search results page, with support for general suggestions,
 * staff/faculty profiles, and academic programs.
 *
 * @author Victor Chimenti
 * @version 1.0.4
 * @lastModified 2025-04-06
 */

// Enhanced fetch suggestions function with better error handling and SessionService integration
async function fetchSuggestions(query, container, sessionId, isResultsPage = true) {
  console.log('Fetching suggestions for:', query);
  
  if (!query || !container) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }
  
  try {
    // Get API URL from global config or use default
    const apiBaseUrl = window.seattleUConfig?.search?.apiBaseUrl || 
                       'https://su-search-dev.vercel.app';
    
    // Build base URL with parameters
    let url = `${apiBaseUrl}/api/suggestions?query=${encodeURIComponent(query)}`;
    
    // Use SessionService if available, otherwise fall back to the provided sessionId
    if (window.SessionService) {
      // Let SessionService normalize the URL with correct session ID
      url = window.SessionService.normalizeUrl(url);
      console.log('Using SessionService for URL normalization');
    } else if (sessionId) {
      // Fall back to manually adding session ID if provided
      url += `&sessionId=${sessionId}`;
    }
    
    console.log('Fetching suggestions from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    // Get JSON response
    const data = await response.json();
    console.log('Received suggestion data:', data);
    
    // Render suggestions
    renderResultsPageSuggestions(data, container, query, sessionId);
  } catch (error) {
    console.error('Suggestions fetch error:', error);
    container.innerHTML = '';
    container.hidden = true;
  }
}

// Function to render the results page suggestions (3-column layout)
function renderResultsPageSuggestions(data, container, query, sessionId) {
  console.log('Rendering results page suggestions:', data);
  
  // Extract and process data
  const general = data.general || [];
  const staff = data.staff || [];
  const programs = data.programs || {};
  
  // Handle different formats for program data
  const programResults = Array.isArray(programs) ? programs : 
                        (programs.programs || []);
  
  // Check if we have any suggestions to display
  if (general.length === 0 && staff.length === 0 && programResults.length === 0) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }
  
  // Build HTML for the three-column layout
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
                      ${person.affiliation ? `<span class="staff-role">${person.affiliation}</span>` : ''}
                      ${person.department ? `<span class="staff-department">${person.department}</span>` : ''}
                      ${person.college ? `<span class="staff-department">${person.college}</span>` : ''}
                    </div>
                  </div>
                </a>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${programResults.length > 0 ? `
          <div class="suggestions-column">
            <div class="column-header">Programs</div>
            ${programResults.map((program, index) => `
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
  
  // Update the DOM
  container.innerHTML = html;
  container.hidden = false;
  
  // Add click handlers for all suggestion items
  const attachClickHandlers = () => {
    container.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', function(e) {
        const text = this.querySelector('.suggestion-text').textContent;
        const type = this.dataset.type;
        const url = this.dataset.url;
        
        // Get additional details for tracking
        let title = text;
        if (type === 'staff') {
          const roleElement = this.querySelector('.staff-role');
          const deptElement = this.querySelector('.staff-department');
          if (roleElement) {
            title = `${text} (${roleElement.textContent})`;
          }
        } else if (type === 'program') {
          const typeElement = this.querySelector('.suggestion-type');
          if (typeElement) {
            title = `${text} - ${typeElement.textContent}`;
          }
        }
        
        console.log('Suggestion clicked:', { type, text, title, url });
        
        // Find the search input and set its value
        const searchInput = document.getElementById('autocomplete-concierge-inputField');
        if (searchInput) {
          searchInput.value = text;
        }
        
        // Track click for analytics
        trackSuggestionClick(text, type, url, title, sessionId);
        
        // Handle staff and program items with URLs
        if ((type === 'staff' || type === 'program') && url && url !== '#') {
          // If click was on a link, let it handle navigation
          if (e.target.closest('a')) {
            // Trigger a background search after letting the link handle navigation
            setTimeout(() => {
              const resultsContainer = document.getElementById('results');
              if (resultsContainer) {
                performSearch(text, resultsContainer, sessionId);
              }
              updateUrl(text);
            }, 100);
            return; // Allow default navigation
          }
          
          // Otherwise open in new tab and continue with search
          window.open(url, '_blank', 'noopener,noreferrer');
        }
        
        // Hide suggestions
        container.innerHTML = '';
        container.hidden = true;
        
        // Perform search and update URL
        const resultsContainer = document.getElementById('results');
        if (resultsContainer) {
          performSearch(text, resultsContainer, sessionId);
        }
        updateUrl(text);
      });
    });
  };
  
  attachClickHandlers();

  // Add keyboard navigation support
  addKeyboardNavigation(container);
}

// Track suggestion click for analytics
function trackSuggestionClick(text, type, url, title, sessionId) {
  try {
    // Use SessionService if available
    if (window.SessionService) {
      // Prepare data with session ID from service
      const data = {
        type: 'click',
        originalQuery: text,
        clickedUrl: url || '',
        clickedTitle: title || text,
        clickType: type || 'suggestion',
        timestamp: new Date().toISOString()
      };
      
      // Let SessionService add the session ID correctly
      const dataWithSession = window.SessionService.addSessionIdToData(data);
      
      // Get the API endpoint from global config
      const apiBaseUrl = window.seattleUConfig?.search?.apiBaseUrl || 
                        'https://su-search-dev.vercel.app';
      const endpoint = `${apiBaseUrl}/api/enhance`;
      
      console.log('Tracking suggestion click with SessionService:', dataWithSession);
      
      // Use sendBeacon if available for non-blocking operation
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(dataWithSession)], {
          type: 'application/json'
        });
        navigator.sendBeacon(endpoint, blob);
      } else {
        // Fallback to fetch with keepalive
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataWithSession),
          keepalive: true
        }).catch(err => console.error('Error tracking suggestion click:', err));
      }
    } else {
      // Fall back to original implementation
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
      
      // Get the API endpoint from global config
      const apiBaseUrl = window.seattleUConfig?.search?.apiBaseUrl || 
                        'https://su-search-dev.vercel.app';
      const endpoint = `${apiBaseUrl}/api/enhance`;
      
      console.log('Tracking suggestion click (legacy):', data);
      
      // Use sendBeacon if available for non-blocking operation
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
    }
  } catch (error) {
    console.error('Error tracking suggestion click:', error);
  }
}

// Add keyboard navigation support for suggestions
function addKeyboardNavigation(container) {
  // Store the current active item
  let activeItem = null;
  let activeColumn = null;
  
  // Get all columns
  const columns = container.querySelectorAll('.suggestions-column');
  
  // Handle keyboard events for the search input
  const searchInput = document.getElementById('autocomplete-concierge-inputField');
  if (!searchInput) return;
  
  // Remove any existing listeners to prevent duplicates
  const oldListener = searchInput._keydownListener;
  if (oldListener) {
    searchInput.removeEventListener('keydown', oldListener);
  }
  
  // Create and add new listener
  const keydownListener = function(e) {
    // Only handle navigation keys
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
      return;
    }
    
    // Check if suggestions are visible
    if (container.hidden || container.querySelector('.suggestions-item') === null) {
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        navigateDown();
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateUp();
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateRight();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigateLeft();
        break;
      case 'Enter':
        if (activeItem) {
          e.preventDefault();
          activeItem.click();
        }
        break;
      case 'Escape':
        e.preventDefault();
        container.innerHTML = '';
        container.hidden = true;
        searchInput.blur();
        break;
    }
  };
  
  searchInput._keydownListener = keydownListener;
  searchInput.addEventListener('keydown', keydownListener);
  
  // Navigation functions
  function navigateDown() {
    if (!activeItem) {
      // Select first item in first column with items
      for (const column of columns) {
        const items = column.querySelectorAll('.suggestion-item');
        if (items.length > 0) {
          activeItem = items[0];
          activeColumn = column;
          activeItem.classList.add('active');
          break;
        }
      }
    } else {
      // Move down in current column
      const items = activeColumn.querySelectorAll('.suggestion-item');
      const currentIndex = Array.from(items).indexOf(activeItem);
      
      if (currentIndex < items.length - 1) {
        activeItem.classList.remove('active');
        activeItem = items[currentIndex + 1];
        activeItem.classList.add('active');
      }
    }
    
    // Ensure active item is visible
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  
  function navigateUp() {
    if (activeItem) {
      const items = activeColumn.querySelectorAll('.suggestion-item');
      const currentIndex = Array.from(items).indexOf(activeItem);
      
      if (currentIndex > 0) {
        activeItem.classList.remove('active');
        activeItem = items[currentIndex - 1];
        activeItem.classList.add('active');
      }
    }
    
    // Ensure active item is visible
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  
  function navigateRight() {
    if (!activeItem) return;
    
    const columnIndex = Array.from(columns).indexOf(activeColumn);
    if (columnIndex < columns.length - 1) {
      // Find next column with items
      for (let i = columnIndex + 1; i < columns.length; i++) {
        const nextColumn = columns[i];
        const items = nextColumn.querySelectorAll('.suggestion-item');
        
        if (items.length > 0) {
          activeItem.classList.remove('active');
          
          // Try to maintain similar position in new column
          const currentItems = activeColumn.querySelectorAll('.suggestion-item');
          const currentIndex = Array.from(currentItems).indexOf(activeItem);
          const ratio = currentIndex / (currentItems.length - 1 || 1);
          const targetIndex = Math.min(Math.round(ratio * (items.length - 1)), items.length - 1);
          
          activeItem = items[targetIndex];
          activeColumn = nextColumn;
          activeItem.classList.add('active');
          
          // Ensure active item is visible
          activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          break;
        }
      }
    }
  }
  
  function navigateLeft() {
    if (!activeItem) return;
    
    const columnIndex = Array.from(columns).indexOf(activeColumn);
    if (columnIndex > 0) {
      // Find previous column with items
      for (let i = columnIndex - 1; i >= 0; i--) {
        const prevColumn = columns[i];
        const items = prevColumn.querySelectorAll('.suggestion-item');
        
        if (items.length > 0) {
          activeItem.classList.remove('active');
          
          // Try to maintain similar position in new column
          const currentItems = activeColumn.querySelectorAll('.suggestion-item');
          const currentIndex = Array.from(currentItems).indexOf(activeItem);
          const ratio = currentIndex / (currentItems.length - 1 || 1);
          const targetIndex = Math.min(Math.round(ratio * (items.length - 1)), items.length - 1);
          
          activeItem = items[targetIndex];
          activeColumn = prevColumn;
          activeItem.classList.add('active');
          
          // Ensure active item is visible
          activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          break;
        }
      }
    }
  }
}

// Helper functions from the integration.js file

// Perform search via API
async function performSearch(query, container, sessionId) {
  console.log('Performing search for:', query);
  
  try {
    // Get API URL from global config or use default
    const apiBaseUrl = window.seattleUConfig?.search?.apiBaseUrl || 
                      'https://su-search-dev.vercel.app';
    const collection = window.seattleUConfig?.search?.collection || 
                      'seattleu~sp-search';
    const profile = window.seattleUConfig?.search?.profile || 
                   '_default';
    
    // Build base URL with parameters
    let url = `${apiBaseUrl}/api/search?query=${encodeURIComponent(query)}&collection=${collection}&profile=${profile}`;
    
    // Use SessionService if available, otherwise fall back to provided sessionId
    if (window.SessionService) {
      url = window.SessionService.normalizeUrl(url);
      console.log('Using SessionService for search URL normalization');
    } else if (sessionId) {
      url += `&sessionId=${sessionId}`;
    }
    
    console.log('Fetching search results from:', url);
    
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
    console.error('Search error:', error);
    container.innerHTML = `
      <div class="search-error">
        <h3>Error Loading Results</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Update URL without page reload
function updateUrl(query) {
  if (!window.history?.pushState) return;
  
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

// Attach click handlers to search results for tracking
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

// Track result click via API
function trackResultClick(query, url, title, position, sessionId) {
  try {
    // Use SessionService if available
    if (window.SessionService) {
      // Prepare data
      const data = {
        type: 'click',
        originalQuery: query,
        clickedUrl: url,
        clickedTitle: title,
        clickPosition: position,
        timestamp: new Date().toISOString()
      };
      
      // Let SessionService add the session ID correctly
      const dataWithSession = window.SessionService.addSessionIdToData(data);
      
      // Get the API endpoint
      const apiBaseUrl = window.seattleUConfig?.search?.apiBaseUrl || 
                        'https://su-search-dev.vercel.app';
      const endpoint = `${apiBaseUrl}/api/enhance`;
      
      console.log('Tracking result click with SessionService:', dataWithSession);
      
      // Use sendBeacon if available for non-blocking operation
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(dataWithSession)], {
          type: 'application/json'
        });
        navigator.sendBeacon(endpoint, blob);
      } else {
        // Fallback to fetch with keepalive
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataWithSession),
          keepalive: true
        }).catch(err => console.error('Error tracking click:', err));
      }
    } else {
      // Fall back to original implementation
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
      
      // Get API URL from global config or use default
      const apiBaseUrl = window.seattleUConfig?.search?.apiBaseUrl || 
                        'https://su-search-dev.vercel.app';
      const endpoint = `${apiBaseUrl}/api/enhance`;
      
      console.log('Tracking result click (legacy):', data);
      
      // Use sendBeacon if available for non-blocking operation
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
    }
  } catch (error) {
    console.error('Error tracking click:', error);
  }
}

// Initialize search suggestions on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing search page autocomplete');
  
  // Find the search input and suggestions container
  const searchInput = document.getElementById('autocomplete-concierge-inputField');
  const suggestionsContainer = document.getElementById('autocomplete-suggestions');
  
  if (!searchInput || !suggestionsContainer) {
    console.log('Search input or suggestions container not found');
    return;
  }
  
  // Get session ID - prefer SessionService if available
  const sessionId = window.SessionService ? 
                   window.SessionService.getSessionId() : 
                   getOrCreateSessionId();
  
  // Set up debounced input handler
  const debounceTime = window.seattleUConfig?.search?.debounceTime || 200;
  const minQueryLength = window.seattleUConfig?.search?.minQueryLength || 3;
  
  const handleInput = debounce(function() {
    const query = searchInput.value.trim();
    
    if (query.length < minQueryLength) {
      suggestionsContainer.innerHTML = '';
      suggestionsContainer.hidden = true;
      return;
    }
    
    fetchSuggestions(query, suggestionsContainer, sessionId, true);
  }, debounceTime);
  
  // Add input handler
  searchInput.addEventListener('input', handleInput);
  
  // Handle clicks outside
  document.addEventListener('click', function(e) {
    if (suggestionsContainer &&
        !searchInput.contains(e.target) &&
        !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.innerHTML = '';
      suggestionsContainer.hidden = true;
    }
  });
  
  console.log('Search page autocomplete initialized');
});

// Helper to get or create a session ID
// Note: This is kept for backward compatibility, but SessionService is preferred
function getOrCreateSessionId() {
  try {
    let sessionId = sessionStorage.getItem('searchSessionId');
    
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('searchSessionId', sessionId);
    }
    
    return sessionId;
  } catch (e) {
    // Fallback if sessionStorage is unavailable
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }
}

// Debounce function to limit execution frequency
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}