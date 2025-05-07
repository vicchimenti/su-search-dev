/**
 * @fileoverview Enhanced Session ID Management Service with Redirect Optimization
 *
 * This module provides centralized session ID management for the search API.
 * It serves as a single source of truth for session IDs across the application.
 * Includes IP tracking capabilities and special optimizations for search page redirects.
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 3.2.0
 * @lastModified 2025-05-07
 */

/**
 * SessionService - Manages session IDs and IP tracking across the application
 * with optimized handling for search redirects
 */
const SessionService = {
  // Configuration constants
  SESSION_ID_KEY: "searchSessionId",
  SESSION_IP_KEY: "searchSessionIp",
  SESSION_EXPIRY_KEY: "searchSessionExpiry",
  SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
  IP_CHECK_THRESHOLD: 24 * 60 * 60 * 1000, // 24 hours (increased from 1 hour)
  IP_MISMATCH_LIMIT: 3, // Maximum number of IP changes before forcing a new session
  SESSION_REDIRECT_FLAG: "searchRedirectInProgress",
  SESSION_READY_FLAG: "searchSessionReady",
  IP_LAST_FETCH_TIME: "searchIpLastFetchTime",
  LAST_SEARCH_QUERY_KEY: "lastSearchQuery", // Key to store the last query

  // Logging configuration
  LOG_LEVELS: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  },

  // Default log level
  _logLevel: 2, // INFO level by default

  // Internal state
  _lastKnownIp: null,
  _ipMismatchCount: 0,
  _lastIpCheckTime: 0,
  _initializationPromise: null,
  _isRedirectOptimizationEnabled: true,
  _pendingInitialization: false,

  /**
   * Log a message with the appropriate level
   * @param {string} message - The message to log
   * @param {number} level - The log level (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG)
   * @param {any} [data] - Optional data to include
   */
  log: function (message, level, data) {
    if (level > this._logLevel) return;

    const prefix = this._getLogPrefix(level);

    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  },

  /**
   * Get the prefix for a log message based on level
   * @private
   * @param {number} level - The log level
   * @returns {string} The prefix
   */
  _getLogPrefix: function (level) {
    switch (level) {
      case 0:
        return "[SessionService-ERROR]";
      case 1:
        return "[SessionService-WARN]";
      case 2:
        return "[SessionService-INFO]";
      case 3:
        return "[SessionService-DEBUG]";
      default:
        return "[SessionService]";
    }
  },

  /**
   * Set the log level
   * @param {number} level - The log level to set
   */
  setLogLevel: function (level) {
    this._logLevel = level;
    this.log(`Log level set to ${level}`, 2);
  },

  /**
   * Initialize session service with redirect optimization
   * When coming from a search redirect, uses optimized path to avoid redundant operations
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  initialize: async function () {
    // Prevent multiple concurrent initializations
    if (this._pendingInitialization) {
      return this._initializationPromise;
    }

    this._pendingInitialization = true;
    this._initializationPromise = this._performInitialization();

    try {
      await this._initializationPromise;
    } finally {
      this._pendingInitialization = false;
    }

    return this._initializationPromise;
  },

  /**
   * Internal implementation of initialization with redirect optimization
   * @private
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  _performInitialization: async function () {
    try {
      // Check if we're coming from a search redirect
      const isSearchRedirect = this._detectSearchRedirect();

      this.log(
        `Initializing. Redirect detected: ${isSearchRedirect}`,
        this.LOG_LEVELS.INFO
      );

      // Get existing session data
      const sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
      const expiryStr = sessionStorage.getItem(this.SESSION_EXPIRY_KEY);
      const storedIp = sessionStorage.getItem(this.SESSION_IP_KEY);
      const now = Date.now();

      // Set internal state from storage
      if (storedIp) {
        this._lastKnownIp = storedIp;
      }

      // If we're coming from a search redirect and have valid session data,
      // take the fast path for performance
      if (
        isSearchRedirect &&
        sessionId &&
        expiryStr &&
        parseInt(expiryStr) > now
      ) {
        // Mark that we've handled the redirect
        this._clearRedirectFlag();

        // Only update expiry without full initialization
        this._extendSessionExpiry();

        // Schedule non-blocking IP verification for later
        this._scheduleBackgroundIpCheck();

        this.log(
          `Used fast path optimization for redirect. SessionId: ${this._maskString(
            sessionId
          )}`,
          this.LOG_LEVELS.INFO
        );
        return;
      }

      // Standard initialization path follows

      // If session is expired or doesn't exist, create a new one
      if (!sessionId || !expiryStr || parseInt(expiryStr) < now) {
        await this._createNewSession();
        return;
      }

      // Session exists and is valid, check IP if needed
      const ipLastFetchTimeStr = sessionStorage.getItem(
        this.IP_LAST_FETCH_TIME
      );
      const ipLastFetchTime = ipLastFetchTimeStr
        ? parseInt(ipLastFetchTimeStr)
        : 0;
      const timeSinceLastIpFetch = now - ipLastFetchTime;

      if (timeSinceLastIpFetch > this.IP_CHECK_THRESHOLD) {
        await this._verifyClientIp();
      }
    } catch (error) {
      // Ensure a valid session ID is available even if initialization fails
      if (!sessionStorage.getItem(this.SESSION_ID_KEY)) {
        this._setBasicSession();
      }

      this.log(`Initialization error: ${error.message}`, this.LOG_LEVELS.ERROR);
    }
  },

  /**
   * Schedule a non-blocking IP verification for background processing
   * @private
   */
  _scheduleBackgroundIpCheck: function () {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        this._verifyClientIp().catch((error) => {
          this.log(
            `Background IP check error: ${error.message}`,
            this.LOG_LEVELS.ERROR
          );
        });
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        this._verifyClientIp().catch((error) => {
          this.log(
            `Background IP check error: ${error.message}`,
            this.LOG_LEVELS.ERROR
          );
        });
      }, 5000); // 5 second delay
    }
  },

  /**
   * Detect if this page load is part of a search redirect
   * @private
   * @returns {boolean} True if this is a search redirect
   */
  _detectSearchRedirect: function () {
    // Check storage for redirect flag
    const redirectFlag = sessionStorage.getItem(this.SESSION_REDIRECT_FLAG);

    // Check URL for search-related parameters
    const isSearchPage = window.location.pathname.includes("search-test");
    const hasQueryParam = new URLSearchParams(window.location.search).has(
      "query"
    );

    const isRedirect = redirectFlag === "true" && isSearchPage && hasQueryParam;

    if (isRedirect) {
      this.log("Detected search redirect", this.LOG_LEVELS.INFO);
    }

    return isRedirect;
  },

  /**
   * Clear the redirect flag after handling
   * @private
   */
  _clearRedirectFlag: function () {
    sessionStorage.removeItem(this.SESSION_REDIRECT_FLAG);
    this.log("Cleared redirect flag", this.LOG_LEVELS.INFO);
  },

  /**
   * Set the redirect flag before performing a search redirect
   * This prepares the session service for an optimized initialization
   * on the search results page
   *
   * @param {string} query - The search query being used for the redirect
   * @returns {boolean} Whether the preparation was successful
   */
  prepareForSearchRedirect: function (query) {
    try {
      this.log(
        `Preparing for search redirect. Query: ${query}`,
        this.LOG_LEVELS.INFO
      );

      // Ensure session is valid and ready before redirect
      this._ensureValidSession();

      // Set the redirect flag
      sessionStorage.setItem(this.SESSION_REDIRECT_FLAG, "true");

      // Store the search query for fast access on results page
      if (query) {
        sessionStorage.setItem(this.LAST_SEARCH_QUERY_KEY, query);
        this.log(`Stored search query: ${query}`, this.LOG_LEVELS.DEBUG);
      }

      // Update the session ready flag
      sessionStorage.setItem(this.SESSION_READY_FLAG, "true");

      // Extend expiry to ensure session stays valid during redirect
      this._extendSessionExpiry();

      // Log session preparation for analytics
      this._logSessionEvent("redirect_prepared", {
        sessionId: this.getSessionId(),
        query: query,
      });

      return true;
    } catch (error) {
      this.log(
        `Error preparing for redirect: ${error.message}`,
        this.LOG_LEVELS.ERROR
      );
      return false;
    }
  },

  /**
   * Get the last search query if stored from a redirect
   * @returns {string|null} The last search query or null if not available
   */
  getLastSearchQuery: function () {
    try {
      const query = sessionStorage.getItem(this.LAST_SEARCH_QUERY_KEY);
      if (query) {
        this.log(
          `Retrieved last search query: ${query}`,
          this.LOG_LEVELS.DEBUG
        );
      }
      return query;
    } catch (e) {
      this.log(
        `Error retrieving last search query: ${e.message}`,
        this.LOG_LEVELS.ERROR
      );
      return null;
    }
  },

  /**
   * Clear the last search query from storage
   * Call this after using the query to avoid stale data
   */
  clearLastSearchQuery: function () {
    try {
      sessionStorage.removeItem(this.LAST_SEARCH_QUERY_KEY);
      this.log("Cleared last search query", this.LOG_LEVELS.INFO);
    } catch (e) {
      this.log(
        `Error clearing last search query: ${e.message}`,
        this.LOG_LEVELS.ERROR
      );
    }
  },

  /**
   * Ensure we have a valid session before redirect
   * @private
   */
  _ensureValidSession: function () {
    const sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
    if (!sessionId) {
      const newId = this.generateSessionId();
      this._setBasicSession(newId);
      this.log(
        `Created new session for redirect: ${this._maskString(newId)}`,
        this.LOG_LEVELS.INFO
      );
    }
  },

  /**
   * Extend the current session expiry time
   * @private
   */
  _extendSessionExpiry: function () {
    const now = Date.now();
    const newExpiry = now + this.SESSION_DURATION;
    sessionStorage.setItem(this.SESSION_EXPIRY_KEY, newExpiry.toString());
    this.log(
      `Extended session expiry to: ${new Date(newExpiry).toISOString()}`,
      this.LOG_LEVELS.DEBUG
    );
  },

  /**
   * Generate a new session ID
   * @returns {string} A unique session ID
   */
  generateSessionId: function () {
    return (
      "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
    );
  },

  /**
   * Get the current session ID - ensure's initialization completes first if needed
   * This is the primary method other components should use
   * @returns {string} The current session ID
   */
  getSessionId: function () {
    try {
      let sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);

      if (!sessionId) {
        sessionId = this.generateSessionId();
        this._setBasicSession(sessionId);
        this.log(
          `Created new session on getSessionId: ${this._maskString(sessionId)}`,
          this.LOG_LEVELS.INFO
        );
      }

      // If we're not already initializing, trigger a background initialization
      if (
        !this._pendingInitialization &&
        !sessionStorage.getItem(this.SESSION_READY_FLAG)
      ) {
        this.initialize().catch((error) => {
          this.log(
            `Background initialization error: ${error.message}`,
            this.LOG_LEVELS.ERROR
          );
        });
      }

      return sessionId;
    } catch (e) {
      // Fallback if sessionStorage is unavailable (e.g., private browsing)
      const fallbackId = this.generateSessionId();
      this.log(
        `Using fallback session ID due to error: ${e.message}`,
        this.LOG_LEVELS.WARN
      );
      this.log(
        `Fallback ID: ${this._maskString(fallbackId)}`,
        this.LOG_LEVELS.DEBUG
      );
      return fallbackId;
    }
  },

  /**
   * Get the IP address associated with the current session
   * Uses cached IP to avoid redundant API calls
   * @returns {string|null} The current IP address or null if not available
   */
  getSessionIp: function () {
    try {
      // First check instance variable for fastest access
      if (this._lastKnownIp) {
        return this._lastKnownIp;
      }

      // Then check sessionStorage
      const storedIp = sessionStorage.getItem(this.SESSION_IP_KEY);
      if (storedIp) {
        this._lastKnownIp = storedIp;
        return storedIp;
      }

      // Schedule a background IP check if we don't have one
      this._scheduleBackgroundIpCheck();

      return null;
    } catch (e) {
      this.log(`Error getting session IP: ${e.message}`, this.LOG_LEVELS.ERROR);
      return null;
    }
  },

  /**
   * Force creation of a new session ID and refresh IP information
   * @returns {Promise<string>} A promise that resolves with the new session ID
   */
  refreshSession: async function () {
    try {
      this.log("Explicitly refreshing session", this.LOG_LEVELS.INFO);

      await this._createNewSession();
      return sessionStorage.getItem(this.SESSION_ID_KEY);
    } catch (e) {
      this.log(`Error refreshing session: ${e.message}`, this.LOG_LEVELS.ERROR);
      const fallbackId = this.generateSessionId();
      this._setBasicSession(fallbackId);
      return fallbackId;
    }
  },

  /**
   * Add session ID to a URL if it doesn't already have one
   * @param {string} url - The URL to add the session ID to
   * @returns {string} URL with session ID parameter
   */
  addSessionIdToUrl: function (url) {
    if (!url) return url;

    try {
      const sessionId = this.getSessionId();
      const urlObj = new URL(url, window.location.origin);

      // Check if URL already has a sessionId parameter
      if (!urlObj.searchParams.has("sessionId")) {
        urlObj.searchParams.append("sessionId", sessionId);
      }

      return urlObj.toString();
    } catch (e) {
      this.log(
        `Error adding session ID to URL: ${e.message}`,
        this.LOG_LEVELS.ERROR
      );
      return url; // Return original URL if there's an error
    }
  },

  /**
   * Normalize a URL to ensure it has exactly one session ID parameter
   * @param {string} url - The URL to normalize
   * @returns {string} Normalized URL with exactly one session ID
   */
  normalizeUrl: function (url) {
    if (!url) return url;

    try {
      const sessionId = this.getSessionId();
      const urlObj = new URL(url, window.location.origin);

      // Remove all sessionId parameters
      const params = urlObj.searchParams;
      const allParams = Array.from(params.entries());

      // Create a new URLSearchParams object without sessionId parameters
      const newParams = new URLSearchParams();

      for (const [key, value] of allParams) {
        if (key !== "sessionId") {
          newParams.append(key, value);
        }
      }

      // Add the canonical session ID
      newParams.append("sessionId", sessionId);

      // Replace the search parameters
      urlObj.search = newParams.toString();

      return urlObj.toString();
    } catch (e) {
      this.log(`Error normalizing URL: ${e.message}`, this.LOG_LEVELS.ERROR);
      return url; // Return original URL if there's an error
    }
  },

  /**
   * Add session ID to data object for API requests
   * @param {Object} data - The data object to add the session ID to
   * @returns {Object} Data with session ID added
   */
  addSessionIdToData: function (data) {
    const result = Object.assign({}, data);
    result.sessionId = this.getSessionId();

    // Optionally include IP if available
    const ip = this.getSessionIp();
    if (ip) {
      result.clientIp = ip;
    }

    return result;
  },

  /**
   * Get diagnostic information about the current session
   * @returns {Object} Session diagnostic information
   */
  getSessionInfo: function () {
    try {
      const sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
      const expiryStr = sessionStorage.getItem(this.SESSION_EXPIRY_KEY);
      const expiry = expiryStr ? parseInt(expiryStr) : 0;
      const now = Date.now();
      const isRedirectOptimized =
        sessionStorage.getItem(this.SESSION_REDIRECT_FLAG) === "true";
      const lastSearchQuery = sessionStorage.getItem(
        this.LAST_SEARCH_QUERY_KEY
      );

      return {
        sessionId: this._maskString(sessionId),
        hasSession: !!sessionId,
        timeRemaining: Math.max(0, expiry - now),
        expiresAt: expiry ? new Date(expiry).toISOString() : null,
        lastKnownIp: this._maskIp(this.getSessionIp()),
        ipMismatchCount: this._ipMismatchCount,
        lastIpCheckTime: this._lastIpCheckTime
          ? new Date(this._lastIpCheckTime).toISOString()
          : null,
        isRedirectOptimized: isRedirectOptimized,
        redirectOptimizationEnabled: this._isRedirectOptimizationEnabled,
        hasStoredQuery: !!lastSearchQuery,
        lastSearchQuery: lastSearchQuery,
        logLevel: {
          current: this._getLogLevelName(this._logLevel),
          value: this._logLevel,
        },
      };
    } catch (e) {
      this.log(
        `Error getting session info: ${e.message}`,
        this.LOG_LEVELS.ERROR
      );
      return {
        sessionId: this._maskString(this.getSessionId()),
        hasSession: true,
        error: e.message,
      };
    }
  },

  /**
   * Get the name of a log level
   * @private
   * @param {number} level - The log level
   * @returns {string} The name of the log level
   */
  _getLogLevelName: function (level) {
    switch (level) {
      case 0:
        return "ERROR";
      case 1:
        return "WARN";
      case 2:
        return "INFO";
      case 3:
        return "DEBUG";
      default:
        return "UNKNOWN";
    }
  },

  /**
   * Enable or disable redirect optimization
   * @param {boolean} enabled - Whether to enable redirect optimization
   */
  setRedirectOptimization: function (enabled) {
    this._isRedirectOptimizationEnabled = !!enabled;
    this.log(
      `Redirect optimization ${enabled ? "enabled" : "disabled"}`,
      this.LOG_LEVELS.INFO
    );
  },

  /**
   * Mask an IP address for logging (privacy)
   * @private
   * @param {string} ip - IP address to mask
   * @returns {string} Masked IP address
   */
  _maskIp: function (ip) {
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
      this.log(`Error masking IP: ${error.message}`, this.LOG_LEVELS.ERROR);
      return "***.***.***";
    }
  },

  /**
   * Mask a string for logging (for privacy)
   * @private
   * @param {string} str - String to mask
   * @returns {string} Masked string
   */
  _maskString: function (str) {
    if (!str) return "null";
    if (str.length <= 8) return str;

    return (
      str.substring(0, 4) +
      "*".repeat(str.length - 8) +
      str.substring(str.length - 4)
    );
  },

  /**
   * Create a new session with full IP information
   * Uses a more efficient IP fetching strategy
   * @private
   * @returns {Promise<void>} Promise that resolves when session is created
   */
  _createNewSession: async function () {
    try {
      // Generate new session ID
      const sessionId = this.generateSessionId();

      // Set basic session properties
      const now = Date.now();
      const expiry = now + this.SESSION_DURATION;
      sessionStorage.setItem(this.SESSION_ID_KEY, sessionId);
      sessionStorage.setItem(this.SESSION_EXPIRY_KEY, expiry.toString());
      sessionStorage.setItem(this.SESSION_READY_FLAG, "true");

      // Reset IP mismatch counter
      this._ipMismatchCount = 0;

      // Check if we already have a cached IP before making an API call
      const cachedIp = sessionStorage.getItem(this.SESSION_IP_KEY);
      if (cachedIp && this._isRecentIpFetch()) {
        // Use cached IP if it's recent
        this._lastKnownIp = cachedIp;
        this.log(
          `Using cached IP: ${this._maskIp(cachedIp)}`,
          this.LOG_LEVELS.INFO
        );
      } else {
        // Get current client IP
        const clientInfo = await this._fetchClientIp();
        if (clientInfo && clientInfo.ip) {
          this._lastKnownIp = clientInfo.ip;
          sessionStorage.setItem(this.SESSION_IP_KEY, clientInfo.ip);
          sessionStorage.setItem(this.IP_LAST_FETCH_TIME, now.toString());
          this.log(
            `Fetched new IP: ${this._maskIp(clientInfo.ip)}`,
            this.LOG_LEVELS.INFO
          );
        }
      }

      // Update last IP check time
      this._lastIpCheckTime = now;

      // Log session creation for analytics
      this._logSessionEvent("created", {
        sessionId: sessionId,
        ip: this._lastKnownIp,
      });
    } catch (error) {
      // Set basic session as fallback
      this._setBasicSession();
      this.log(
        `Error creating new session: ${error.message}`,
        this.LOG_LEVELS.ERROR
      );
    }
  },

  /**
   * Check if the last IP fetch was recent enough to be trusted
   * @private
   * @returns {boolean} Whether the last IP fetch was recent
   */
  _isRecentIpFetch: function () {
    const now = Date.now();
    const ipLastFetchTimeStr = sessionStorage.getItem(this.IP_LAST_FETCH_TIME);

    if (!ipLastFetchTimeStr) {
      return false;
    }

    const ipLastFetchTime = parseInt(ipLastFetchTimeStr);
    const timeSinceLastIpFetch = now - ipLastFetchTime;

    return timeSinceLastIpFetch < this.IP_CHECK_THRESHOLD;
  },

  /**
   * Set a basic session ID without IP information (fallback)
   * @private
   * @param {string} [sessionId] - Optional session ID to use
   */
  _setBasicSession: function (sessionId) {
    try {
      const id = sessionId || this.generateSessionId();
      const expiry = Date.now() + this.SESSION_DURATION;

      sessionStorage.setItem(this.SESSION_ID_KEY, id);
      sessionStorage.setItem(this.SESSION_EXPIRY_KEY, expiry.toString());
      sessionStorage.setItem(this.SESSION_READY_FLAG, "true");

      this.log(
        `Set basic session: ${this._maskString(id)}`,
        this.LOG_LEVELS.INFO
      );
    } catch (error) {
      this.log(
        `Error setting basic session: ${error.message}`,
        this.LOG_LEVELS.ERROR
      );
    }
  },

  /**
   * Verify that the client's current IP matches stored IP
   * Non-blocking implementation that can run in background
   * @private
   * @returns {Promise<void>} Promise that resolves when verification is complete
   */
  _verifyClientIp: async function () {
    try {
      // Update last check time immediately to prevent multiple checks
      this._lastIpCheckTime = Date.now();

      // Get current client IP
      const clientInfo = await this._fetchClientIp();
      if (!clientInfo || !clientInfo.ip) {
        this.log(
          "Failed to fetch client IP for verification",
          this.LOG_LEVELS.WARN
        );
        return;
      }

      // Store the IP fetch time
      sessionStorage.setItem(this.IP_LAST_FETCH_TIME, Date.now().toString());

      const currentIp = clientInfo.ip;
      const previousIp =
        this._lastKnownIp || sessionStorage.getItem(this.SESSION_IP_KEY);

      if (previousIp && currentIp !== previousIp) {
        // IP has changed
        this._ipMismatchCount++;

        // Log IP change for analytics
        this._logSessionEvent("ip_changed", {
          previousIp: this._maskIp(previousIp),
          currentIp: this._maskIp(currentIp),
          mismatchCount: this._ipMismatchCount,
        });

        this.log(
          `IP changed from ${this._maskIp(previousIp)} to ${this._maskIp(
            currentIp
          )}`,
          this.LOG_LEVELS.INFO
        );

        // Update stored IP
        this._lastKnownIp = currentIp;
        sessionStorage.setItem(this.SESSION_IP_KEY, currentIp);

        // If too many IP changes, create new session
        if (this._ipMismatchCount >= this.IP_MISMATCH_LIMIT) {
          this.log(
            `IP mismatch limit reached (${this._ipMismatchCount}), creating new session`,
            this.LOG_LEVELS.INFO
          );
          await this._createNewSession();
        }
      } else if (!previousIp) {
        // No previous IP, just store current one
        this._lastKnownIp = currentIp;
        sessionStorage.setItem(this.SESSION_IP_KEY, currentIp);
        this.log(
          `Stored initial IP: ${this._maskIp(currentIp)}`,
          this.LOG_LEVELS.INFO
        );
      }
    } catch (error) {
      this.log(
        `Error verifying client IP: ${error.message}`,
        this.LOG_LEVELS.ERROR
      );
    }
  },

  /**
   * Fetch the client's IP address from the client-info API
   * Uses caching to minimize API calls
   * @private
   * @returns {Promise<Object|null>} Promise that resolves with client info or null if error
   */
  _fetchClientIp: async function () {
    try {
      // Check if we can use a cached value
      const cachedIp =
        this._lastKnownIp || sessionStorage.getItem(this.SESSION_IP_KEY);
      const ipLastFetchTimeStr = sessionStorage.getItem(
        this.IP_LAST_FETCH_TIME
      );

      if (cachedIp && ipLastFetchTimeStr) {
        const ipLastFetchTime = parseInt(ipLastFetchTimeStr);
        const now = Date.now();
        const timeSinceLastIpFetch = now - ipLastFetchTime;

        // If we have a recent cached IP, use it instead of making an API call
        if (timeSinceLastIpFetch < this.IP_CHECK_THRESHOLD) {
          this.log(
            `Using cached IP: ${this._maskIp(cachedIp)}`,
            this.LOG_LEVELS.DEBUG
          );
          return { ip: cachedIp, source: "cache" };
        }
      }

      // Make API call if no recent cache exists
      const fetchController = new AbortController();
      const timeoutId = setTimeout(() => fetchController.abort(), 3000); // 3 second timeout

      try {
        this.log("Fetching client IP from API", this.LOG_LEVELS.INFO);

        const response = await fetch(
          "https://su-search-dev.vercel.app/api/client-info",
          { signal: fetchController.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Error fetching client IP: ${response.status} ${response.statusText}`
          );
        }

        const clientInfo = await response.json();

        if (clientInfo?.ip) {
          this.log(
            `Fetched client IP: ${this._maskIp(clientInfo.ip)}`,
            this.LOG_LEVELS.INFO
          );
        }

        return clientInfo;
      } catch (fetchError) {
        // If fetch fails and we have a cached IP, return that
        if (cachedIp) {
          this.log(
            `Fetch failed, using cached IP: ${this._maskIp(cachedIp)}`,
            this.LOG_LEVELS.WARN
          );
          return { ip: cachedIp, source: "cache-fallback" };
        }
        throw fetchError;
      }
    } catch (error) {
      this.log(
        `Error fetching client IP: ${error.message}`,
        this.LOG_LEVELS.ERROR
      );
      return null;
    }
  },

  /**
   * Log session events for analytics
   * Uses a non-blocking approach to avoid performance impact
   * @private
   * @param {string} eventType - The type of event to log
   * @param {Object} eventData - Additional event data
   */
  _logSessionEvent: function (eventType, eventData) {
    try {
      const sessionId = this.getSessionId();

      // Send to analytics using sendBeacon if available
      if (navigator.sendBeacon) {
        const analyticsData = {
          eventType: `session_${eventType}`,
          timestamp: new Date().toISOString(),
          sessionId: sessionId,
          ...eventData,
        };

        const blob = new Blob([JSON.stringify(analyticsData)], {
          type: "application/json",
        });

        const endpoint =
          "https://funnelback-proxy-dev.vercel.app/proxy/analytics";
        navigator.sendBeacon(endpoint, blob);

        this.log(`Logged event: ${eventType}`, this.LOG_LEVELS.DEBUG);
      }
    } catch (error) {
      this.log(`Error logging event: ${error.message}`, this.LOG_LEVELS.ERROR);
    }
  },
};

// Initialize on page load with optimized handling for search redirects
window.addEventListener("DOMContentLoaded", () => {
  // Check if this is a search results page
  const isSearchPage = window.location.pathname.includes("search-test");
  const hasQueryParam = new URLSearchParams(window.location.search).has(
    "query"
  );

  // Check for debug mode via URL parameter
  const debugMode = new URLSearchParams(window.location.search).has(
    "debug_session"
  );
  if (debugMode) {
    SessionService.setLogLevel(SessionService.LOG_LEVELS.DEBUG);
    SessionService.log(`Running in debug mode`, SessionService.LOG_LEVELS.INFO);
  }

  if (isSearchPage && hasQueryParam) {
    // For search results page, get session ID immediately for analytics
    // but delay full initialization to prioritize search results loading
    const sessionId = SessionService.getSessionId();
    SessionService.log(
      `On search results page, session ID: ${SessionService._maskString(
        sessionId
      )}`,
      SessionService.LOG_LEVELS.INFO
    );

    // Log query information
    const query = new URLSearchParams(window.location.search).get("query");
    SessionService.log(
      `Search query: ${query}`,
      SessionService.LOG_LEVELS.INFO
    );

    // Check for redirect flag
    const isRedirect =
      sessionStorage.getItem(SessionService.SESSION_REDIRECT_FLAG) === "true";
    if (isRedirect) {
      SessionService.log(
        "Search redirect detected, using optimized path",
        SessionService.LOG_LEVELS.INFO
      );
    }

    // Delay complete initialization
    setTimeout(() => {
      SessionService.initialize().catch((error) => {
        SessionService.log(
          `Delayed initialization error: ${error.message}`,
          SessionService.LOG_LEVELS.ERROR
        );
      });
    }, 1000); // 1 second delay to prioritize search results
  } else {
    // For regular pages, initialize normally
    SessionService.initialize().catch((error) => {
      SessionService.log(
        `Standard initialization error: ${error.message}`,
        SessionService.LOG_LEVELS.ERROR
      );
    });
  }
});

// Add an event listener to the search form to prepare for redirects
window.addEventListener("DOMContentLoaded", () => {
  // Find the header search form
  const headerSearchInput = document.getElementById("search-input");
  const headerSearchForm = headerSearchInput?.closest("form");

  if (headerSearchForm) {
    headerSearchForm.addEventListener("submit", function (e) {
      // Get the query before preventing default
      const query = headerSearchInput.value.trim();

      // Prepare session for redirect before navigation
      if (query) {
        SessionService.prepareForSearchRedirect(query);
        SessionService.log(
          `Prepared for redirect with query: ${query}`,
          SessionService.LOG_LEVELS.INFO
        );
      }
    });
  }
});

// Extend session when user interacts with the page
["click", "keydown", "scroll"].forEach((eventType) => {
  window.addEventListener(
    eventType,
    () => {
      const now = Date.now();
      const expiryStr = sessionStorage.getItem(
        SessionService.SESSION_EXPIRY_KEY
      );
      const expiry = expiryStr ? parseInt(expiryStr) : 0;

      // Only extend if less than 5 minutes remaining
      if (expiry - now < 5 * 60 * 1000) {
        const newExpiry = now + SessionService.SESSION_DURATION;
        sessionStorage.setItem(
          SessionService.SESSION_EXPIRY_KEY,
          newExpiry.toString()
        );

        SessionService.log(
          "Extended session due to user activity",
          SessionService.LOG_LEVELS.DEBUG
        );
      }
    },
    { passive: true }
  );
});

// Make globally available
window.SessionService = SessionService;

// For module systems, but will be ignored in browser script tags
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = SessionService;
}
