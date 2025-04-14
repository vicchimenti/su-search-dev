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
 * @version 2.5.4
 * @lastModified 2025-04-14
 */

class SearchManager {
  constructor() {
    this.config = {
      proxyBaseUrl: "https://funnelback-proxy-dev.vercel.app/proxy",
      enabledModules: ["tabs", "facets", "pagination", "spelling", "analytics"],
      observerConfig: {
        childList: true,
        subtree: true,
      },
      searchInputSelector: "#autocomplete-concierge-inputField",
      resultsContainerSelector: "#results",
      defaultResultsPerPage: 10,
    };

    // Module registry
    this.modules = {};

    // State
    this.sessionId = null;
    this.originalQuery = null;
    this.isInitialized = false;
    this.recentAnalyticsEvents = [];
  }

  /**
   * Initialize the search manager with configuration
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    // Prevent multiple initializations
    if (this.isInitialized) {
      console.warn("Search Manager already initialized");
      return this;
    }

    // Merge configuration
    this.config = {
      ...this.config,
      ...options,
    };

    // Initialize if on search page
    if (window.location.pathname.includes("search-test")) {
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
    console.debug(
      "Core manager: Initialization extracted query:",
      this.originalQuery
    );

    // Set up observer for dynamic content
    this.initializeObserver();

    // Initialize modules
    await this.loadModules();

    // Re-check query in case it wasn't available at first extraction
    if (!this.originalQuery) {
      console.debug(
        "Core manager: Re-extracting missing query after modules loaded"
      );
      this.extractOriginalQuery();
      console.debug("Core manager: Re-extracted query:", this.originalQuery);
    }

    // Start observing for DOM changes
    this.startObserving();

    console.log(
      "Search Manager initialized with modules:",
      Object.keys(this.modules)
    );
  }

  /**
   * Initialize session ID using SessionService
   */
  initializeSessionId() {
    try {
      if (window.SessionService) {
        this.sessionId = window.SessionService.getSessionId();
        console.log("Using SessionService for session ID:", this.sessionId);
      } else {
        console.warn(
          "SessionService not found - analytics tracking will be limited"
        );
        this.sessionId = null;
      }
    } catch (error) {
      console.error("Error accessing SessionService:", error);
      this.sessionId = null;
    }
  }

  /**
   * Load all enabled modules dynamically
   */
  async loadModules() {
    const modulePromises = this.config.enabledModules.map(
      async (moduleName) => {
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
      }
    );

    // Wait for all modules to load
    await Promise.all(modulePromises);
  }

  /**
   * Extract the original search query from URL or search input
   */
  extractOriginalQuery() {
    // First, try to get query from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlQuery = urlParams.get("query");

    if (urlQuery) {
      console.debug("Core manager: Setting originalQuery from URL:", urlQuery);
      this.originalQuery = urlQuery;
      return;
    }

    // If not in URL, try to get from search input field
    const searchInput = document.querySelector(this.config.searchInputSelector);
    if (searchInput && searchInput.value) {
      console.debug(
        "Core manager: Setting originalQuery from input:",
        searchInput.value
      );
      this.originalQuery = searchInput.value;
      return;
    }

    console.debug("Core manager: No query found in URL or input");
    // Don't set to empty string or null - keep previous value if it exists
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
        if (mutation.type === "childList") {
          // Notify all modules about DOM changes
          Object.values(this.modules).forEach((module) => {
            if (typeof module.handleDomChanges === "function") {
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
    const resultsContainer = document.querySelector(
      this.config.resultsContainerSelector
    );
    if (resultsContainer) {
      this.observer.observe(resultsContainer, this.config.observerConfig);
      console.log("Observer started watching results container");
    } else {
      console.warn("Results container not found, waiting for it to appear");
      this.waitForResultsContainer();
    }
  }

  /**
   * Wait for the results container to appear in the DOM
   */
  waitForResultsContainer() {
    const bodyObserver = new MutationObserver((mutations, obs) => {
      const resultsContainer = document.querySelector(
        this.config.resultsContainerSelector
      );
      if (resultsContainer) {
        obs.disconnect();
        this.observer.observe(resultsContainer, this.config.observerConfig);
        console.log("Results container found and observer started");
      }
    });

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Sanitize a string value to ensure it contains no line breaks
   * or special characters that could break the JSON
   * @param {string} value - The value to sanitize
   * @returns {string} Sanitized value
   */
  sanitizeValue(value) {
    if (typeof value !== "string") {
      return value;
    }

    // Replace line breaks, tabs, and control characters with spaces
    let sanitized = value
      .replace(/[\r\n\t\f\v]+/g, " ")
      .replace(/\s+/g, " ") // Normalize spaces
      .trim(); // Remove leading/trailing whitespace

    // Remove common counter patterns that might be in the text
    sanitized = sanitized.replace(/\s*\(\d+\)$/g, ""); // Remove " (26)" at the end
    sanitized = sanitized.replace(/\s*\[\d+\]$/g, ""); // Remove " [26]" at the end
    sanitized = sanitized.replace(/\s*\(\d+\)/g, ""); // Remove "(26)" anywhere

    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, "");

    return sanitized;
  }

  /**
   * Fetch data from Funnelback API via proxy
   * @param {string} url - The original Funnelback URL
   * @param {string} type - The type of request (search, tools, spelling)
   * @returns {Promise<string>} The HTML response
   */
  async fetchFromProxy(url, type = "search") {
    const endpoint = `${this.config.proxyBaseUrl}/funnelback/${type}`;

    try {
      let queryString;
      let fullUrl;

      // Always refresh session ID to ensure we have the latest
      this.initializeSessionId();

      // Process based on request type
      switch (type) {
        case "search":
          // Extract query string
          queryString = url.includes("?") ? url.split("?")[1] : "";

          // Parse and sanitize query parameters
          const searchParams = new URLSearchParams(queryString);

          // Extract and update originalQuery if present in the URL
          const queryParam = searchParams.get("query");
          if (queryParam) {
            console.debug(
              "Core manager: Updating originalQuery from search URL:",
              queryParam
            );
            this.originalQuery = queryParam;
          }

          // Remove any existing sessionId parameters
          if (searchParams.has("sessionId")) {
            const existingValues = searchParams.getAll("sessionId");
            if (existingValues.length > 1) {
              console.warn(
                `Found multiple sessionId parameters: ${existingValues.join(
                  ", "
                )}. Sanitizing.`
              );
            }
            searchParams.delete("sessionId");
          }

          // Add our canonical sessionId if available
          if (this.sessionId) {
            searchParams.append("sessionId", this.sessionId);
          }

          // Construct the full URL
          fullUrl = `${endpoint}?${searchParams.toString()}`;
          break;

        case "tools":
          // Get path from URL
          const path = url.split("/s/")[1];

          // Create parameters object
          const toolsParams = new URLSearchParams({
            path,
          });

          // Add canonical sessionId if available
          if (this.sessionId) {
            toolsParams.append("sessionId", this.sessionId);
          }

          // Construct the full URL
          fullUrl = `${endpoint}?${toolsParams.toString()}`;
          break;

        case "spelling":
          // Extract query string
          queryString = url.includes("?") ? url.split("?")[1] : "";

          // Parse parameters
          const spellingParams = new URLSearchParams(queryString);

          // Extract and update originalQuery if present
          const spellingQueryParam = spellingParams.get("query");
          if (spellingQueryParam) {
            console.debug(
              "Core manager: Updating originalQuery from spelling URL:",
              spellingQueryParam
            );
            this.originalQuery = spellingQueryParam;
          }

          // Remove any existing sessionId parameters
          if (spellingParams.has("sessionId")) {
            const existingValues = spellingParams.getAll("sessionId");
            if (existingValues.length > 1) {
              console.warn(
                `Found multiple sessionId parameters: ${existingValues.join(
                  ", "
                )}. Sanitizing.`
              );
            }
            spellingParams.delete("sessionId");
          }

          // Add canonical sessionId if available
          if (this.sessionId) {
            spellingParams.append("sessionId", this.sessionId);
          }

          // Construct the full URL
          fullUrl = `${endpoint}?${spellingParams.toString()}`;
          break;

        default:
          throw new Error(`Unknown request type: ${type}`);
      }

      console.log(
        `Fetching from ${type} endpoint with sanitized sessionId:`,
        fullUrl
      );
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
    const resultsContainer = document.querySelector(
      this.config.resultsContainerSelector
    );
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="funnelback-search-container">
          ${html || "No results found."}
        </div>
      `;

      // Scroll to results if not in viewport and page is not already at the top
      if (!this.isElementInViewport(resultsContainer) && window.scrollY > 0) {
        resultsContainer.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      console.error("Results container not found when updating results");
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
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Check if an event should be considered a duplicate
   * @param {string} eventType - The type of event
   * @param {Object} data - The event data
   * @returns {boolean} True if event is a duplicate
   */
  isDuplicateEvent(eventType, data) {
    const now = Date.now();
    const fingerprint = `${eventType}-${JSON.stringify(data)}`;

    // Check for recent duplicates (within last 300ms)
    const isDuplicate = this.recentAnalyticsEvents.some((event) => {
      return event.fingerprint === fingerprint && now - event.timestamp < 300;
    });

    if (!isDuplicate) {
      // Add to recent events list
      this.recentAnalyticsEvents.push({
        fingerprint,
        timestamp: now,
      });

      // Trim old events (keep only last 1 second)
      this.recentAnalyticsEvents = this.recentAnalyticsEvents.filter(
        (event) => now - event.timestamp < 1000
      );
    }

    return isDuplicate;
  }

  /**
   * Send analytics data to the appropriate endpoint
   * @param {Object} data - The analytics data to send
   */
  sendAnalyticsData(data) {
    try {
      // Always refresh session ID to ensure we have the latest
      this.initializeSessionId();

      // Extract the type from data before modifying
      const dataType = data.type;

      // Check for duplicate events
      if (this.isDuplicateEvent(dataType, data)) {
        console.debug(
          `Duplicate analytics event detected, ignoring: ${dataType}`
        );
        return;
      }

      // Debug logs for deep copy
      console.debug("Original data before deep copy:", data);

      // Create a deep copy to avoid modifying the original data
      const analyticsData = JSON.parse(JSON.stringify(data));

      console.debug("Deep copied data:", analyticsData);
      console.debug(
        "Is deep copy different from original:",
        data !== analyticsData
      );

      // Add session ID if available
      if (this.sessionId) {
        analyticsData.sessionId = this.sessionId;
      }

      // Format data and determine endpoint based on the event type
      let endpoint;
      let formattedData;

      // IMPORTANT: remove the type field since it's only used for routing
      // and is not expected by the backend endpoints
      delete analyticsData.type;

      // Format data for click tracking
      if (dataType === "click") {
        endpoint = `${this.config.proxyBaseUrl}/analytics/click`;

        // Make sure we have a valid query - try to recover if missing
        if (!analyticsData.originalQuery && !this.originalQuery) {
          // Try to recover from URL or input
          const urlParams = new URLSearchParams(window.location.search);
          const urlQuery = urlParams.get("query");

          if (urlQuery) {
            console.debug(
              "Core manager: Recovering missing originalQuery from URL:",
              urlQuery
            );
            this.originalQuery = urlQuery;
            analyticsData.originalQuery = urlQuery;
          } else {
            const searchInput = document.querySelector(
              this.config.searchInputSelector
            );
            if (searchInput && searchInput.value) {
              console.debug(
                "Core manager: Recovering missing originalQuery from input:",
                searchInput.value
              );
              this.originalQuery = searchInput.value;
              analyticsData.originalQuery = searchInput.value;
            }
          }
        }

        // Required fields for click endpoint - ensure backend field names are used
        formattedData = {
          originalQuery:
            analyticsData.originalQuery || this.originalQuery || "",
          clickedUrl: analyticsData.clickedUrl || analyticsData.url || "",
          clickedTitle: this.sanitizeValue(
            analyticsData.clickedTitle || analyticsData.title || ""
          ),
          clickPosition:
            analyticsData.clickPosition || analyticsData.position || 0,
          sessionId: analyticsData.sessionId || undefined,
          clickType: this.sanitizeValue(
            analyticsData.clickType || analyticsData.type || "search"
          ),
        };

        console.debug("Formatted click data:", {
          originalQuery: formattedData.originalQuery,
          clickedUrl: formattedData.clickedUrl,
          clickedTitle: formattedData.clickedTitle,
          clickPosition: formattedData.clickPosition,
          sessionId: formattedData.sessionId,
          clickType: formattedData.clickType,
        });

        // Validate source objects for debugging
        console.debug("Source objects for formatting:", {
          analyticsData_clickedUrl: analyticsData.clickedUrl,
          analyticsData_url: analyticsData.url,
          analyticsData_clickedTitle: analyticsData.clickedTitle,
          analyticsData_title: analyticsData.title,
          analyticsData_clickPosition: analyticsData.clickPosition,
          analyticsData_position: analyticsData.position,
          analyticsData_clickType: analyticsData.clickType,
          analyticsData_type: analyticsData.type,
        });

        // Field validation before sending (match backend requirements)
        if (!formattedData.originalQuery) {
          console.error(
            "Missing required field: originalQuery, cannot send click data"
          );
          return;
        }

        if (!formattedData.clickedUrl) {
          console.error(
            "Missing required field: clickedUrl, cannot send click data"
          );
          return;
        }

        // Log what we're sending to click endpoint
        console.log("Sending click data:", {
          endpoint,
          sessionId: formattedData.sessionId,
          originalQuery: formattedData.originalQuery,
          clickedUrl: formattedData.clickedUrl,
          clickPosition: formattedData.clickPosition,
        });
      }
      // Format data for batch click tracking
      else if (dataType === "batch") {
        endpoint = `${this.config.proxyBaseUrl}/analytics/clicks-batch`;

        // Format batch clicks data - ensure backend field names are used
        formattedData = {
          clicks: (analyticsData.clicks || [])
            .map((click) => {
              // Make sure we have a valid query for each click
              const query =
                click.originalQuery || click.query || this.originalQuery || "";

              return {
                originalQuery: query,
                clickedUrl: click.clickedUrl || click.url || "",
                clickedTitle: this.sanitizeValue(
                  click.clickedTitle || click.title || ""
                ),
                clickPosition: click.clickPosition || click.position || 0,
                sessionId: analyticsData.sessionId || undefined,
                clickType: this.sanitizeValue(
                  click.clickType || click.type || "search"
                ),
              };
            })
            .filter((click) => click.originalQuery && click.clickedUrl), // Filter out invalid clicks
        };

        // Validate clicks array
        if (!formattedData.clicks || formattedData.clicks.length === 0) {
          console.error("No valid clicks to send in batch");
          return;
        }

        console.log("Sending batch clicks:", {
          endpoint,
          clickCount: formattedData.clicks.length,
        });
      }
      // Format data for all other events (facet, tab, pagination, spelling)
      else {
        endpoint = `${this.config.proxyBaseUrl}/analytics/supplement`;

        // If query is missing, try to get it from core
        if (!analyticsData.query && this.originalQuery) {
          analyticsData.query = this.originalQuery;
        }

        // Format supplement data - use 'query' not 'originalQuery' for supplement endpoint
        formattedData = {
          query: this.sanitizeValue(
            analyticsData.query || this.originalQuery || ""
          ),
          sessionId: analyticsData.sessionId,
        };

        // Validate query
        if (!formattedData.query) {
          console.error(
            "Missing required field: query, cannot send supplement data"
          );
          return;
        }

        // Add enrichment data based on event type
        if (analyticsData.enrichmentData) {
          const enrichmentData = {};

          // Add common fields
          if (analyticsData.enrichmentData.actionType) {
            enrichmentData.actionType = this.sanitizeValue(
              analyticsData.enrichmentData.actionType
            );
          }

          if (analyticsData.enrichmentData.timestamp) {
            enrichmentData.timestamp = analyticsData.enrichmentData.timestamp;
          }

          // Add specific fields based on action type
          switch (dataType) {
            case "tab":
              if (analyticsData.enrichmentData.tabName) {
                enrichmentData.tabName = this.sanitizeValue(
                  analyticsData.enrichmentData.tabName
                );
              }
              break;

            case "facet":
              if (analyticsData.enrichmentData.facetName) {
                enrichmentData.facetName = this.sanitizeValue(
                  analyticsData.enrichmentData.facetName
                );
              }
              if (analyticsData.enrichmentData.facetValue) {
                enrichmentData.facetValue = this.sanitizeValue(
                  analyticsData.enrichmentData.facetValue
                );
              }
              if (analyticsData.enrichmentData.action) {
                enrichmentData.action = this.sanitizeValue(
                  analyticsData.enrichmentData.action
                );
              }
              break;

            case "pagination":
              if (analyticsData.enrichmentData.pageNumber !== undefined) {
                enrichmentData.pageNumber =
                  analyticsData.enrichmentData.pageNumber;
              }
              break;

            case "spelling":
              if (analyticsData.enrichmentData.suggestedQuery) {
                enrichmentData.suggestedQuery = this.sanitizeValue(
                  analyticsData.enrichmentData.suggestedQuery
                );
              }
              break;
          }

          // Add enrichment data to formatted data
          formattedData.enrichmentData = enrichmentData;
        }

        // Log what we're sending to supplement endpoint
        console.log("Sending supplement data:", {
          endpoint,
          query: formattedData.query,
          type: dataType,
          details: formattedData.enrichmentData,
        });
      }

      // Send the data using sendBeacon if available (works during page unload)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(formattedData)], {
          type: "application/json",
        });

        const success = navigator.sendBeacon(endpoint, blob);
        if (!success) {
          console.warn("sendBeacon failed, falling back to fetch");
          this.sendAnalyticsWithFetch(endpoint, formattedData);
        }
        return;
      }

      // Fallback to fetch with keepalive
      this.sendAnalyticsWithFetch(endpoint, formattedData);
    } catch (error) {
      console.error("Failed to send analytics data:", error);
    }
  }

  /**
   * Send analytics data using fetch API (fallback)
   * @param {string} endpoint - The API endpoint
   * @param {Object} data - The formatted data to send
   */
  sendAnalyticsWithFetch(endpoint, data) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: window.location.origin,
      },
      body: JSON.stringify(data),
      credentials: "include",
      keepalive: true,
      signal: controller.signal,
    })
      .then((response) => {
        clearTimeout(timeoutId);
        if (!response.ok) {
          return response.text().then((text) => {
            console.error(
              `Analytics request failed: ${response.status} ${response.statusText}`,
              text
            );
          });
        }
        console.log(`Analytics request successful: ${endpoint}`);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          console.error("Analytics request timed out after 5 seconds");
        } else {
          console.error("Error sending analytics data via fetch:", error);
        }
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
    Object.values(this.modules).forEach((module) => {
      if (typeof module.destroy === "function") {
        module.destroy();
      }
    });
  }
}

// Export as a singleton
const searchManager = new SearchManager();
export default searchManager;
