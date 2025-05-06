/**
 * @fileoverview Frontend Search Integration Script
 *
 * This script integrates the frontend search API with the Seattle University website.
 * It enhances the existing search functionality by proxying requests through the new API
 * while maintaining compatibility with the current UI components.
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 2.4.0
 * @lastModified 2025-05-06
 */

(function () {
  // Configuration for the frontend API
  const config = {
    apiBaseUrl: "https://su-search-dev.vercel.app",
    proxyBaseUrl: "https://funnelback-proxy-dev.vercel.app/proxy",
    collection: "seattleu~sp-search",
    profile: "_default",
    minQueryLength: 3,
    debounceTime: 200,
    prefetchDebounceTime: 300, // Slightly longer debounce for prefetch
    prefetchMinQueryLength: 4, // Require slightly longer query for prefetch
    cacheTTL: 300, // 5 minutes default TTL
  };

  // Make config available globally
  window.seattleUConfig = window.seattleUConfig || {};
  window.seattleUConfig.search = {
    ...config,
    ...window.seattleUConfig?.search,
  };

  // Initialize on DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    // Detect environment
    const isResultsPage = window.location.pathname.includes("search-test");

    // Find search components
    const searchComponents = findSearchComponents();

    // Set up conditional preloading for search resources
    setupConditionalPreloading();

    // Set up integrations based on detected components
    if (searchComponents.header) {
      setupHeaderSearch(searchComponents.header);
    }

    if (isResultsPage && searchComponents.results) {
      setupResultsSearch(searchComponents.results);

      // Process URL parameters for initial search
      processUrlParameters(searchComponents.results);
    }
  });

  /**
   * Set up conditional preloading of search-related resources
   * This function finds the search toggle button and adds an event listener to preload
   * critical search resources only when the user interacts with the search UI.
   * Resources are preloaded only once per session to avoid redundant network requests.
   * 
   * @function
   * @returns {void}
   */
  function setupConditionalPreloading() {
    // Find the search toggle button
    const searchToggle = document.getElementById("site-search--button-toggle") ||
      document.querySelector(".site-search__toggle");

    if (!searchToggle) {
      console.log("Search toggle button not found on this page");
      return;
    }

    // Check if we've already set up preloading (using sessionStorage)
    const hasPreloaded = sessionStorage.getItem("searchResourcesPreloaded");
    if (hasPreloaded === "true") {
      return; // Don't set up listeners if we've already preloaded resources
    }

    // Add click event listener to the search toggle button
    searchToggle.addEventListener("click", function () {
      // Check again if we've already preloaded (could have happened between initial check and click)
      if (sessionStorage.getItem("searchResourcesPreloaded") === "true") {
        return;
      }

      // Create and inject preload links
      preloadSearchResources();

      // Set flag to prevent redundant preloading
      sessionStorage.setItem("searchResourcesPreloaded", "true");
    });
  }

  /**
   * Creates and injects preload elements for critical search resources
   * This function dynamically creates and injects resource hints to preload/prefetch
   * critical assets needed for the search results page. Resources are preloaded in
   * the following order of priority:
   * 1. Establish connections to API domains (preconnect)
   * 2. Load critical JavaScript files (preload)
   * 3. Prefetch the search results page template (prefetch)
   * 
   * This approach improves perceived performance when a user initiates a search
   * by having critical resources already in the browser cache.
   * 
   * @function
   * @returns {void}
   */
  function preloadSearchResources() {
    // Create a document fragment to hold all the link elements
    const fragment = document.createDocumentFragment();

    // 1. First, establish connections to API domains
    const apiPreconnect = document.createElement("link");
    apiPreconnect.rel = "preconnect";
    apiPreconnect.href = config.apiBaseUrl;
    fragment.appendChild(apiPreconnect);

    const proxyPreconnect = document.createElement("link");
    proxyPreconnect.rel = "preconnect";
    proxyPreconnect.href = config.proxyBaseUrl;
    fragment.appendChild(proxyPreconnect);

    // 2. Then preload critical JavaScript files
    const sessionServicePreload = document.createElement("link");
    sessionServicePreload.rel = "preload";
    sessionServicePreload.href = `${config.apiBaseUrl}/js/SessionService.js`;
    sessionServicePreload.as = "script";
    fragment.appendChild(sessionServicePreload);

    const searchBundlePreload = document.createElement("link");
    searchBundlePreload.rel = "preload";
    searchBundlePreload.href = `${config.apiBaseUrl}/search-bundle.js`;
    searchBundlePreload.as = "script";
    fragment.appendChild(searchBundlePreload);

    // 3. Finally, prefetch the search results page template
    const searchPagePrefetch = document.createElement("link");
    searchPagePrefetch.rel = "prefetch";
    searchPagePrefetch.href = "/search-test/";
    fragment.appendChild(searchPagePrefetch);

    // Append all links to the document head
    document.head.appendChild(fragment);

    // Log to console in development environments
    if (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('dev')) {
      console.log("Search resources preloaded after search UI interaction");
    }
  }

  /**
   * Find search components on the page
   * @returns {Object} Object containing references to header and results search components
   */
  function findSearchComponents() {
    const components = {
      header: null,
      results: null,
    };

    // Header search components
    const headerInput = document.getElementById("search-input");
    const headerForm = headerInput?.closest("form");
    const headerButton = headerForm?.querySelector('button[type="submit"]');

    if (headerInput && headerForm) {
      components.header = {
        input: headerInput,
        form: headerForm,
        button: headerButton,
        container: document.createElement("div"),
      };

      // Create suggestions container if not exists
      if (!document.getElementById("header-suggestions")) {
        const suggestionsContainer = document.createElement("div");
        suggestionsContainer.id = "header-suggestions";
        suggestionsContainer.className = "header-suggestions-container";
        suggestionsContainer.setAttribute("role", "listbox");
        suggestionsContainer.hidden = true;

        // Insert after search form
        headerForm.parentNode.insertBefore(
          suggestionsContainer,
          headerForm.nextSibling
        );
        components.header.suggestionsContainer = suggestionsContainer;
      } else {
        components.header.suggestionsContainer =
          document.getElementById("header-suggestions");
      }
    }

    // Results page components
    const resultsInput = document.getElementById(
      "autocomplete-concierge-inputField"
    );
    const resultsForm = resultsInput?.closest("form");
    const resultsButton = resultsForm?.querySelector("#on-page-search-button");
    const resultsContainer = document.getElementById("results");
    const suggestionsContainer = document.getElementById(
      "autocomplete-suggestions"
    );

    if (resultsInput && resultsContainer) {
      components.results = {
        input: resultsInput,
        form: resultsForm,
        button: resultsButton,
        container: resultsContainer,
        suggestionsContainer: suggestionsContainer,
      };
    }

    return components;
  }

  /**
   * Set up header search integration
   * @param {Object} component - Header search component references
   */
  function setupHeaderSearch(component) {
    // Intercept form submission
    component.form.addEventListener("submit", function (e) {
      e.preventDefault();

      const query = component.input.value.trim();
      if (!query) return;

      // Navigate to search page with query
      window.location.href = `/search-test/?query=${encodeURIComponent(query)}`;
    });

    // Set up suggestions
    if (component.suggestionsContainer) {
      // Create debounced function for input handling
      const handleInput = debounce(async function () {
        const query = component.input.value.trim();

        if (query.length < config.minQueryLength) {
          component.suggestionsContainer.innerHTML = "";
          component.suggestionsContainer.hidden = true;
          return;
        }

        fetchHeaderSuggestions(query, component.suggestionsContainer);
      }, config.debounceTime);

      component.input.addEventListener("input", handleInput);

      // Add prefetch functionality
      const handlePrefetch = debounce(async function () {
        const query = component.input.value.trim();

        // Only prefetch if query is long enough
        if (query.length < config.prefetchMinQueryLength) {
          return;
        }

        // Prefetch in background
        prefetchSearchResults(query);
      }, config.prefetchDebounceTime);

      // Add the prefetch listener
      component.input.addEventListener("input", handlePrefetch);
    }

    // Handle clicks outside
    document.addEventListener("click", function (e) {
      if (
        component.suggestionsContainer &&
        !component.input.contains(e.target) &&
        !component.suggestionsContainer.contains(e.target)
      ) {
        component.suggestionsContainer.innerHTML = "";
        component.suggestionsContainer.hidden = true;
      }
    });
  }

  /**
   * Prefetch search results for a query to warm up the cache
   * This sends a low-priority request to the prefetch API endpoint
   * which will cache the results without blocking the main thread
   * 
   * @param {string} query - Search query to prefetch
   */
  function prefetchSearchResults(query) {
    try {
      if (!query || query.length < config.prefetchMinQueryLength) {
        return;
      }

      // Normalize query for consistent caching
      const normalizedQuery = query.trim().toLowerCase();

      // Get session ID if available
      let sessionId = '';
      if (window.SessionService) {
        sessionId = window.SessionService.getSessionId() || '';
      }

      // Create URL with parameters
      const params = new URLSearchParams({
        query: normalizedQuery,
        collection: config.collection,
        profile: config.profile,
        prefetch: 'true'
      });

      if (sessionId) {
        params.append('sessionId', sessionId);
      }

      const prefetchUrl = `${config.apiBaseUrl}/api/prefetch?${params}`;

      // Use fetch with appropriate flags for background operation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      fetch(prefetchUrl, {
        method: 'GET',
        signal: controller.signal,
        priority: 'low',
        keepalive: true,
        headers: {
          'X-Prefetch-Request': 'true',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
        .then(response => {
          clearTimeout(timeoutId);
          if (response.ok) {
            if (window.location.hostname.includes('dev') ||
              window.location.hostname === 'localhost') {
              console.log(`Prefetched results for: ${normalizedQuery}`);
            }
          }
        })
        .catch(() => {
          // Silent error handling for prefetch
          clearTimeout(timeoutId);
        });
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Fetch suggestions for header search
   * @param {string} query - Search query
   * @param {HTMLElement} container - Container for suggestions
   */
  async function fetchHeaderSuggestions(query, container) {
    try {
      // Prepare URL with parameters
      const params = new URLSearchParams({ query });

      // Get session ID directly from SessionService if available
      if (window.SessionService) {
        const sessionId = window.SessionService.getSessionId();
        if (sessionId) {
          params.append("sessionId", sessionId);
        }
      }

      // Fetch suggestions from API
      const url = `${config.apiBaseUrl}/api/suggestions?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Get JSON response
      const data = await response.json();

      // Render header suggestions (simple list)
      renderHeaderSuggestions(data, container, query);
    } catch (error) {
      container.innerHTML = "";
      container.hidden = true;
      // Continue with normal operation despite fetch failure
    }
  }

  /**
   * Render header suggestions (simple list)
   * @param {Object} data - Suggestions data
   * @param {HTMLElement} container - Container for suggestions
   * @param {string} query - Original query
   */
  function renderHeaderSuggestions(data, container, query) {
    const suggestions = data.general || [];

    if (suggestions.length === 0) {
      container.innerHTML = "";
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

    html += "</div>";

    container.innerHTML = html;
    container.hidden = false;

    // Add click handlers
    container.querySelectorAll(".suggestion-item").forEach((item) => {
      item.addEventListener("click", function () {
        const text = this.querySelector(".suggestion-text").textContent;

        // Set input value
        const input = document.getElementById("search-input");
        if (input) {
          input.value = text;
        }

        // Track suggestion click
        trackSuggestionClick(text, "general", "", text);

        // Redirect to search page
        window.location.href = `/search-test/?query=${encodeURIComponent(
          text
        )}`;
      });
    });
  }

  /**
   * Set up results page search integration
   * @param {Object} component - Results search component references
   */
  function setupResultsSearch(component) {
    // Make sure search button is visible
    if (component.button) {
      component.button.classList.remove("empty-query");
    }

    // Intercept form submission
    if (component.form) {
      component.form.addEventListener("submit", function (e) {
        e.preventDefault();

        const query = component.input.value.trim();
        if (!query) return;

        // Perform search
        performSearch(query, component.container);

        // Update URL without reload
        updateUrl(query);
      });
    }

    // Add prefetch functionality to search page input
    if (component.input) {
      const handlePrefetch = debounce(async function () {
        const query = component.input.value.trim();

        // Only prefetch if query is long enough
        if (query.length < config.prefetchMinQueryLength) {
          return;
        }

        // Prefetch in background
        prefetchSearchResults(query);
      }, config.prefetchDebounceTime);

      // Add the prefetch listener
      component.input.addEventListener("input", handlePrefetch);
    }

    // Set up click tracking on results
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get("query") || "";
    attachResultClickHandlers(component.container, queryParam);
  }

  /**
   * Process URL parameters for initial search
   * @param {Object} component - Results search component references
   */
  function processUrlParameters(component) {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get("query");

    if (query) {
      // Set input value
      if (component.input) {
        component.input.value = query;
      }

      // Perform search
      performSearch(query, component.container);
    }
  }

  /**
   * Perform search via API
   * @param {string} query - Search query
   * @param {HTMLElement} container - Container for results
   */
  async function performSearch(query, container) {
    try {
      // Prepare URL with parameters
      const params = new URLSearchParams({
        query,
        collection: config.collection,
        profile: config.profile,
      });

      // Get session ID directly from SessionService if available
      if (window.SessionService) {
        const sessionId = window.SessionService.getSessionId();
        if (sessionId) {
          params.append("sessionId", sessionId);
        }
      }

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
      attachResultClickHandlers(container, query);

      // Scroll to results if not in viewport AND page is not already at the top
      if (!isElementInViewport(container) && window.scrollY > 0) {
        container.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
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
   */
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

  /**
   * Track result click via API
   * @param {string} query - Original query
   * @param {string} url - Clicked URL
   * @param {string} title - Result title
   * @param {number} position - Result position (1-based)
   */
  function trackResultClick(query, url, title, position) {
    try {
      // Prepare data
      const data = {
        originalQuery: query,
        clickedUrl: url,
        clickedTitle: title,
        clickPosition: position,
        clickType: "search",
        timestamp: new Date().toISOString(),
      };

      // Get session ID directly from SessionService if available
      if (window.SessionService) {
        const sessionId = window.SessionService.getSessionId();
        if (sessionId) {
          data.sessionId = sessionId;
        }
      }

      // Use sendBeacon if available for non-blocking operation
      const endpoint = `${config.proxyBaseUrl}/analytics/click`;

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

  /**
   * Track suggestion click for analytics
   * Exposed globally for use by other components
   * @param {string} text - Suggestion text
   * @param {string} type - Suggestion type (general, staff, program)
   * @param {string} url - Clicked URL (for staff and programs)
   * @param {string} title - Display title (with additional context)
   */
  window.trackSuggestionClick = function (text, type, url, title) {
    try {
      // Prepare data for the API call
      const data = {
        originalQuery: text,
        clickedUrl: url || "",
        clickedTitle: title || text,
        clickType: type || "suggestion",
        clickPosition: -1, // -1 for suggestions
        timestamp: new Date().toISOString(),
      };

      // Get session ID directly from SessionService if available
      if (window.SessionService) {
        const sessionId = window.SessionService.getSessionId();
        if (sessionId) {
          data.sessionId = sessionId;
        }
      }

      // Use sendBeacon if available for non-blocking operation
      const endpoint = `${config.proxyBaseUrl}/analytics/click`;

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
  };

  /**
   * Track tab change for analytics
   * Exposed globally for use by other components
   * @param {string} query - Original query
   * @param {string} tabName - Tab name
   * @param {string} tabId - Tab ID
   */
  window.trackTabChange = function (query, tabName, tabId) {
    try {
      // Prepare data for the API call
      const data = {
        query: query,
        enrichmentData: {
          actionType: "tab",
          tabName: tabName,
          tabId: tabId,
        },
        timestamp: new Date().toISOString(),
      };

      // Get session ID directly from SessionService if available
      if (window.SessionService) {
        const sessionId = window.SessionService.getSessionId();
        if (sessionId) {
          data.sessionId = sessionId;
        }
      }

      // Use sendBeacon if available for non-blocking operation
      const endpoint = `${config.proxyBaseUrl}/analytics/supplement`;

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
  };

  /**
   * Update URL without page reload
   * @param {string} query - Search query
   */
  function updateUrl(query) {
    if (!window.history?.pushState) return;

    const url = new URL(window.location);
    url.searchParams.set("query", query);
    window.history.pushState({}, "", url);
  }

  /**
   * Debounce function to limit execution frequency
   * @param {Function} func - Function to debounce
   * @param {number} wait - Milliseconds to wait between calls
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // Expose debounce function globally for other components
  window.debounceFunction = debounce;

  /**
   * Check if element is in viewport
   * @param {HTMLElement} el - Element to check
   * @returns {boolean} Whether element is in viewport
   */
  function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    const isVisible =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth);
    return isVisible;
  }

  // Expose configuration globally for other components
  window.searchConfig = config;

  /**
   * Perform search via API (exposed globally for other components)
   * @param {string} query - Search query
   * @param {string|HTMLElement} containerId - Container ID or element for results
   */
  window.performSearch = function (query, containerId) {
    const container =
      typeof containerId === "string"
        ? document.getElementById(containerId)
        : containerId;

    if (!container) {
      return;
    }

    return performSearch(query, container);
  };

  /**
   * Update URL without page reload (exposed globally for other components)
   */
  window.updateSearchUrl = updateUrl;

  /**
   * Expose prefetch function globally
   */
  window.prefetchSearchResults = prefetchSearchResults;
})();