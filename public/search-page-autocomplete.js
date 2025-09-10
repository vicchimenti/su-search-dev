/**
 * @fileoverview Enhanced search page autocomplete functionality with smart pre-rendering
 *
 * This implementation provides a three-column layout for search suggestions
 * on the search results page, with support for general suggestions,
 * staff/faculty profiles, and academic programs. Enhanced with smart pre-rendering
 * for near-instantaneous search results when available.
 *
 * Key Features:
 * - Smart pre-rendering with <50ms result display when cache hits
 * - Three-column suggestion layout (general, staff, programs)
 * - Cache-first optimization for improved performance
 * - SessionService integration for analytics continuity
 * - Graceful fallback to standard search when pre-rendering unavailable
 * - Comprehensive click tracking and analytics
 * - Keyboard navigation support for suggestions
 *
 * Performance Optimization:
 * - Pre-rendered content displays instantly when available
 * - Cache monitoring and metrics tracking
 * - Optimized search flow with multiple fallback layers
 * - Non-blocking background operations
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 3.0.2
 * @lastModified 2025-09-10
 */

// Create a module-level session handler that serves as the single source of truth within this file
const SessionManager = {
  // The cached session ID
  _sessionId: null,

  // Flag to track if we've tried to initialize
  _initialized: false,

  // Initialize the session ID from SessionService
  init() {
    if (this._initialized) return;

    try {
      if (window.SessionService) {
        this._sessionId = window.SessionService.getSessionId();
      } else {
        this._sessionId = null;
      }
    } catch (error) {
      this._sessionId = null;
    }

    this._initialized = true;
  },

  // Get the current session ID, refreshing from SessionService if needed
  getSessionId() {
    // Initialize if not already done
    if (!this._initialized) {
      this.init();
    }

    // Refresh from SessionService each time to ensure consistency
    try {
      if (window.SessionService) {
        this._sessionId = window.SessionService.getSessionId();
      }
    } catch (error) {
      // Keep the existing session ID if there's an error
    }

    return this._sessionId;
  },
};

// Cache monitoring for tracking metrics
const CacheMonitor = {
  // Simple metrics
  metrics: {
    cacheChecks: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheErrors: 0,
    totalSearches: 0,
    fastPathSearches: 0,
    preRenderHits: 0,
    preRenderMisses: 0
  },

  // Reset metrics
  reset() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = 0;
    });
  },

  // Log a cache check
  logCacheCheck(result) {
    this.metrics.cacheChecks++;

    if (result === 'hit') {
      this.metrics.cacheHits++;
    } else if (result === 'miss') {
      this.metrics.cacheMisses++;
    } else if (result === 'error') {
      this.metrics.cacheErrors++;
    }
  },

  // Log a pre-render result
  logPreRenderResult(result) {
    if (result === 'hit') {
      this.metrics.preRenderHits++;
    } else if (result === 'miss') {
      this.metrics.preRenderMisses++;
    }
  },

  // Log a search
  logSearch(wasFastPath) {
    this.metrics.totalSearches++;

    if (wasFastPath) {
      this.metrics.fastPathSearches++;
    }
  },

  // Get cache hit rate
  getCacheHitRate() {
    if (this.metrics.cacheChecks === 0) return 0;
    return (this.metrics.cacheHits / this.metrics.cacheChecks) * 100;
  },

  // Get pre-render hit rate
  getPreRenderHitRate() {
    const total = this.metrics.preRenderHits + this.metrics.preRenderMisses;
    if (total === 0) return 0;
    return (this.metrics.preRenderHits / total) * 100;
  },

  // Get fast path rate
  getFastPathRate() {
    if (this.metrics.totalSearches === 0) return 0;
    return (this.metrics.fastPathSearches / this.metrics.totalSearches) * 100;
  },

  // Get metrics as formatted object
  getMetricsReport() {
    return {
      ...this.metrics,
      cacheHitRate: `${this.getCacheHitRate().toFixed(1)}%`,
      preRenderHitRate: `${this.getPreRenderHitRate().toFixed(1)}%`,
      fastPathRate: `${this.getFastPathRate().toFixed(1)}%`
    };
  }
};

/**
 * Check for pre-rendered content in cache
 * This function checks if search results were pre-rendered and cached
 * during the header form submission, enabling instant result display.
 * 
 * @param {string} query - The search query to check for
 * @returns {Promise<string|null>} Promise resolving to cached HTML or null if not found
 */
async function checkForPreRenderedContent(query) {
  if (!query || typeof query !== 'string') {
    return null;
  }

  try {
    // Get session ID from SessionManager for consistency
    const sessionId = SessionManager.getSessionId();

    // Get API URL from global config or use default
    const apiBaseUrl = window.seattleUConfig?.search?.apiBaseUrl || "https://su-search-dev.vercel.app";

    // Prepare parameters for cache check
    const params = new URLSearchParams({
      query: query.trim(),
      collection: 'seattleu~sp-search',
      profile: '_default',
      prerendered: 'true' // Signal that we're looking for pre-rendered content
    });

    // Only add session ID if it's available
    if (sessionId) {
      params.append('sessionId', sessionId);
    }

    console.log(`[PRE-RENDER-CHECK] Checking for cached results: "${query}"`);

    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout for cache check

    try {
      // Check cache via existing search API
      const url = `${apiBaseUrl}/api/search?${params}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html'
        }
      });

      // Clear timeout since we got a response
      clearTimeout(timeoutId);

      // Check if we got pre-rendered content from cache
      const cacheStatus = response.headers.get('X-Cache-Status');
      
      if (response.ok && cacheStatus === 'HIT') {
        const html = await response.text();
        console.log(`[PRE-RENDER-CHECK] Cache HIT for "${query}"`);
        CacheMonitor.logPreRenderResult('hit');
        return html;
      } else {
        console.log(`[PRE-RENDER-CHECK] Cache MISS for "${query}" (status: ${cacheStatus || 'unknown'})`);
        CacheMonitor.logPreRenderResult('miss');
        return null;
      }
    } catch (fetchError) {
      // Clear timeout if we had an error
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (fetchError.name === 'AbortError') {
        console.log(`[PRE-RENDER-CHECK] Timeout checking cache for "${query}"`);
      } else {
        console.log(`[PRE-RENDER-CHECK] Error checking cache for "${query}":`, fetchError.message);
      }

      CacheMonitor.logPreRenderResult('miss');
      return null;
    }
  } catch (error) {
    console.log(`[PRE-RENDER-CHECK] Exception checking for pre-rendered content:`, error.message);
    CacheMonitor.logPreRenderResult('miss');
    return null;
  }
}

/**
 * Display pre-rendered search results instantly
 * This function takes cached HTML content and displays it immediately,
 * then ensures all existing functionality (analytics, click handlers, etc.) 
 * is properly initialized.
 * 
 * @param {string} html - The pre-rendered HTML content to display
 * @param {string} query - The search query for analytics and tracking
 */
function displayPreRenderedResults(html, query) {
  if (!html || typeof html !== 'string') {
    console.error('[PRE-RENDER-DISPLAY] Invalid HTML provided');
    return false;
  }

  try {
    // Get results container
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) {
      console.error('[PRE-RENDER-DISPLAY] Results container not found');
      return false;
    }

    // Calculate display time
    const startTime = Date.now();

    // Display the pre-rendered content immediately
    resultsContainer.innerHTML = `
      <div id="funnelback-search-container-response" class="funnelback-search-container">
        ${html}
        <div class="search-performance-info" style="font-size: 12px; color: #666; margin-top: 10px; text-align: right;">
          Pre-rendered results displayed in ${Date.now() - startTime}ms
        </div>
      </div>
    `;

    // Attach click handlers for analytics tracking
    attachResultClickHandlers(resultsContainer, query);

    // Notify SearchManager about the new content if available
    if (window.SearchManager && typeof window.SearchManager.updateResults === 'function') {
      window.SearchManager.updateResults(html);
    }

    // Scroll to results if not in viewport AND page is not already at the top
    if (!isElementInViewport(resultsContainer) && window.scrollY > 0) {
      resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    console.log(`[PRE-RENDER-DISPLAY] Pre-rendered results displayed for "${query}"`);
    return true;

  } catch (error) {
    console.error('[PRE-RENDER-DISPLAY] Error displaying pre-rendered results:', error);
    return false;
  }
}

// Function to render the results page suggestions (3-column layout)
function renderResultsPageSuggestions(data, container, query) {
  // Extract and process data
  const general = data.general || [];
  const staff = data.staff || [];
  const programs = data.programs || {};

  // Handle different formats for program data
  const programResults = Array.isArray(programs)
    ? programs
    : programs.programs || [];

  // Check if we have any suggestions to display
  if (
    general.length === 0 &&
    staff.length === 0 &&
    programResults.length === 0
  ) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  // Build HTML for the three-column layout
  let html = `
    <div class="suggestions-list">
      <div class="suggestions-columns">
        ${general.length > 0
      ? `
          <div class="suggestions-column">
            <div class="column-header">Suggestions</div>
            ${general
        .map((suggestion, index) => {
          const display = suggestion.display || suggestion;
          return `
                <div class="suggestion-item" role="option" data-index="${index}" data-type="general">
                  <span class="suggestion-text">${display}</span>
                </div>
              `;
        })
        .join("")}
          </div>
        `
      : ""
    }
        
        ${staff.length > 0
      ? `
          <div class="suggestions-column">
            <div class="column-header">Faculty & Staff</div>
            ${staff
        .map(
          (person, index) => `
              <div class="suggestion-item staff-item" role="option" data-index="${index}" data-type="staff" data-url="${person.url || "#"
            }">
                <a href="${person.url || "#"
            }" class="staff-link" target="_blank" rel="noopener noreferrer">
                  <div class="staff-suggestion">
                    ${person.image
              ? `
                      <div class="staff-image">
                        <img src="${person.image}" alt="${person.title || ""
              }" class="staff-thumbnail" loading="lazy">
                      </div>
                    `
              : ""
            }
                    <div class="staff-info">
                      <span class="suggestion-text">${person.title || ""}</span>
                      ${person.position
              ? `<span class="staff-role">${person.position}</span>`
              : ""
            }
                      ${person.affiliation
              ? `<span class="staff-role">${person.affiliation}</span>`
              : ""
            }
                      ${person.department
              ? `<span class="staff-department">${person.department}</span>`
              : ""
            }
                      ${person.college
              ? `<span class="staff-department">${person.college}</span>`
              : ""
            }
                    </div>
                  </div>
                </a>
              </div>
            `
        )
        .join("")}
          </div>
        `
      : ""
    }
        
        ${programResults.length > 0
      ? `
          <div class="suggestions-column">
            <div class="column-header">Programs</div>
            ${programResults
        .map(
          (program, index) => `
              <div class="suggestion-item program-item" role="option" data-index="${index}" data-type="program" data-url="${program.url || "#"
            }">
                <a href="${program.url || "#"
            }" class="program-link" target="_blank" rel="noopener noreferrer">
                  <div class="program-suggestion">
                    <span class="suggestion-text">${program.title || ""}</span>
                    ${program.details?.school
              ? `<span class="suggestion-type">${program.details.school}</span>`
              : ""
            }
                    ${program.description
              ? `<span class="program-description">${program.description}</span>`
              : ""
            }
                  </div>
                </a>
              </div>
            `
        )
        .join("")}
          </div>
        `
      : ""
    }
      </div>
    </div>
  `;

  // Update the DOM
  container.innerHTML = html;
  container.hidden = false;

  // Add click handlers for all suggestion items
  const attachClickHandlers = () => {
    container.querySelectorAll(".suggestion-item").forEach((item) => {
      item.addEventListener("click", function (e) {
        const text = this.querySelector(".suggestion-text").textContent;
        const type = this.dataset.type;
        const url = this.dataset.url;

        // Get additional details for tracking
        let title = text;
        if (type === "staff") {
          const roleElement = this.querySelector(".staff-role");
          const deptElement = this.querySelector(".staff-department");
          if (roleElement) {
            title = `${text} (${roleElement.textContent})`;
          }
        } else if (type === "program") {
          const typeElement = this.querySelector(".suggestion-type");
          if (typeElement) {
            title = `${text} - ${typeElement.textContent}`;
          }
        }

        // Find the search input and set its value
        const searchInput = document.getElementById(
          "autocomplete-concierge-inputField"
        );
        if (searchInput) {
          searchInput.value = text;
        }

        // Track click for analytics (using SessionManager)
        trackSuggestionClick(text, type, url, title);

        // Hide suggestions
        container.innerHTML = "";
        container.hidden = true;

        // Handle staff and program items with URLs
        if ((type === "staff" || type === "program") && url && url !== "#") {
          // If click was on a link, let it handle navigation
          if (e.target.closest("a")) {
            // Trigger a background search after letting the link handle navigation
            setTimeout(() => {
              const resultsContainer = document.getElementById("results");
              if (resultsContainer) {
                performSearch(text, resultsContainer);
              }
              updateUrl(text);
            }, 100);
            return; // Allow default navigation
          }

          // Otherwise open in new tab and continue with search
          window.open(url, "_blank", "noopener,noreferrer");
        }

        // Perform search and update URL
        const resultsContainer = document.getElementById("results");
        if (resultsContainer) {
          performSearch(text, resultsContainer);
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
function trackSuggestionClick(text, type, url, title) {
  try {
    // Get session ID from SessionManager
    const sessionId = SessionManager.getSessionId();

    // Prepare data for the API call
    const data = {
      originalQuery: text,
      clickedUrl: url || "",
      clickedTitle: title || text,
      clickType: type || "suggestion",
      clickPosition: -1, // -1 for suggestions as they're not in the results list
      timestamp: new Date().toISOString(),
    };

    // Only add sessionId if it's available
    if (sessionId) {
      data.sessionId = sessionId;
    }

    // Get the API endpoint from global config or use default
    const apiBaseUrl =
      window.seattleUConfig?.search?.proxyBaseUrl ||
      "https://funnelback-proxy-dev.vercel.app/proxy";
    const endpoint = `${apiBaseUrl}/analytics/click`;

    // Use sendBeacon if available for non-blocking operation
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
      });
      navigator.sendBeacon(endpoint, blob);
    } else {
      // Fallback to fetch with keepalive
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        keepalive: true,
      }).catch(() => {
        // Silent error handling
      });
    }
  } catch (error) {
    // Silent error handling
  }
}

// Enhanced fetch suggestions function
async function fetchSuggestions(query, container, isResultsPage = true) {
  try {
    // Get session ID from SessionManager
    const sessionId = SessionManager.getSessionId();

    // Get API URL from global config or use default
    const apiBaseUrl =
      window.seattleUConfig?.search?.apiBaseUrl ||
      "https://su-search-dev.vercel.app";

    // Prepare URL with parameters
    const params = new URLSearchParams({ query });

    // Only add session ID if it's available
    if (sessionId) {
      params.append("sessionId", sessionId);
    }

    // Fetch suggestions from API
    const url = `${apiBaseUrl}/api/suggestions?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    // Get JSON response
    const data = await response.json();

    // Render suggestions
    renderResultsPageSuggestions(data, container, query);
  } catch (error) {
    container.innerHTML = "";
    container.hidden = true;
    // Continue with normal operation despite fetch failure
  }
}

// Perform search via API with pre-render awareness
async function performSearch(query, container) {
  try {
    // Set container to loading state
    setLoadingState(container, true);
    const startTime = Date.now();
    let usedPreRender = false;

    // Get session ID from SessionManager
    const sessionId = SessionManager.getSessionId();

    // Get API URL from global config or use default
    const apiBaseUrl =
      window.seattleUConfig?.search?.apiBaseUrl ||
      "https://su-search-dev.vercel.app";
    const collection =
      window.seattleUConfig?.search?.collection || "seattleu~sp-search";
    const profile = window.seattleUConfig?.search?.profile || "_default";

    // Prepare URL with parameters
    const params = new URLSearchParams({
      query,
      collection,
      profile,
    });

    // Only add session ID if it's available
    if (sessionId) {
      params.append("sessionId", sessionId);
    }

    // Fetch results from API
    const url = `${apiBaseUrl}/api/search?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    // Check if this was served from cache (could be pre-rendered content)
    const cacheStatus = response.headers.get('X-Cache-Status');
    if (cacheStatus === 'HIT') {
      usedPreRender = true;
    }

    // Get HTML response
    const html = await response.text();

    // Calculate total time
    const totalTime = Date.now() - startTime;
    console.log(`Search completed in ${totalTime}ms for "${query}"${cacheStatus ? ` (Cache: ${cacheStatus})` : ''}`);

    // Update results container
    container.innerHTML = `
      <div id="funnelback-search-container-response" class="funnelback-search-container">
        ${html}
      </div>
    `;

    // Attach click handlers for tracking
    attachResultClickHandlers(container, query);

    // Scroll to results if not in viewport AND page is not already at the top
    if (!isElementInViewport(container) && window.scrollY > 0) {
      container.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Log search to metrics
    CacheMonitor.logSearch(usedPreRender);

    // Clear loading state
    setLoadingState(container, false);
  } catch (error) {
    // Clear loading state
    setLoadingState(container, false);

    container.innerHTML = `
      <div class="search-error">
        <h3>Error Loading Results</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Set loading state for the container
function setLoadingState(container, isLoading) {
  if (isLoading) {
    // Add loading indicator if not exists
    if (!container.querySelector('.results-loading')) {
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'results-loading';
      loadingIndicator.innerHTML = `
        <div class="spinner"></div>
        <p>Loading search results...</p>
      `;
      container.appendChild(loadingIndicator);
    }
    container.classList.add('loading');
  } else {
    // Remove loading indicators
    const loadingIndicator = container.querySelector('.results-loading');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
    container.classList.remove('loading');
  }
}

// Update URL without page reload
function updateUrl(query) {
  if (!window.history?.pushState) return;

  const url = new URL(window.location);
  url.searchParams.set("query", query);
  window.history.pushState({}, "", url);
}

// Check if element is in viewport
function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
    (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// Attach click handlers to search results for tracking
function attachResultClickHandlers(container, query) {
  // Find all result links
  const resultLinks = container.querySelectorAll(
    ".fb-result h3 a, .search-result-item h3 a, .listing-item__title a"
  );

  resultLinks.forEach((link, index) => {
    link.addEventListener("click", function (e) {
      // Don't prevent default navigation

      // Get link details
      const url =
        link.getAttribute("data-live-url") || link.getAttribute("href") || "";
      const title = link.textContent.trim() || "";

      // Track click
      trackResultClick(query, url, title, index + 1);
    });
  });
}

// Track result click via API
function trackResultClick(query, url, title, position) {
  try {
    // Get session ID from SessionManager
    const sessionId = SessionManager.getSessionId();

    // Prepare data
    const data = {
      originalQuery: query,
      clickedUrl: url,
      clickedTitle: title,
      clickPosition: position,
      clickType: "search",
      timestamp: new Date().toISOString(),
    };

    // Only add sessionId if it's available
    if (sessionId) {
      data.sessionId = sessionId;
    }

    // Get API endpoint from global config or use default
    const apiBaseUrl =
      window.seattleUConfig?.search?.proxyBaseUrl ||
      "https://funnelback-proxy-dev.vercel.app/proxy";
    const endpoint = `${apiBaseUrl}/analytics/click`;

    // Use sendBeacon if available for non-blocking operation
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
      });
      navigator.sendBeacon(endpoint, blob);
    } else {
      // Fallback to fetch with keepalive
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        keepalive: true,
      }).catch(() => {
        // Silent error handling
      });
    }
  } catch (error) {
    // Silent error handling
  }
}

// Add keyboard navigation support for suggestions
function addKeyboardNavigation(container) {
  // Store the current active item
  let activeItem = null;
  let activeColumn = null;

  // Get all columns
  const columns = container.querySelectorAll(".suggestions-column");

  // Handle keyboard events for the search input
  const searchInput = document.getElementById(
    "autocomplete-concierge-inputField"
  );
  if (!searchInput) return;

  // Remove any existing listeners to prevent duplicates
  const oldListener = searchInput._keydownListener;
  if (oldListener) {
    searchInput.removeEventListener("keydown", oldListener);
  }

  // Create and add new listener
  const keydownListener = function (e) {
    // Only handle navigation keys
    if (
      ![
        "ArrowDown",
        "ArrowUp",
        "ArrowLeft",
        "ArrowRight",
        "Enter",
        "Escape",
      ].includes(e.key)
    ) {
      return;
    }

    // Check if suggestions are visible
    if (
      container.hidden ||
      container.querySelector(".suggestions-item") === null
    ) {
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        navigateDown();
        break;
      case "ArrowUp":
        e.preventDefault();
        navigateUp();
        break;
      case "ArrowRight":
        e.preventDefault();
        navigateRight();
        break;
      case "ArrowLeft":
        e.preventDefault();
        navigateLeft();
        break;
      case "Enter":
        if (activeItem) {
          e.preventDefault();
          activeItem.click();
        }
        break;
      case "Escape":
        e.preventDefault();
        container.innerHTML = "";
        container.hidden = true;
        searchInput.blur();
        break;
    }
  };

  searchInput._keydownListener = keydownListener;
  searchInput.addEventListener("keydown", keydownListener);

  // Navigation functions
  function navigateDown() {
    if (!activeItem) {
      // Select first item in first column with items
      for (const column of columns) {
        const items = column.querySelectorAll(".suggestion-item");
        if (items.length > 0) {
          activeItem = items[0];
          activeColumn = column;
          activeItem.classList.add("active");
          break;
        }
      }
    } else {
      // Move down in current column
      const items = activeColumn.querySelectorAll(".suggestion-item");
      const currentIndex = Array.from(items).indexOf(activeItem);

      if (currentIndex < items.length - 1) {
        activeItem.classList.remove("active");
        activeItem = items[currentIndex + 1];
        activeItem.classList.add("active");
      }
    }

    // Ensure active item is visible
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function navigateUp() {
    if (activeItem) {
      const items = activeColumn.querySelectorAll(".suggestion-item");
      const currentIndex = Array.from(items).indexOf(activeItem);

      if (currentIndex > 0) {
        activeItem.classList.remove("active");
        activeItem = items[currentIndex - 1];
        activeItem.classList.add("active");
      }
    }

    // Ensure active item is visible
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function navigateRight() {
    if (!activeItem) return;

    const columnIndex = Array.from(columns).indexOf(activeColumn);
    if (columnIndex < columns.length - 1) {
      // Find next column with items
      for (let i = columnIndex + 1; i < columns.length; i++) {
        const nextColumn = columns[i];
        const items = nextColumn.querySelectorAll(".suggestion-item");

        if (items.length > 0) {
          activeItem.classList.remove("active");

          // Try to maintain similar position in new column
          const currentItems =
            activeColumn.querySelectorAll(".suggestion-item");
          const currentIndex = Array.from(currentItems).indexOf(activeItem);
          const ratio = currentIndex / (currentItems.length - 1 || 1);
          const targetIndex = Math.min(
            Math.round(ratio * (items.length - 1)),
            items.length - 1
          );

          activeItem = items[targetIndex];
          activeColumn = nextColumn;
          activeItem.classList.add("active");

          // Ensure active item is visible
          activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
        const items = prevColumn.querySelectorAll(".suggestion-item");

        if (items.length > 0) {
          activeItem.classList.remove("active");

          // Try to maintain similar position in new column
          const currentItems =
            activeColumn.querySelectorAll(".suggestion-item");
          const currentIndex = Array.from(currentItems).indexOf(activeItem);
          const ratio = currentIndex / (currentItems.length - 1 || 1);
          const targetIndex = Math.min(
            Math.round(ratio * (items.length - 1)),
            items.length - 1
          );

          activeItem = items[targetIndex];
          activeColumn = prevColumn;
          activeItem.classList.add("active");

          // Ensure active item is visible
          activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
          break;
        }
      }
    }
  }
}

// Helper for debouncing
function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Initialize search suggestions on page load with smart pre-rendering
document.addEventListener("DOMContentLoaded", function () {
  // Initialize SessionManager
  SessionManager.init();

  // Find the search input and suggestions container
  const searchInput = document.getElementById(
    "autocomplete-concierge-inputField"
  );
  const suggestionsContainer = document.getElementById(
    "autocomplete-suggestions"
  );

  if (!searchInput || !suggestionsContainer) {
    return;
  }

  // Set up debounced input handler
  const debounceTime = window.seattleUConfig?.search?.debounceTime || 200;
  const minQueryLength = window.seattleUConfig?.search?.minQueryLength || 3;

  const handleInput = debounce(function () {
    const query = searchInput.value.trim();

    if (query.length < minQueryLength) {
      suggestionsContainer.innerHTML = "";
      suggestionsContainer.hidden = true;
      return;
    }

    fetchSuggestions(query, suggestionsContainer, true);
  }, debounceTime);

  // Add input handler
  searchInput.addEventListener("input", handleInput);

  // Handle clicks outside
  document.addEventListener("click", function (e) {
    if (
      suggestionsContainer &&
      !searchInput.contains(e.target) &&
      !suggestionsContainer.contains(e.target)
    ) {
      suggestionsContainer.innerHTML = "";
      suggestionsContainer.hidden = true;
    }
  });

  // Process any URL parameters for initial search with smart pre-rendering
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get("query");

  // if (query && searchInput && document.getElementById('results')) {
  //   // Set query in input field
  //   searchInput.value = query;

  //   console.log(`[SMART-PRERENDER] Processing initial search for: "${query}"`);

  //   // NEW: Smart pre-rendering check - try to get pre-rendered content first
  //   checkForPreRenderedContent(query)
  //     .then(preRenderedHtml => {
  //       if (preRenderedHtml) {
  //         console.log(`[SMART-PRERENDER] Using pre-rendered content for: "${query}"`);
  //         // Display pre-rendered results instantly
  //         const success = displayPreRenderedResults(preRenderedHtml, query);
  //         if (success) {
  //           CacheMonitor.logSearch(true); // Log as fast path search
  //           return; // Exit early - we're done!
  //         }
  //       }
        
  //       console.log(`[SMART-PRERENDER] No pre-rendered content available, using standard search for: "${query}"`);
  //       // Fallback to existing search logic
  //       performSearch(query, document.getElementById('results'));
  //     })
  //     .catch(error => {
  //       console.log(`[SMART-PRERENDER] Error checking for pre-rendered content, using standard search:`, error.message);
  //       // Always fall back to existing search logic on any error
  //       performSearch(query, document.getElementById('results'));
  //     });
  // }
});

// Make functions available globally
// window.performSearch = performSearch;
// window.fetchSuggestions = fetchSuggestions;
// window.trackResultClick = trackResultClick;
// window.trackSuggestionClick = trackSuggestionClick;
// window.getCacheMetrics = function () {
//   return CacheMonitor.getMetricsReport();
// };

// Make pre-rendering functions available globally for debugging
window.checkForPreRenderedContent = checkForPreRenderedContent;
window.displayPreRenderedResults = displayPreRenderedResults;