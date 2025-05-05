/**
 * @fileoverview Session ID Management Service with IP Tracking
 *
 * This module provides centralized session ID management for the search API.
 * It serves as a single source of truth for session IDs across the application.
 * Now includes IP tracking capabilities to improve analytics and user tracking.
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 2.1.2
 * @lastModified 2025-05-05
 */

/**
 * SessionService - Manages session IDs and IP tracking across the application
 */
const SessionService = {
  // Configuration constants
  SESSION_ID_KEY: "searchSessionId",
  SESSION_IP_KEY: "searchSessionIp",
  SESSION_EXPIRY_KEY: "searchSessionExpiry",
  SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
  IP_CHECK_THRESHOLD: 60 * 60 * 1000, // 1 hour
  IP_MISMATCH_LIMIT: 3, // Maximum number of IP changes before forcing a new session

  // Internal state
  _lastKnownIp: null,
  _ipMismatchCount: 0,
  _lastIpCheckTime: 0,

  /**
   * Initialize session service - should be called once on page load
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  initialize: async function () {
    try {
      // Check if session exists and is valid
      const sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
      const expiryStr = sessionStorage.getItem(this.SESSION_EXPIRY_KEY);
      const storedIp = sessionStorage.getItem(this.SESSION_IP_KEY);

      const now = Date.now();

      // Set internal state from storage
      if (storedIp) {
        this._lastKnownIp = storedIp;
      }

      // If session is expired or doesn't exist, create a new one
      if (!sessionId || !expiryStr || parseInt(expiryStr) < now) {
        await this._createNewSession();
        return;
      }

      // Session exists and is valid, check IP if needed
      const timeSinceLastCheck = now - this._lastIpCheckTime;
      if (timeSinceLastCheck > this.IP_CHECK_THRESHOLD) {
        await this._verifyClientIp();
      }
    } catch (error) {
      // Ensure a valid session ID is available even if initialization fails
      if (!sessionStorage.getItem(this.SESSION_ID_KEY)) {
        this._setBasicSession();
      }
    }
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
   * Get the current session ID or create a new one if it doesn't exist
   * This is the primary method other components should use
   * @returns {string} The current session ID
   */
  getSessionId: function () {
    try {
      let sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);

      if (!sessionId) {
        sessionId = this.generateSessionId();
        this._setBasicSession(sessionId);
      }

      return sessionId;
    } catch (e) {
      // Fallback if sessionStorage is unavailable (e.g., private browsing)
      const fallbackId = this.generateSessionId();
      return fallbackId;
    }
  },

  /**
   * Get the IP address associated with the current session
   * @returns {string|null} The current IP address or null if not available
   */
  getSessionIp: function () {
    try {
      return (
        this._lastKnownIp || sessionStorage.getItem(this.SESSION_IP_KEY) || null
      );
    } catch (e) {
      return null;
    }
  },

  /**
   * Force creation of a new session ID and refresh IP information
   * @returns {Promise<string>} A promise that resolves with the new session ID
   */
  refreshSession: async function () {
    try {
      await this._createNewSession();
      return sessionStorage.getItem(this.SESSION_ID_KEY);
    } catch (e) {
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

      return {
        sessionId: sessionId,
        hasSession: !!sessionId,
        timeRemaining: Math.max(0, expiry - now),
        expiresAt: expiry ? new Date(expiry).toISOString() : null,
        lastKnownIp: this.getSessionIp(),
        ipMismatchCount: this._ipMismatchCount,
        lastIpCheckTime: this._lastIpCheckTime
          ? new Date(this._lastIpCheckTime).toISOString()
          : null,
      };
    } catch (e) {
      return {
        sessionId: this.getSessionId(),
        hasSession: true,
        error: e.message,
      };
    }
  },

  /**
   * Create a new session with full IP information
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

      // Reset IP mismatch counter
      this._ipMismatchCount = 0;

      // Get current client IP
      const clientInfo = await this._fetchClientIp();
      if (clientInfo && clientInfo.ip) {
        this._lastKnownIp = clientInfo.ip;
        sessionStorage.setItem(this.SESSION_IP_KEY, clientInfo.ip);
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
    }
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
    } catch (error) {
      // Silent error handling
    }
  },

  /**
   * Verify that the client's current IP matches stored IP
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
        return;
      }

      const currentIp = clientInfo.ip;
      const previousIp =
        this._lastKnownIp || sessionStorage.getItem(this.SESSION_IP_KEY);

      if (previousIp && currentIp !== previousIp) {
        // IP has changed
        this._ipMismatchCount++;

        // Log IP change for analytics
        this._logSessionEvent("ip_changed", {
          previousIp: previousIp,
          currentIp: currentIp,
          mismatchCount: this._ipMismatchCount,
        });

        // Update stored IP
        this._lastKnownIp = currentIp;
        sessionStorage.setItem(this.SESSION_IP_KEY, currentIp);

        // If too many IP changes, create new session
        if (this._ipMismatchCount >= this.IP_MISMATCH_LIMIT) {
          await this._createNewSession();
        }
      } else if (!previousIp) {
        // No previous IP, just store current one
        this._lastKnownIp = currentIp;
        sessionStorage.setItem(this.SESSION_IP_KEY, currentIp);
      }
    } catch (error) {
      // Silent error handling
    }
  },

  /**
   * Fetch the client's IP address from the client-info API
   * @private
   * @returns {Promise<Object|null>} Promise that resolves with client info or null if error
   */
  _fetchClientIp: async function () {
    try {
      const response = await fetch(
        "https://su-search-dev.vercel.app/api/client-info"
      );
      if (!response.ok) {
        throw new Error(
          `Error fetching client IP: ${response.status} ${response.statusText}`
        );
      }

      const clientInfo = await response.json();
      return clientInfo;
    } catch (error) {
      return null;
    }
  },

  /**
   * Log session events for analytics
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

        const endpoint = "https://funnelback-proxy-dev.vercel.app/proxy/analytics";
        navigator.sendBeacon(endpoint, blob);
      }
    } catch (error) {
      // Silent error handling
    }
  },
};

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
  SessionService.initialize().catch(() => {
    // Silent error handling
  });
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
