/**
 * @fileoverview Session Manager Browser Integration
 * 
 * This script provides a browser-compatible version of the session manager
 * that can be loaded directly in the browser without requiring module imports.
 * It exposes global functions for managing sessions across the application.
 *
 * @author Victor Chimenti
 * @version 1.0.1
 * @lastModified 2025-04-04
 */

// Self-executing function to avoid global namespace pollution
(function() {
    // Session storage key
    const SESSION_ID_KEY = 'searchSessionId';
  
    // Configuration with defaults
    const config = {
      prefix: 'sess_',
      duration: 30, // 30 minutes in minutes
      domain: '.seattleu.edu',
      debug: false
    };
  
    // Events storage
    let events = [];
  
    /**
     * Get the current session ID from storage or create a new one
     * @returns {string} Session ID
     */
    function getSessionId() {
      let sessionData = getFromStorage();
      
      if (sessionData) {
        try {
          const data = JSON.parse(sessionData);
          
          // Validate session data
          if (data && data.id && data.createdAt) {
            const expiresAt = data.createdAt + (config.duration * 60 * 1000);
            
            // Check if expired
            if (Date.now() > expiresAt) {
              return createNewSession();
            }
            
            return data.id;
          }
        } catch (e) {
          // Invalid data, create new session
          console.error('Error parsing session data:', e);
        }
      }
      
      // No valid session found, create new one
      return createNewSession();
    }
  
    /**
     * Create a new session ID and store it
     * @returns {string} New session ID
     */
    function createNewSession() {
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substring(2, 9);
      const sessionId = `${config.prefix}${timestamp}_${randomPart}`;
      
      // Store in browser storage
      storeSessionId(sessionId, timestamp);
      
      if (config.debug) {
        console.log('Created new session:', sessionId);
      }
      
      return sessionId;
    }
  
    /**
     * Track an event with the current session
     * @param {string} type Event type
     * @param {Object} data Event data
     */
    function trackSessionEvent(type, data) {
      // Get current session ID
      const sessionId = getSessionId();
      
      const event = {
        type,
        data: {
          ...data,
          sessionId
        },
        timestamp: new Date().toISOString()
      };
      
      // Add to events array
      events.push(event);
      
      if (config.debug) {
        console.log('Session event tracked:', event);
      }
      
      // If we have more than 10 events, flush them
      if (events.length > 10) {
        flushEvents();
      }
    }
  
    /**
     * Refresh the current session
     * @returns {string} Current session ID
     */
    function refreshSession() {
      const sessionId = getSessionId();
      const timestamp = Date.now();
      
      // Re-store with new timestamp
      storeSessionId(sessionId, timestamp);
      
      if (config.debug) {
        console.log('Session refreshed:', sessionId);
      }
      
      return sessionId;
    }
  
    /**
     * Clear the current session
     */
    function clearSession() {
      // Remove from storage
      removeFromStorage();
      
      // Clear events
      events = [];
      
      if (config.debug) {
        console.log('Session cleared');
      }
    }
  
    /**
     * Store session ID in available storage
     * @param {string} sessionId Session ID to store
     * @param {number} timestamp Creation timestamp
     */
    function storeSessionId(sessionId, timestamp) {
      const sessionData = JSON.stringify({
        id: sessionId,
        createdAt: timestamp
      });
      
      try {
        // Try sessionStorage first
        sessionStorage.setItem(SESSION_ID_KEY, sessionData);
      } catch (e) {
        try {
          // Fall back to localStorage
          localStorage.setItem(SESSION_ID_KEY, sessionData);
        } catch (e) {
          // Fall back to cookies
          setCookie(SESSION_ID_KEY, sessionData);
        }
      }
    }
  
    /**
     * Get session data from storage
     * @returns {string|null} Stored session data or null
     */
    function getFromStorage() {
      try {
        // Try sessionStorage first
        const sessionData = sessionStorage.getItem(SESSION_ID_KEY);
        if (sessionData) {
          return sessionData;
        }
        
        // Fall back to localStorage
        const localData = localStorage.getItem(SESSION_ID_KEY);
        if (localData) {
          // Move to sessionStorage for future use
          try {
            sessionStorage.setItem(SESSION_ID_KEY, localData);
          } catch (e) {
            // Ignore errors when moving data
          }
          return localData;
        }
      } catch (e) {
        // Storage access failed, try cookies
      }
      
      // Try cookies as last resort
      return getCookie(SESSION_ID_KEY);
    }
  
    /**
     * Remove session data from storage
     */
    function removeFromStorage() {
      try {
        sessionStorage.removeItem(SESSION_ID_KEY);
      } catch (e) {
        // Ignore errors
      }
      
      try {
        localStorage.removeItem(SESSION_ID_KEY);
      } catch (e) {
        // Ignore errors
      }
      
      deleteCookie(SESSION_ID_KEY);
    }
  
    /**
     * Set a cookie
     * @param {string} key Cookie key
     * @param {string} value Cookie value
     */
    function setCookie(key, value) {
      const expiresDate = new Date();
      expiresDate.setTime(expiresDate.getTime() + (config.duration * 60 * 1000));
      
      document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expiresDate.toUTCString()}; path=/; domain=${config.domain}; SameSite=Lax`;
    }
  
    /**
     * Get a cookie value
     * @param {string} key Cookie key
     * @returns {string|null} Cookie value or null
     */
    function getCookie(key) {
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${key}=`));
      
      if (cookieValue) {
        return decodeURIComponent(cookieValue.split('=')[1]);
      }
      
      return null;
    }
  
    /**
     * Delete a cookie
     * @param {string} key Cookie key
     */
    function deleteCookie(key) {
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${config.domain}`;
    }
  
    /**
     * Flush tracked events to the server
     */
    function flushEvents() {
      if (events.length === 0) return;
      
      if (config.debug) {
        console.log('Flushing session events:', events.length);
      }
      
      // Use sendBeacon if available for non-blocking operation
      const endpoint = '/api/enhance';
      const payload = {
        type: 'events',
        events: [...events],
        sessionId: getSessionId()
      };
      
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(payload)], {
            type: 'application/json'
          });
          
          navigator.sendBeacon(endpoint, blob);
          events = [];
          return;
        }
        
        // Fallback to fetch with keepalive
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).then(() => {
          events = [];
        }).catch(error => {
          if (config.debug) {
            console.error('Error flushing events:', error);
          }
        });
      } catch (error) {
        console.error('Failed to flush events:', error);
      }
    }
  
    /**
     * Configure the session manager
     * @param {Object} newConfig Configuration options
     */
    function configureSessionManager(newConfig = {}) {
      // Merge with existing config
      Object.assign(config, newConfig);
      
      if (config.debug) {
        console.log('Session manager configured:', config);
      }
    }
  
    // Expose functions globally
    window.getSessionId = getSessionId;
    window.trackSessionEvent = trackSessionEvent;
    window.refreshSession = refreshSession;
    window.clearSession = clearSession;
    window.configureSessionManager = configureSessionManager;
    
    // Initialize on load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (config.debug) {
          console.log('Session manager initialized with ID:', getSessionId());
        }
      });
    } else {
      if (config.debug) {
        console.log('Session manager initialized with ID:', getSessionId());
      }
    }
    
    // Flush events before unload
    window.addEventListener('beforeunload', () => {
      flushEvents();
    });
  })();