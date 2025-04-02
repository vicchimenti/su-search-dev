/**
 * @fileoverview SessionManager - User session tracking for search analytics
 * 
 * This module manages user session tracking for search analytics,
 * generating and persisting session IDs across page loads.
 * 
 * Features:
 * - Session ID generation
 * - Session persistence across page loads
 * - Original query tracking
 * - Secure session handling
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace SessionManager
 * @lastUpdated 2025-04-02
 */

/**
 * Storage key constants
 * @enum {string}
 */
const STORAGE_KEYS = {
    SESSION_ID: 'searchSessionId',
    ORIGINAL_QUERY: 'searchOriginalQuery',
    SESSION_START: 'searchSessionStart'
  };
  
  /**
   * SessionManager - Manage user sessions for search analytics
   */
  class SessionManager {
    /**
     * Create a new SessionManager instance
     * @param {Object} options - Configuration options
     * @param {number} options.sessionTTL - Session time-to-live in milliseconds (defaults to 30 minutes)
     */
    constructor(options = {}) {
      this.sessionTTL = options.sessionTTL || 30 * 60 * 1000; // 30 minutes
      this._initSession();
    }
    
    /**
     * Initialize the user session
     * @private
     */
    _initSession() {
      // Get existing session ID if available
      const existingId = this._getSessionStorage(STORAGE_KEYS.SESSION_ID);
      const sessionStart = parseInt(this._getSessionStorage(STORAGE_KEYS.SESSION_START) || '0', 10);
      
      // Check if session exists and is still valid
      const now = Date.now();
      if (existingId && sessionStart && (now - sessionStart < this.sessionTTL)) {
        this.sessionId = existingId;
      } else {
        // Create new session ID
        this.sessionId = this._generateSessionId();
        this._setSessionStorage(STORAGE_KEYS.SESSION_ID, this.sessionId);
        this._setSessionStorage(STORAGE_KEYS.SESSION_START, now.toString());
      }
    }
    
    /**
     * Generate a new session ID
     * @private
     * @returns {string} Unique session ID
     */
    _generateSessionId() {
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }
    
    /**
     * Set a value in sessionStorage with error handling
     * @private
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     */
    _setSessionStorage(key, value) {
      try {
        sessionStorage.setItem(key, value);
      } catch (error) {
        console.warn('SessionStorage not available:', error);
      }
    }
    
    /**
     * Get a value from sessionStorage with error handling
     * @private
     * @param {string} key - Storage key
     * @returns {string|null} Stored value or null
     */
    _getSessionStorage(key) {
      try {
        return sessionStorage.getItem(key);
      } catch (error) {
        console.warn('SessionStorage not available:', error);
        return null;
      }
    }
    
    /**
     * Remove a value from sessionStorage with error handling
     * @private
     * @param {string} key - Storage key
     */
    _removeSessionStorage(key) {
      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        console.warn('SessionStorage not available:', error);
      }
    }
    
    /**
     * Get the current session ID
     * @returns {string} Session ID
     */
    getSessionId() {
      return this.sessionId;
    }
    
    /**
     * Set the original search query for this session
     * @param {string} query - Original search query
     */
    setOriginalQuery(query) {
      this.originalQuery = query;
      this._setSessionStorage(STORAGE_KEYS.ORIGINAL_QUERY, query);
    }
    
    /**
     * Get the original search query for this session
     * @returns {string|null} Original search query
     */
    getOriginalQuery() {
      // Return from instance if available
      if (this.originalQuery) {
        return this.originalQuery;
      }
      
      // Retrieve from storage as fallback
      const storedQuery = this._getSessionStorage(STORAGE_KEYS.ORIGINAL_QUERY);
      
      // Update instance if found in storage
      if (storedQuery) {
        this.originalQuery = storedQuery;
      }
      
      return storedQuery || null;
    }
    
    /**
     * Refresh the session to extend its lifetime
     */
    refreshSession() {
      this._setSessionStorage(STORAGE_KEYS.SESSION_START, Date.now().toString());
    }
    
    /**
     * Create a new session, invalidating the current one
     * @returns {string} New session ID
     */
    createNewSession() {
      this.sessionId = this._generateSessionId();
      this._setSessionStorage(STORAGE_KEYS.SESSION_ID, this.sessionId);
      this._setSessionStorage(STORAGE_KEYS.SESSION_START, Date.now().toString());
      this._removeSessionStorage(STORAGE_KEYS.ORIGINAL_QUERY);
      this.originalQuery = null;
      
      return this.sessionId;
    }
    
    /**
     * Check if the session is still valid
     * @returns {boolean} Whether the session is valid
     */
    isSessionValid() {
      const sessionStart = parseInt(this._getSessionStorage(STORAGE_KEYS.SESSION_START) || '0', 10);
      const now = Date.now();
      
      return sessionStart > 0 && (now - sessionStart < this.sessionTTL);
    }
    
    /**
     * Get session data for API requests
     * @returns {Object} Session data
     */
    getSessionData() {
      return {
        sessionId: this.sessionId,
        originalQuery: this.getOriginalQuery()
      };
    }
  }
  
  export default SessionManager;