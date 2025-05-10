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
 * - IP resolution for accurate client tracking
 *
 * @author Victor Chimenti
 * @version 3.2.0
 * @license MIT
 * @lastModified 2025-05-10
 * 
 */
class SearchManager {
  constructor() {
    this.config = {
      proxyBaseUrl: "https://funnelback-proxy-dev.vercel.app/proxy",
      enabledModules: ["tabs", "facets", "pagination", "spelling", "analytics", "collapse"],
      observerConfig: {
        childList: true,
        subtree: true,
      },
      searchInputSelector: "#autocomplete-concierge-inputField",
      resultsContainerSelector: "#results",
      defaultResultsPerPage: 10,
      // IP resolution configuration
      enableIpTracking: true,
      ipMismatchThreshold: 3, // Max number of IP changes before forced session refresh
      analyticsEndpoints: {
        click: "/analytics/click",
        batch: "/analytics/clicks-batch",
        supplement: "/analytics/supplement",
        session: "/analytics/",
      },
    };

    // Module registry
    this.modules = {};

    // State
    this.sessionId = null;
    this.clientIp = null;
    this.originalQuery = null;
    this.isInitialized = false;
    this.lastIpCheckTime = 0;
  }

    // Module registry
    this.modules = {};

// State
this.sessionId = null;
this.clientIp = null;
this.originalQuery = null;
this.isInitialized = false;
this.lastIpCheckTime = 0;
  }

/**
 * Initialize the search manager with configuration
 * @param {Object} options - Configuration options
 */
init(options = {}) {
  // Prevent multiple initializations
  if (this.isInitialized) {
    return this;
  }

  // Merge configuration
  this.config = {
    ...this.config,
    ...options,
  };

  // Initialize if on search page
  if (window.location.pathname.includes("search")) {
    this.initialize();
    this.isInitialized = true;
  }

  return this;
}

  /**
   * Initialize the search manager and all enabled modules
   */
  async initialize() {
  // Initialize session and IP information
  await this.initializeSessionAndIp();

  // Extract query from URL or input
  this.extractOriginalQuery();

  // Set up observer for dynamic content
  this.initializeObserver();

  // Initialize modules
  await this.loadModules();

  // Start observing for DOM changes
  this.startObserving();

  // Single initialization message for production
  console.log("Seattle University Search initialized");
}

  /**
   * Initialize session ID and client IP using SessionService
   */
  async initializeSessionAndIp() {
  try {
    // Check if SessionService is available
    if (window.SessionService) {
      // Get session ID from SessionService - the single source of truth
      this.sessionId = window.SessionService.getSessionId();

      // Get IP information if enabled
      if (this.config.enableIpTracking) {
        // Try to get from SessionService first
        this.clientIp = window.SessionService.getSessionIp();

        if (!this.clientIp) {
          // If not available from SessionService, trigger a verification which will fetch it
          try {
            // Refresh the session to ensure we have IP information
            await this.refreshSessionIpInfo();
            this.clientIp = window.SessionService.getSessionIp();
          } catch (ipError) {
            // Silent error handling
          }
        }
      }
    } else {
      // Fallback if SessionService is not available
      this.sessionId = this.generateSessionId();

      if (this.config.enableIpTracking) {
        // Try to fetch IP directly if SessionService not available
        try {
          const clientInfo = await this.fetchClientIp();
          if (clientInfo && clientInfo.ip) {
            this.clientIp = clientInfo.ip;
          }
        } catch (ipError) {
          // Silent error handling
        }
      }
    }

    // Update last IP check time
    this.lastIpCheckTime = Date.now();
  } catch (error) {
    // Fallback to basic session ID for graceful degradation
    this.sessionId = this.generateSessionId();
  }
}

  /**
   * Refresh session IP information - called when needed
   * @returns {Promise<void>}
   */
  async refreshSessionIpInfo() {
  try {
    // Update last check time
    this.lastIpCheckTime = Date.now();

    if (window.SessionService) {
      // Use SessionService to refresh session with IP info
      await window.SessionService.initialize();
      this.sessionId = window.SessionService.getSessionId();
      this.clientIp = window.SessionService.getSessionIp();
    } else {
      // Direct fallback if SessionService not available
      try {
        const clientInfo = await this.fetchClientIp();
        if (clientInfo && clientInfo.ip) {
          this.clientIp = clientInfo.ip;
        }
      } catch (ipError) {
        // Silent error handling
      }
    }
  } catch (error) {
    // Silent error handling
  }
}

/**
 * Generate a new session ID (fallback if SessionService unavailable)
 * @returns {string} New session ID
 */
generateSessionId() {
  return (
    "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
  );
}

  /**
   * Fetch client IP directly from client-info API
   * @returns {Promise<Object>} Client IP information
   */
  async fetchClientIp() {
  try {
    const response = await fetch("/api/client-info");
    if (!response.ok) {
      throw new Error(`Failed to fetch client IP: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    // Silent error handling
    return null;
  }
}

/**
 * Mask IP address for logging (privacy)
 * @param {string} ip - IP address to mask
 * @returns {string} Masked IP address
 */
maskIp(ip) {
  if (!ip) return null;

  try {
    // IPv4 address
    if (ip.includes(".")) {
      const parts = ip.split(".");
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.*.*`;
      }
    }
    // IPv6 address
    else if (ip.includes(":")) {
      const parts = ip.split(":");
      if (parts.length > 2) {
        return `${parts[0]}:${parts[1]}:****:****`;
      }
    }

    // Unknown format, return first 4 chars followed by asterisks
    return ip.substring(0, 4) + "*".repeat(Math.max(0, ip.length - 4));
  } catch (error) {
    return "***.***.***";
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
      } catch (error) {
        // Silent error handling
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
  // Try to get query from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const urlQuery = urlParams.get("query");

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
  // If SessionService is available, always use that as source of truth
  if (window.SessionService) {
    const sessionId = window.SessionService.getSessionId();
    // Update our cached value
    if (sessionId) {
      this.sessionId = sessionId;
    }
    return sessionId;
  }

  // Fallback to our cached value
  return this.sessionId;
}

/**
 * Get client IP - should be called by modules rather than accessing this.clientIp directly
 * @returns {string|null} Client IP or null if unavailable
 */
getClientIp() {
  // If not enabled, return null
  if (!this.config.enableIpTracking) {
    return null;
  }

  // If SessionService is available, always use that as source of truth
  if (window.SessionService) {
    const clientIp = window.SessionService.getSessionIp();
    // Update our cached value
    if (clientIp) {
      this.clientIp = clientIp;
    }
    return clientIp;
  }

  // Fallback to our cached value
  return this.clientIp;
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
  } else {
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

    // Ensure we have the latest session ID and client IP
    await this.checkAndRefreshIdentifiers();

    // Process based on request type
    switch (type) {
      case "search":
        // Extract query string
        queryString = url.includes("?") ? url.split("?")[1] : "";

        // Parse and sanitize query parameters
        const searchParams = new URLSearchParams(queryString);

        // Remove any existing sessionId and clientIp parameters
        searchParams.delete("sessionId");
        searchParams.delete("clientIp");

        // Add our canonical sessionId
        const sessionId = this.getSessionId();
        if (sessionId) {
          searchParams.append("sessionId", sessionId);
        }

        // Add client IP if available and enabled
        const clientIp = this.getClientIp();
        if (this.config.enableIpTracking && clientIp) {
          searchParams.append("clientIp", clientIp);
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

        // Add session ID if available
        const toolsSessionId = this.getSessionId();
        if (toolsSessionId) {
          toolsParams.append("sessionId", toolsSessionId);
        }

        // Add client IP if available and enabled
        const toolsClientIp = this.getClientIp();
        if (this.config.enableIpTracking && toolsClientIp) {
          toolsParams.append("clientIp", toolsClientIp);
        }

        // Construct the full URL
        fullUrl = `${endpoint}?${toolsParams.toString()}`;
        break;

      case "spelling":
        // Extract query string
        queryString = url.includes("?") ? url.split("?")[1] : "";

        // Parse parameters
        const spellingParams = new URLSearchParams(queryString);

        // Remove any existing sessionId and clientIp parameters
        spellingParams.delete("sessionId");
        spellingParams.delete("clientIp");

        // Add our canonical sessionId
        const spellingSessionId = this.getSessionId();
        if (spellingSessionId) {
          spellingParams.append("sessionId", spellingSessionId);
        }

        // Add client IP if available and enabled
        const spellingClientIp = this.getClientIp();
        if (this.config.enableIpTracking && spellingClientIp) {
          spellingParams.append("clientIp", spellingClientIp);
        }

        // Construct the full URL
        fullUrl = `${endpoint}?${spellingParams.toString()}`;
        break;

      default:
        throw new Error(`Unknown request type: ${type}`);
    }

    const response = await fetch(fullUrl);

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    // Silent error handling
    return `<p>Error fetching ${type} request. Please try again later.</p>`;
  }
}

  /**
   * Check and refresh session ID and client IP if necessary
   * @returns {Promise<void>}
   */
  async checkAndRefreshIdentifiers() {
  // Check if we need to refresh IP information (once per hour)
  const now = Date.now();
  const timeSinceLastCheck = now - this.lastIpCheckTime;

  if (this.config.enableIpTracking && timeSinceLastCheck > 60 * 60 * 1000) {
    await this.refreshSessionIpInfo();
  }
}

/**
 * Mask a string for logging (for privacy)
 * @param {string} str - String to mask
 * @returns {string} Masked string
 */
maskString(str) {
  if (!str) return "null";
  if (str.length <= 8) return str;

  return (
    str.substring(0, 4) +
    "*".repeat(str.length - 8) +
    str.substring(str.length - 4)
  );
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
        <div id="funnelback-search-container-response" class="funnelback-search-container">
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
 * Send analytics data to the appropriate endpoint
 * @param {Object} data - The analytics data to send
 */
sendAnalyticsData(data) {
  try {
    // Ensure we have the latest session ID and client IP
    // No await here as we don't want to block analytics
    this.checkAndRefreshIdentifiers().catch(() => {
      // Silent error handling
    });

    // Create a deep copy of the data to modify
    const analyticsData = JSON.parse(JSON.stringify(data));

    // Only include sessionId if available
    const sessionId = this.getSessionId();
    if (sessionId) {
      analyticsData.sessionId = sessionId;
    }

    // Add client IP if available and enabled
    const clientIp = this.getClientIp();
    if (this.config.enableIpTracking && clientIp) {
      analyticsData.clientIp = clientIp;
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
    if (dataType === "click") {
      // Format data for click endpoint
      endpoint = `${this.config.proxyBaseUrl}${this.config.analyticsEndpoints.click}`;

      // Convert from originalQuery to query if needed
      if (analyticsData.originalQuery && !analyticsData.query) {
        analyticsData.query = analyticsData.originalQuery;
        delete analyticsData.originalQuery;
      }

      // Ensure required fields for click endpoint in a flat structure
      formattedData = {
        originalQuery:
          analyticsData.originalQuery ||
          analyticsData.query ||
          this.originalQuery ||
          "",
        clickedUrl: analyticsData.clickedUrl || analyticsData.url || "",
        clickedTitle: analyticsData.clickedTitle || analyticsData.title || "",
        clickPosition:
          analyticsData.clickPosition || analyticsData.position || -1,
        sessionId: analyticsData.sessionId || undefined,
        timestamp: analyticsData.timestamp,
        clickType: analyticsData.clickType || "search",
        // Add client IP if available
        ...(analyticsData.clientIp
          ? { clientIp: analyticsData.clientIp }
          : {}),
      };

      // Sanitize all string values
      formattedData.originalQuery = this.sanitizeValue(
        formattedData.originalQuery
      );
      formattedData.clickedUrl = this.sanitizeValue(formattedData.clickedUrl);
      formattedData.clickedTitle = this.sanitizeValue(
        formattedData.clickedTitle
      );
      formattedData.clickType = this.sanitizeValue(formattedData.clickType);
    } else if (dataType === "batch") {
      // Format data for batch clicks endpoint
      endpoint = `${this.config.proxyBaseUrl}${this.config.analyticsEndpoints.batch}`;

      // Format batch data for clicks-batch endpoint
      formattedData = {
        clicks: (analyticsData.clicks || []).map((click) => {
          const formattedClick = {
            originalQuery:
              click.originalQuery || click.query || this.originalQuery || "",
            clickedUrl: click.clickedUrl || click.url || "",
            clickedTitle: click.clickedTitle || click.title || "",
            clickPosition: click.clickPosition || click.position || -1,
            sessionId: sessionId || undefined,
            timestamp: click.timestamp || analyticsData.timestamp,
            clickType: click.clickType || "search",
            // Add client IP if available
            ...(clientIp ? { clientIp: clientIp } : {}),
          };

          // Sanitize all string values
          formattedClick.originalQuery = this.sanitizeValue(
            formattedClick.originalQuery
          );
          formattedClick.clickedUrl = this.sanitizeValue(
            formattedClick.clickedUrl
          );
          formattedClick.clickedTitle = this.sanitizeValue(
            formattedClick.clickedTitle
          );
          formattedClick.clickType = this.sanitizeValue(
            formattedClick.clickType
          );

          return formattedClick;
        }),
      };
    } else {
      // For all other types (facet, pagination, tab, spelling), use supplement endpoint
      endpoint = `${this.config.proxyBaseUrl}${this.config.analyticsEndpoints.supplement}`;

      // For supplement endpoint, make sure we're using query (not originalQuery)
      // and include enrichmentData as expected by the backend
      if (analyticsData.originalQuery && !analyticsData.query) {
        analyticsData.query = analyticsData.originalQuery;
        delete analyticsData.originalQuery;
      }

      // Ensure we have a valid query
      if (!analyticsData.query) {
        analyticsData.query = this.originalQuery || "";
      }

      // Sanitize query
      analyticsData.query = this.sanitizeValue(analyticsData.query);

      // Create a properly formatted object for supplement endpoint
      formattedData = {
        query: analyticsData.query,
        sessionId: analyticsData.sessionId,
        // Add client IP if available
        ...(analyticsData.clientIp
          ? { clientIp: analyticsData.clientIp }
          : {}),
      };

      // Add resultCount if provided
      if (analyticsData.resultCount !== undefined) {
        formattedData.resultCount = analyticsData.resultCount;
      }

      // Process enrichmentData if provided
      if (analyticsData.enrichmentData) {
        // Create a clean enrichmentData object
        const cleanEnrichmentData = {};

        // Copy actionType
        if (analyticsData.enrichmentData.actionType) {
          cleanEnrichmentData.actionType = this.sanitizeValue(
            analyticsData.enrichmentData.actionType
          );
        }

        // For tab changes, only include tabName (not tabId)
        if (
          cleanEnrichmentData.actionType === "tab" &&
          analyticsData.enrichmentData.tabName
        ) {
          cleanEnrichmentData.tabName = this.sanitizeValue(
            analyticsData.enrichmentData.tabName
          );
        }

        // For facet selections
        if (cleanEnrichmentData.actionType === "facet") {
          if (analyticsData.enrichmentData.facetName) {
            cleanEnrichmentData.facetName = this.sanitizeValue(
              analyticsData.enrichmentData.facetName
            );
          }
          if (analyticsData.enrichmentData.facetValue) {
            cleanEnrichmentData.facetValue = this.sanitizeValue(
              analyticsData.enrichmentData.facetValue
            );
          }
          if (analyticsData.enrichmentData.action) {
            cleanEnrichmentData.action = this.sanitizeValue(
              analyticsData.enrichmentData.action
            );
          }
        }

        // For pagination
        if (
          cleanEnrichmentData.actionType === "pagination" &&
          analyticsData.enrichmentData.pageNumber !== undefined
        ) {
          cleanEnrichmentData.pageNumber =
            analyticsData.enrichmentData.pageNumber;
        }

        // For spelling suggestions
        if (
          cleanEnrichmentData.actionType === "spelling" &&
          analyticsData.enrichmentData.suggestedQuery
        ) {
          cleanEnrichmentData.suggestedQuery = this.sanitizeValue(
            analyticsData.enrichmentData.suggestedQuery
          );
        }

        // Include timestamp if provided
        if (analyticsData.enrichmentData.timestamp) {
          cleanEnrichmentData.timestamp =
            analyticsData.enrichmentData.timestamp;
        }

        // Add the cleaned enrichmentData to formattedData
        formattedData.enrichmentData = cleanEnrichmentData;
      }
    }

    // Send the data using sendBeacon if available (works during page unload)
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(formattedData)], {
        type: "application/json",
      });

      const success = navigator.sendBeacon(endpoint, blob);
      if (!success) {
        this.sendAnalyticsWithFetch(endpoint, formattedData);
      }
      return;
    }

    // Fallback to fetch with keepalive
    this.sendAnalyticsWithFetch(endpoint, formattedData);
  } catch (error) {
    // Silent error handling
  }
}

/**
 * Send analytics data using fetch API (fallback) with detailed error handling
 * @param {string} endpoint - The API endpoint
 * @param {Object} data - The formatted data to send
 */
sendAnalyticsWithFetch(endpoint, data) {
  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: window.location.origin,
    },
    body: JSON.stringify(data),
    credentials: "include",
    keepalive: true,
  }).catch(() => {
    // Silent error handling
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
