/**
 * @fileoverview Centralized Session Manager
 * 
 * This module provides a unified approach to session management for the
 * Seattle University search system. It handles generating, retrieving,
 * and maintaining session identifiers to ensure consistent user tracking
 * across all search components.
 *
 * @author Victor Chimenti
 * @version 1.0.0
 * @lastModified 2025-04-05
 */

// Singleton instance
let instance: SessionManager;

// Session storage key
const SESSION_ID_KEY = 'searchSessionId';

// Session configuration
interface SessionConfig {
  /** Session ID prefix */
  prefix?: string;
  /** Session duration in minutes */
  duration?: number;
  /** Domain scope for cookies */
  domain?: string;
  /** Debug mode */
  debug?: boolean;
}

// Session event data
interface SessionEventData {
  /** Event type */
  type: string;
  /** Event data payload */
  data: Record<string, any>;
  /** Timestamp */
  timestamp?: string;
}

/**
 * Session Manager Class
 * 
 * Provides centralized session management functionality
 */
class SessionManager {
  private sessionId: string | null = null;
  private createdAt: number = 0;
  private config: SessionConfig;
  private storageAvailable: boolean = false;
  private cookiesAvailable: boolean = false;
  private events: SessionEventData[] = [];
  
  /**
   * Constructor - private to enforce singleton pattern
   * @param config Optional configuration
   */
  private constructor(config: SessionConfig = {}) {
    this.config = {
      prefix: 'sess_',
      duration: 30, // 30 minutes
      domain: '.seattleu.edu',
      debug: process.env.NODE_ENV === 'development',
      ...config
    };
    
    // Check for storage availability
    this.storageAvailable = this.checkStorageAvailability();
    this.cookiesAvailable = this.checkCookieAvailability();
    
    // Initialize session
    this.initSession();
    
    if (this.config.debug) {
      console.log('SessionManager initialized with ID:', this.sessionId);
    }
  }
  
  /**
   * Get the singleton instance
   * @param config Optional configuration
   * @returns SessionManager instance
   */
  public static getInstance(config?: SessionConfig): SessionManager {
    if (!instance) {
      instance = new SessionManager(config);
    }
    return instance;
  }
  
  /**
   * Get the current session ID
   * @returns Session ID
   */
  public getSessionId(): string {
    // If we don't have a session ID yet or it's expired, create a new one
    if (!this.sessionId || this.isExpired()) {
      this.createNewSession();
    }
    
    return this.sessionId!;
  }
  
  /**
   * Track an event with the current session
   * @param type Event type
   * @param data Event data
   */
  public trackEvent(type: string, data: Record<string, any>): void {
    const event: SessionEventData = {
      type,
      data: {
        ...data,
        sessionId: this.getSessionId()
      },
      timestamp: new Date().toISOString()
    };
    
    // Add to local events array
    this.events.push(event);
    
    if (this.config.debug) {
      console.log('Session event tracked:', event);
    }
    
    // If we have more than 10 events, flush them
    if (this.events.length > 10) {
      this.flushEvents();
    }
  }
  
  /**
   * Force create a new session
   * @returns New session ID
   */
  public createNewSession(): string {
    this.sessionId = this.generateSessionId();
    this.createdAt = Date.now();
    
    // Store the session ID
    this.storeSessionId(this.sessionId);
    
    if (this.config.debug) {
      console.log('Created new session:', this.sessionId);
    }
    
    return this.sessionId;
  }
  
  /**
   * Reset the session data
   */
  public clearSession(): void {
    this.sessionId = null;
    this.createdAt = 0;
    this.events = [];
    
    // Clear from storage
    this.removeFromStorage();
    
    if (this.config.debug) {
      console.log('Session cleared');
    }
  }
  
  /**
   * Refresh the current session
   * @returns Current session ID
   */
  public refreshSession(): string {
    this.createdAt = Date.now();
    
    // Re-store the session ID to update expiration
    if (this.sessionId) {
      this.storeSessionId(this.sessionId);
    } else {
      return this.createNewSession();
    }
    
    if (this.config.debug) {
      console.log('Session refreshed:', this.sessionId);
    }
    
    return this.sessionId!;
  }
  
  /**
   * Check if the session has expired
   * @returns True if expired
   */
  public isExpired(): boolean {
    if (!this.sessionId || !this.createdAt) {
      return true;
    }
    
    const expiresAt = this.createdAt + (this.config.duration! * 60 * 1000);
    return Date.now() > expiresAt;
  }
  
  /**
   * Get session data including ID and creation time
   * @returns Session data object
   */
  public getSessionData(): { id: string | null; createdAt: number; events: SessionEventData[] } {
    return {
      id: this.sessionId,
      createdAt: this.createdAt,
      events: [...this.events]
    };
  }
  
  /**
   * Initialize the session
   */
  private initSession(): void {
    // Try to get existing session from storage
    const existingSession = this.getFromStorage();
    
    if (existingSession) {
      try {
        const sessionData = JSON.parse(existingSession);
        
        // Validate session data
        if (sessionData && sessionData.id && sessionData.createdAt) {
          this.sessionId = sessionData.id;
          this.createdAt = sessionData.createdAt;
          
          // Check if expired
          if (this.isExpired()) {
            this.createNewSession();
          }
        } else {
          this.createNewSession();
        }
      } catch (e) {
        // Invalid session data, create new session
        this.createNewSession();
      }
    } else {
      // No existing session, create new one
      this.createNewSession();
    }
  }
  
  /**
   * Generate a new unique session ID
   * @returns Generated session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `${this.config.prefix}${timestamp}_${randomPart}`;
  }
  
  /**
   * Store session ID in available storage
   * @param sessionId Session ID to store
   */
  private storeSessionId(sessionId: string): void {
    const sessionData = JSON.stringify({
      id: sessionId,
      createdAt: this.createdAt
    });
    
    if (this.storageAvailable) {
      try {
        sessionStorage.setItem(SESSION_ID_KEY, sessionData);
      } catch (e) {
        // Fall back to localStorage if sessionStorage fails
        try {
          localStorage.setItem(SESSION_ID_KEY, sessionData);
        } catch (e) {
          // Storage failed, use cookies as last resort
          if (this.cookiesAvailable) {
            this.setCookie(SESSION_ID_KEY, sessionData);
          }
        }
      }
    } else if (this.cookiesAvailable) {
      // Use cookies if storage is not available
      this.setCookie(SESSION_ID_KEY, sessionData);
    }
  }
  
  /**
   * Get session ID from storage
   * @returns Stored session data or null
   */
  private getFromStorage(): string | null {
    if (this.storageAvailable) {
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
          sessionStorage.setItem(SESSION_ID_KEY, localData);
          return localData;
        }
      } catch (e) {
        // Storage access failed, try cookies
      }
    }
    
    // Try cookies as last resort
    if (this.cookiesAvailable) {
      return this.getCookie(SESSION_ID_KEY);
    }
    
    return null;
  }
  
  /**
   * Remove session data from storage
   */
  private removeFromStorage(): void {
    if (this.storageAvailable) {
      try {
        sessionStorage.removeItem(SESSION_ID_KEY);
        localStorage.removeItem(SESSION_ID_KEY);
      } catch (e) {
        // Storage access failed
      }
    }
    
    if (this.cookiesAvailable) {
      this.deleteCookie(SESSION_ID_KEY);
    }
  }
  
  /**
   * Check if sessionStorage/localStorage is available
   * @returns True if available
   */
  private checkStorageAvailability(): boolean {
    if (typeof window === 'undefined') {
      return false; // Not in browser environment
    }
    
    try {
      const testKey = '__session_test__';
      sessionStorage.setItem(testKey, testKey);
      sessionStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Check if cookies are available
   * @returns True if available
   */
  private checkCookieAvailability(): boolean {
    if (typeof document === 'undefined') {
      return false; // Not in browser environment
    }
    
    try {
      const testKey = '__cookie_test__';
      document.cookie = `${testKey}=1`;
      const result = document.cookie.indexOf(testKey) !== -1;
      document.cookie = `${testKey}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      return result;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Set a cookie
   * @param key Cookie key
   * @param value Cookie value
   */
  private setCookie(key: string, value: string): void {
    if (typeof document === 'undefined') return;
    
    const expiresDate = new Date();
    expiresDate.setTime(expiresDate.getTime() + (this.config.duration! * 60 * 1000));
    
    document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expiresDate.toUTCString()}; path=/; domain=${this.config.domain}; SameSite=Lax`;
  }
  
  /**
   * Get a cookie value
   * @param key Cookie key
   * @returns Cookie value or null
   */
  private getCookie(key: string): string | null {
    if (typeof document === 'undefined') return null;
    
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
   * @param key Cookie key
   */
  private deleteCookie(key: string): void {
    if (typeof document === 'undefined') return;
    
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${this.config.domain}`;
  }
  
  /**
   * Flush tracked events to the server
   */
  private flushEvents(): void {
    if (this.events.length === 0) return;
    
    if (this.config.debug) {
      console.log('Flushing session events:', this.events.length);
    }
    
    // Use sendBeacon if available for non-blocking operation
    const endpoint = '/api/enhance';
    const payload = {
      type: 'events',
      events: this.events,
      sessionId: this.getSessionId()
    };
    
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json'
        });
        navigator.sendBeacon(endpoint, blob);
        this.events = [];
        return;
      } catch (e) {
        // Fallback to fetch on Beacon error
      }
    }
    
    // Fallback to fetch with keepalive
    if (typeof fetch !== 'undefined') {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(() => {
        this.events = [];
      }).catch(error => {
        if (this.config.debug) {
          console.error('Error flushing events:', error);
        }
      });
    }
  }
}

// Create and export a convenient function to access session ID
export function getSessionId(): string {
  return SessionManager.getInstance().getSessionId();
}

// Export tracking function for direct use
export function trackSessionEvent(type: string, data: Record<string, any>): void {
  return SessionManager.getInstance().trackEvent(type, data);
}

// Export the class for more complex usage
export default SessionManager;