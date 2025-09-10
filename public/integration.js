/**
 * @fileoverview Frontend Search Integration Script
 *
 * This script integrates the frontend search API with the Seattle University website.
 * It enhances the existing search functionality by proxying requests through the new API
 * while maintaining compatibility with the current UI components.
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 3.2.0
 * @lastModified 2025-09-10
 */

(function () {
  // Logging system configuration
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  // Default log level is INFO but can be overridden via URL parameter
  let currentLogLevel = LOG_LEVELS.INFO;

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
    logLevel: currentLogLevel, // Default log level
  };

  // Make config available globally
  window.seattleUConfig = window.seattleUConfig || {};
  window.seattleUConfig.search = {
    ...config,
    ...window.seattleUConfig?.search,
  };

  /**
   * Log a message with the appropriate level
   * @param {string} message - The message to log
   * @param {number} level - The log level (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG)
   * @param {any} [data] - Optional data to include
   */
  function log(message, level = LOG_LEVELS.INFO, data) {
    if (level > currentLogLevel) return;

    const prefix = getLogPrefix(level);

    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Get the prefix for a log message based on level
   * @param {number} level - The log level
   * @returns {string} The prefix
   */
  function getLogPrefix(level) {
    switch (level) {
      case LOG_LEVELS.ERROR:
        return "[Integration-ERROR]";
      case LOG_LEVELS.WARN:
        return "[Integration-WARN]";
      case LOG_LEVELS.INFO:
        return "[Integration-INFO]";
      case LOG_LEVELS.DEBUG:
        return "[Integration-DEBUG]";
      default:
        return "[Integration]";
    }
  }

  /**
   * Set the log level
   * @param {number} level - The log level to set
   */
  function setLogLevel(level) {
    currentLogLevel = level;
    config.logLevel = level;
    log(`Log level set to ${level}`, LOG_LEVELS.INFO);
  }

  // Enable debug logging if URL has debug parameter
  if (new URLSearchParams(window.location.search).has("debug_search")) {
    setLogLevel(LOG_LEVELS.DEBUG);
    log("Debug logging enabled", LOG_LEVELS.INFO);
  }

  // Initialize on DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    log("DOM content loaded, initializing search integration", LOG_LEVELS.INFO);

    // Detect environment
    const isResultsPage = window.location.pathname.includes("search-test");
    log(
      `Current page type: ${isResultsPage ? "search results" : "regular"}`,
      LOG_LEVELS.INFO
    );

    // Find search components
    const searchComponents = findSearchComponents();
    log("Found search components", LOG_LEVELS.DEBUG, searchComponents);

    // Set up conditional preloading for search resources
    setupConditionalPreloading();

    // Set up integrations based on detected components
    if (searchComponents.header) {
      setupHeaderSearch(searchComponents.header);
    }

    if (isResultsPage && searchComponents.results) {
      setupResultsSearch(searchComponents.results);

      // Process URL parameters for initial search
      const cacheFirst =
        window.SessionService &&
        window.SessionService.getLastSearchQuery &&
        window.SessionService._detectSearchRedirect &&
        window.SessionService._detectSearchRedirect();

      processUrlParameters(searchComponents.results, cacheFirst);
    }

    log("Search integration initialization complete", LOG_LEVELS.INFO);
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
    const searchToggle =
      document.getElementById("site-search--button-toggle") ||
      document.querySelector(".site-search__toggle");

    if (!searchToggle) {
      log("Search toggle button not found on this page", LOG_LEVELS.INFO);
      return;
    }

    // Check if we've already set up preloading (using sessionStorage)
    const hasPreloaded = sessionStorage.getItem("searchResourcesPreloaded");
    if (hasPreloaded === "true") {
      log(
        "Resources already preloaded, skipping preload setup",
        LOG_LEVELS.INFO
      );
      return; // Don't set up listeners if we've already preloaded resources
    }

    log("Setting up preload listener on search toggle button", LOG_LEVELS.INFO);

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
    log("Preloading search resources", LOG_LEVELS.INFO);

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

    log("Search resources preloaded successfully", LOG_LEVELS.INFO);
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
     * Set up header search functionality with smart pre-rendering enhancement
     * 
     * This function configures header search forms to handle user submissions
     * and redirect to the search results page. Enhanced with smart pre-rendering
     * to provide near-instantaneous search results by triggering background
     * caching during form submission.
     * 
     * Features:
     * - Form submission handling and validation
     * - SessionService integration for redirect optimization
     * - Smart pre-rendering trigger for instant results
     * - Graceful fallback when pre-rendering unavailable
     * - Suggestions integration for header search forms
     * 
     * @param {Object} component - Header search component references
     * @param {HTMLInputElement} component.input - Search input element
     * @param {HTMLFormElement} component.form - Search form element  
     * @param {HTMLElement} component.button - Submit button element
     * @param {HTMLElement} component.suggestionsContainer - Suggestions container
     */
  function setupHeaderSearch(component) {
    log("Setting up header search integration", LOG_LEVELS.INFO);

    // Intercept form submission for enhanced redirect with pre-rendering
    component.form.addEventListener("submit", function (e) {
      e.preventDefault();

      const query = component.input.value.trim();
      if (!query) return;

      log(`Header search form submitted with query: ${query}`, LOG_LEVELS.INFO);

      // Normalize the query for consistent processing
      const normalizedQuery = normalizeQuery(query);

      // Get established session ID from SessionService for continuity
      let sessionId = null;
      if (window.SessionService) {
        sessionId = window.SessionService.getSessionId();
        if (window.SessionService._maskString && sessionId) {
          const maskedId = window.SessionService._maskString(sessionId);
          log(`Using session ID for pre-render: ${maskedId}`, LOG_LEVELS.DEBUG);
        }
      }

      // This initiates background caching for instant results on the search page
      fetch(`${config.apiBaseUrl}/api/pre-render`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: normalizedQuery,
          sessionId: sessionId
        })
      }).then(response => {
        if (response.ok) {
          log(`Pre-render request accepted for: ${normalizedQuery}`, LOG_LEVELS.INFO);
        } else {
          log(`Pre-render request failed with status: ${response.status}`, LOG_LEVELS.WARN);
        }
      }).catch(error => {
        // Silent failure - pre-rendering is best effort and never blocks user experience
        log(`Pre-render error (non-blocking): ${error.message}`, LOG_LEVELS.DEBUG);
      });

      if (window.SessionService && window.SessionService.prepareForSearchRedirect) {
        const prepared = window.SessionService.prepareForSearchRedirect(normalizedQuery);
        log(`SessionService prepared for redirect: ${prepared ? "success" : "failed"}`, LOG_LEVELS.INFO);
      } else {
        log("SessionService not available for redirect preparation", LOG_LEVELS.WARN);
      }

      const redirectUrl = `/search-test/?query=${encodeURIComponent(normalizedQuery)}`;
      log(`Redirecting to: ${redirectUrl}`, LOG_LEVELS.INFO);
      window.location.href = redirectUrl;
    });

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

      const handlePrefetch = debounce(async function () {
        const query = component.input.value.trim();

        // Only prefetch if query is long enough
        if (query.length < config.prefetchMinQueryLength) {
          return;
        }

        // Normalize the query
        const normalizedQuery = normalizeQuery(query);

        // Prefetch in background
        prefetchSearchResults(normalizedQuery);
      }, config.prefetchDebounceTime);

      // Add the prefetch listener
      component.input.addEventListener("input", handlePrefetch);
    }

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
   * Normalizes a query for consistent caching
   * @param {string} query - Original query
   * @returns {string} Normalized query
   */
  function normalizeQuery(query) {
    if (!query) return "";

    // Convert to lowercase
    let normalized = query.toLowerCase();

    // Remove extra whitespace
    normalized = normalized.trim().replace(/\s+/g, " ");

    // Remove certain special characters
    normalized = normalized.replace(/['"?!.,]/g, "");

    log(`Normalized query: "${query}" -> "${normalized}"`, LOG_LEVELS.DEBUG);

    return normalized;
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

      log(`Prefetching results for query: ${query}`, LOG_LEVELS.INFO);

      // Get session ID if available
      let sessionId = "";
      if (window.SessionService) {
        sessionId = window.SessionService.getSessionId() || "";
        // Use a masked version of the session ID for logging
        if (window.SessionService._maskString && sessionId) {
          const maskedId = window.SessionService._maskString(sessionId);
          log(`Using session ID for prefetch: ${maskedId}`, LOG_LEVELS.DEBUG);
        }
      }

      // Create URL with parameters
      const params = new URLSearchParams({
        query: query,
        collection: config.collection,
        profile: config.profile,
        prefetch: "true",
      });

      if (sessionId) {
        params.append("sessionId", sessionId);
      }

      const prefetchUrl = `${config.apiBaseUrl}/api/prefetch?${params}`;

      // Use fetch with appropriate flags for background operation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      fetch(prefetchUrl, {
        method: "GET",
        signal: controller.signal,
        priority: "low",
        keepalive: true,
        headers: {
          "X-Prefetch-Request": "true",
          "X-Requested-With": "XMLHttpRequest",
        },
      })
        .then((response) => {
          clearTimeout(timeoutId);
          if (response.ok) {
            log(`Prefetch request successful for: ${query}`, LOG_LEVELS.INFO);
            return response.json();
          } else {
            log(
              `Prefetch request failed with status: ${response.status}`,
              LOG_LEVELS.WARN
            );
            throw new Error(`Prefetch failed: ${response.status}`);
          }
        })
        .then((data) => {
          log(`Prefetch response data:`, LOG_LEVELS.DEBUG, data);
        })
        .catch((error) => {
          // Silent error handling for prefetch
          clearTimeout(timeoutId);
          log(`Prefetch error: ${error.message}`, LOG_LEVELS.ERROR);
        });
    } catch (error) {
      // Silent error handling
      log(`Prefetch exception: ${error.message}`, LOG_LEVELS.ERROR);
    }
  }

  /**
   * Fetch suggestions for header search
   * @param {string} query - Search query
   * @param {HTMLElement} container - Container for suggestions
   */
  async function fetchHeaderSuggestions(query, container) {
    try {
      log(`Fetching header suggestions for query: ${query}`, LOG_LEVELS.INFO);

      // Prepare URL with parameters
      const params = new URLSearchParams({ query });

      // Get session ID directly from SessionService if available
      if (window.SessionService) {
        const sessionId = window.SessionService.getSessionId();
        if (sessionId) {
          params.append("sessionId", sessionId);
          // Use a masked version of the session ID for logging
          if (window.SessionService._maskString) {
            const maskedId = window.SessionService._maskString(sessionId);
            log(
              `Added session ID to suggestions request: ${maskedId}`,
              LOG_LEVELS.DEBUG
            );
          }
        }
      }

      // Fetch suggestions from API
      const url = `${config.apiBaseUrl}/api/suggestions?${params}`;
      log(`Suggestions API URL: ${url}`, LOG_LEVELS.DEBUG);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Get JSON response
      const data = await response.json();
      log(`Received suggestions data:`, LOG_LEVELS.DEBUG, {
        generalCount: data.general?.length || 0,
        staffCount: data.staff?.length || 0,
        programsCount: data.programs?.length || 0,
      });

      // Render header suggestions (simple list)
      renderHeaderSuggestions(data, container, query);
    } catch (error) {
      log(`Error fetching suggestions: ${error.message}`, LOG_LEVELS.ERROR);
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
        log(`Suggestion clicked: ${text}`, LOG_LEVELS.INFO);

        // Set input value
        const input = document.getElementById("search-input");
        if (input) {
          input.value = text;
        }

        // Normalize the query
        const normalizedQuery = normalizeQuery(text);

        // Use SessionService to prepare for redirect if available
        if (
          window.SessionService &&
          window.SessionService.prepareForSearchRedirect
        ) {
          window.SessionService.prepareForSearchRedirect(normalizedQuery);
          log(
            `SessionService prepared for redirect with suggestion: ${normalizedQuery}`,
            LOG_LEVELS.INFO
          );
        }

        // Track suggestion click
        trackSuggestionClick(text, "general", "", text);

        // Redirect to search page
        window.location.href = `/search-test/?query=${encodeURIComponent(
          normalizedQuery
        )}`;
      });
    });
  }

  /**
   * Set up results page search integration
   * @param {Object} component - Results search component references
   */
  function setupResultsSearch(component) {
    log("Setting up results page search integration", LOG_LEVELS.INFO);

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

        log(
          `Results page search form submitted with query: ${query}`,
          LOG_LEVELS.INFO
        );

        // Normalize the query
        const normalizedQuery = normalizeQuery(query);

        // KEY ADDITION: Update core.originalQuery to ensure analytics work properly
        // Only set if SearchManager exists and originalQuery is accessible
        if (window.SearchManager && typeof window.SearchManager === "object") {
          // First try to use setter method if it exists
          if (typeof window.SearchManager.setOriginalQuery === "function") {
            window.SearchManager.setOriginalQuery(normalizedQuery);
            log(
              "Updated SearchManager.originalQuery via setter",
              LOG_LEVELS.DEBUG
            );
          }
          // Otherwise set directly if property exists or can be created
          else {
            window.SearchManager.originalQuery = normalizedQuery;
            log(
              "Updated SearchManager.originalQuery directly",
              LOG_LEVELS.DEBUG
            );
          }
        }

        // Perform search
        performSearch(normalizedQuery, component.container);

        // Update URL without reload
        updateUrl(normalizedQuery);
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

        // Normalize the query
        const normalizedQuery = normalizeQuery(query);

        // Prefetch in background
        prefetchSearchResults(normalizedQuery);
      }, config.prefetchDebounceTime);

      // Add the prefetch listener
      component.input.addEventListener("input", handlePrefetch);
    }

    // Set up click tracking on results
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get("query") || "";
    attachResultClickHandlers(component.container, queryParam);

    // Check if this is a redirect from a prefetched query
    if (window.SessionService) {
      const lastQuery =
        window.SessionService.getLastSearchQuery &&
        window.SessionService.getLastSearchQuery();

      if (lastQuery) {
        log(
          `Found last search query from SessionService: ${lastQuery}`,
          LOG_LEVELS.INFO
        );

        // Clear after using to avoid stale data
        if (window.SessionService.clearLastSearchQuery) {
          window.SessionService.clearLastSearchQuery();
          log("Cleared last search query from SessionService", LOG_LEVELS.INFO);
        }
      }
    }
  }

  /**
   * Process URL parameters for initial search with optimized pre-render flow
   * 
   * This function implements a priority-based search strategy:
   * 1. Pre-render check (fastest - uses cached content from header form submission)
   * 2. Cache-first fallback (medium - uses existing cache if pre-render unavailable) 
   * 3. Standard search (slowest - fresh API call to backend)
   * 
   * Each path uses early exits to prevent redundant execution and optimize performance.
   * Enhanced with comprehensive timing to identify bottlenecks and measure improvements.
   * 
   * @param {Object} component - Results search component references
   * @param {boolean} cacheFirst - Whether to attempt cache-first approach (fallback only)
   */
  function processUrlParameters(component, cacheFirst = false) {
    const overallStartTime = Date.now(); // Track total search time

    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get("query");

    if (!query) {
      log("No query parameter found in URL", LOG_LEVELS.INFO);
      return;
    }

    log(
      `[INTEGRATION-SEARCH] Starting search flow for: "${query}" (cacheFirst: ${cacheFirst})`,
      LOG_LEVELS.INFO
    );

    // Set input value immediately
    if (component.input) {
      component.input.value = query;
    }

    // Normalize the query for consistent processing
    const normalizedQuery = normalizeQuery(query);

    // PRIORITY 1: Pre-render check (highest priority - fastest path)
    if (window.checkForPreRenderedContent) {
      log(`[INTEGRATION-PRERENDER] Checking for pre-rendered content: "${normalizedQuery}"`, LOG_LEVELS.INFO);

      const preRenderStartTime = Date.now();

      window.checkForPreRenderedContent(normalizedQuery)
        .then(preRenderedHtml => {
          const preRenderCheckTime = Date.now() - preRenderStartTime;

          if (preRenderedHtml && window.displayPreRenderedResults) {
            log(`[INTEGRATION-PRERENDER] Pre-render SUCCESS in ${preRenderCheckTime}ms, displaying results`, LOG_LEVELS.INFO);

            const displayStartTime = Date.now();
            const displaySuccess = window.displayPreRenderedResults(preRenderedHtml, normalizedQuery);
            const displayTime = Date.now() - displayStartTime;
            const totalTime = Date.now() - overallStartTime;

            if (displaySuccess) {
              log(`[INTEGRATION-PRERENDER] Pre-render path completed successfully (total: ${totalTime}ms, check: ${preRenderCheckTime}ms, display: ${displayTime}ms)`, LOG_LEVELS.INFO);
              return; // ✅ EARLY EXIT - Pre-render succeeded, no further processing needed
            } else {
              log(`[INTEGRATION-PRERENDER] Display failed, falling back to cache-first`, LOG_LEVELS.WARN);
              // Fall through to cache-first logic
            }
          } else {
            log(`[INTEGRATION-PRERENDER] No pre-rendered content available (${preRenderCheckTime}ms), trying cache-first approach`, LOG_LEVELS.INFO);
            // Fall through to cache-first logic
          }

          // PRIORITY 2: Cache-first fallback (only executes if pre-render failed)
          if (cacheFirst && window.SessionService && window.SessionService.getLastSearchQuery) {
            log(`[INTEGRATION-CACHE-FIRST] Attempting cache-first approach for: "${normalizedQuery}"`, LOG_LEVELS.INFO);

            const cacheFirstStartTime = Date.now();
            const lastQuery = window.SessionService.getLastSearchQuery();

            if (lastQuery === normalizedQuery) {
              log(`[INTEGRATION-CACHE-FIRST] Cache-first possible for query: "${normalizedQuery}"`, LOG_LEVELS.INFO);
              // TODO: In future, implement direct cache check here
              // For now, fall through to standard search
            } else {
              const cacheFirstTime = Date.now() - cacheFirstStartTime;
              log(`[INTEGRATION-CACHE-FIRST] Cache-first not possible, query mismatch (${cacheFirstTime}ms). URL: "${normalizedQuery}", Cached: "${lastQuery}"`, LOG_LEVELS.INFO);
            }
          }

          // PRIORITY 3: Standard search (lowest priority - only if both pre-render and cache-first failed)
          log(`[INTEGRATION-STANDARD] Using standard search for: "${normalizedQuery}"`, LOG_LEVELS.INFO);
          const standardSearchStartTime = Date.now();

          performSearch(normalizedQuery, component.container)
            .then(() => {
              const standardSearchTime = Date.now() - standardSearchStartTime;
              const totalTime = Date.now() - overallStartTime;
              log(`[INTEGRATION-STANDARD] Standard search completed (search: ${standardSearchTime}ms, total: ${totalTime}ms)`, LOG_LEVELS.INFO);
            })
            .catch(error => {
              const standardSearchTime = Date.now() - standardSearchStartTime;
              const totalTime = Date.now() - overallStartTime;
              log(`[INTEGRATION-STANDARD] Standard search failed after ${standardSearchTime}ms (total: ${totalTime}ms): ${error.message}`, LOG_LEVELS.ERROR);
            });
        })
        .catch(error => {
          const preRenderTime = Date.now() - preRenderStartTime;
          log(`[INTEGRATION-PRERENDER] Pre-render check failed after ${preRenderTime}ms: ${error.message}`, LOG_LEVELS.ERROR);

          // FALLBACK: If pre-render completely fails, go directly to standard search
          log(`[INTEGRATION-FALLBACK] Pre-render failed, using standard search for: "${normalizedQuery}"`, LOG_LEVELS.INFO);
          const fallbackStartTime = Date.now();

          performSearch(normalizedQuery, component.container)
            .then(() => {
              const fallbackTime = Date.now() - fallbackStartTime;
              const totalTime = Date.now() - overallStartTime;
              log(`[INTEGRATION-FALLBACK] Fallback search completed (search: ${fallbackTime}ms, total: ${totalTime}ms)`, LOG_LEVELS.INFO);
            })
            .catch(fallbackError => {
              const fallbackTime = Date.now() - fallbackStartTime;
              const totalTime = Date.now() - overallStartTime;
              log(`[INTEGRATION-FALLBACK] Fallback search failed after ${fallbackTime}ms (total: ${totalTime}ms): ${fallbackError.message}`, LOG_LEVELS.ERROR);
            });
        });

      return; // ✅ EARLY EXIT - Pre-render logic is handling everything, no more code should run
    }

    // FALLBACK: If pre-render functions not available, use standard search directly  
    log(`[INTEGRATION-FALLBACK] Pre-render functions not available, using standard search for: "${normalizedQuery}"`, LOG_LEVELS.INFO);
    const fallbackStartTime = Date.now();

    performSearch(normalizedQuery, component.container)
      .then(() => {
        const fallbackTime = Date.now() - fallbackStartTime;
        const totalTime = Date.now() - overallStartTime;
        log(`[INTEGRATION-FALLBACK] Direct search completed (search: ${fallbackTime}ms, total: ${totalTime}ms)`, LOG_LEVELS.INFO);
      })
      .catch(error => {
        const fallbackTime = Date.now() - fallbackStartTime;
        const totalTime = Date.now() - overallStartTime;
        log(`[INTEGRATION-FALLBACK] Direct search failed after ${fallbackTime}ms (total: ${totalTime}ms): ${error.message}`, LOG_LEVELS.ERROR);
      });
  }

  /**
   * Perform search via API
   * @param {string} query - Search query
   * @param {HTMLElement} container - Container for results
   */
  async function performSearch(query, container) {
    try {
      log(`Performing search for query: ${query}`, LOG_LEVELS.INFO);

      // Prepare URL with parameters
      const params = new URLSearchParams({
        query,
        form: 'partial',
        collection: config.collection,
        profile: config.profile,
      });

      log(`Performing search with params: ${params}`, LOG_LEVELS.INFO);

      // Get session ID directly from SessionService if available
      if (window.SessionService) {
        const sessionId = window.SessionService.getSessionId();
        if (sessionId) {
          params.append("sessionId", sessionId);
          // Use a masked version of the session ID for logging
          if (window.SessionService._maskString) {
            const maskedId = window.SessionService._maskString(sessionId);
            log(
              `Added session ID to search request: ${maskedId}`,
              LOG_LEVELS.DEBUG
            );
          }
        }
      }

      // Fetch results from API
      const url = `${config.apiBaseUrl}/api/search?${params}`;
      log(`Search API URL: ${url}`, LOG_LEVELS.DEBUG);

      const startTime = Date.now();
      const response = await fetch(url);
      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Check if response was from cache
      const cacheStatus = response.headers.get("X-Cache-Status");
      if (cacheStatus) {
        log(
          `Search response cache status: ${cacheStatus}, response time: ${responseTime}ms`,
          LOG_LEVELS.INFO
        );
      } else {
        log(`Search response received in ${responseTime}ms`, LOG_LEVELS.INFO);
      }

      // Get HTML response
      const html = await response.text();

      // Update results container
      container.innerHTML = `
        <div id="funnelback-search-container-response" class="funnelback-search-container">
          ${html}
        </div>
      `;

      console.log('Search response received, length:', html.length, 'starts with:', html.substring(0, 100), LOG_LEVELS.DEBUG)

      // Attach click handlers for tracking
      attachResultClickHandlers(container, query);

      // Scroll to results if not in viewport AND page is not already at the top
      if (!isElementInViewport(container) && window.scrollY > 0) {
        container.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      log(`Error performing search: ${error.message}`, LOG_LEVELS.ERROR);
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

    log(
      `Attaching click handlers to ${resultLinks.length} result links`,
      LOG_LEVELS.INFO
    );

    resultLinks.forEach((link, index) => {
      link.addEventListener("click", function (e) {
        // Don't prevent default navigation

        // Get link details
        const url =
          link.getAttribute("data-live-url") || link.getAttribute("href") || "";
        const title = link.textContent.trim() || "";

        log(
          `Result clicked: ${title}, position: ${index + 1}`,
          LOG_LEVELS.INFO
        );

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
      log(
        `Tracking result click - Query: ${query}, Title: ${title}, Position: ${position}`,
        LOG_LEVELS.INFO
      );

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
        const sent = navigator.sendBeacon(endpoint, blob);
        log(
          `Click tracking sent via sendBeacon: ${sent ? "success" : "failed"}`,
          LOG_LEVELS.DEBUG
        );
      } else {
        // Fallback to fetch with keepalive
        log(
          "SendBeacon not available, using fetch with keepalive",
          LOG_LEVELS.DEBUG
        );
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          keepalive: true,
        }).catch((error) => {
          log(`Error tracking click: ${error.message}`, LOG_LEVELS.ERROR);
        });
      }
    } catch (error) {
      // Error handling with logging
      log(`Error tracking result click: ${error.message}`, LOG_LEVELS.ERROR);
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
      log(
        `Tracking suggestion click - Text: ${text}, Type: ${type}`,
        LOG_LEVELS.INFO
      );

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
        const sent = navigator.sendBeacon(endpoint, blob);
        log(
          `Suggestion click tracking sent via sendBeacon: ${sent ? "success" : "failed"
          }`,
          LOG_LEVELS.DEBUG
        );
      } else {
        // Fallback to fetch with keepalive
        log(
          "SendBeacon not available, using fetch with keepalive",
          LOG_LEVELS.DEBUG
        );
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          keepalive: true,
        }).catch((error) => {
          log(
            `Error tracking suggestion click: ${error.message}`,
            LOG_LEVELS.ERROR
          );
        });
      }
    } catch (error) {
      // Error handling with logging
      log(
        `Error tracking suggestion click: ${error.message}`,
        LOG_LEVELS.ERROR
      );
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
      log(
        `Tracking tab change - Query: ${query}, Tab: ${tabName}, ID: ${tabId}`,
        LOG_LEVELS.INFO
      );

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
        const sent = navigator.sendBeacon(endpoint, blob);
        log(
          `Tab change tracking sent via sendBeacon: ${sent ? "success" : "failed"
          }`,
          LOG_LEVELS.DEBUG
        );
      } else {
        // Fallback to fetch with keepalive
        log(
          "SendBeacon not available, using fetch with keepalive",
          LOG_LEVELS.DEBUG
        );
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          keepalive: true,
        }).catch((error) => {
          log(`Error tracking tab change: ${error.message}`, LOG_LEVELS.ERROR);
        });
      }
    } catch (error) {
      // Error handling with logging
      log(`Error tracking tab change: ${error.message}`, LOG_LEVELS.ERROR);
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

    log(`Updated URL without page reload: ${url.toString()}`, LOG_LEVELS.INFO);
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
      log(`Search container not found: ${containerId}`, LOG_LEVELS.ERROR);
      return;
    }

    // Normalize the query
    const normalizedQuery = normalizeQuery(query);

    return performSearch(normalizedQuery, container);
  };

  /**
   * Update URL without page reload (exposed globally for other components)
   */
  window.updateSearchUrl = updateUrl;

  /**
   * Expose prefetch function globally
   */
  window.prefetchSearchResults = prefetchSearchResults;

  /**
   * Expose normalizeQuery function globally
   */
  window.normalizeQuery = normalizeQuery;

  /**
   * Toggle debug logging
   * @param {boolean} enabled - Whether to enable debug logging
   */
  window.setSearchDebugLogging = function (enabled) {
    setLogLevel(enabled ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO);
    log(`Debug logging ${enabled ? "enabled" : "disabled"}`, LOG_LEVELS.INFO);
  };
})();
