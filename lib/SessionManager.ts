/**
 * @fileoverview Session ID Management Service
 * 
 * This module provides centralized session ID management for the search API.
 * It serves as a single source of truth for session IDs across the application.
 *
 * @author Victor Chimenti
 * @version 1.1.0
 * @lastModified 2025-04-06
 */

/**
 * Interface for the SessionService
 */
export interface ISessionService {
    generateSessionId(): string;
    getSessionId(): string;
    addSessionIdToUrl(url: string): string;
    normalizeUrl(url: string): string;
    addSessionIdToData<T>(data: T): T & { sessionId: string };
  }
  
  /**
   * SessionService - Manages session IDs across the application
   */
  const SessionService: ISessionService = {
    /**
     * Generate a new session ID
     * @returns A unique session ID
     */
    generateSessionId(): string {
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    },
  
    /**
     * Get the current session ID or create a new one if it doesn't exist
     * This is the primary method other components should use
     * @returns The current session ID
     */
    getSessionId(): string {
      try {
        let sessionId = sessionStorage.getItem('searchSessionId');
        
        if (!sessionId) {
          sessionId = this.generateSessionId();
          sessionStorage.setItem('searchSessionId', sessionId);
          console.log('SessionService: Created new session ID:', sessionId);
        }
        
        return sessionId;
      } catch (e) {
        // Fallback if sessionStorage is unavailable (e.g., private browsing)
        const fallbackId = this.generateSessionId();
        console.log('SessionService: Using fallback session ID (sessionStorage unavailable):', fallbackId);
        return fallbackId;
      }
    },
  
    /**
     * Add session ID to a URL if it doesn't already have one
     * @param url - The URL to add the session ID to
     * @returns URL with session ID parameter
     */
    addSessionIdToUrl(url: string): string {
      if (!url) return url;
      
      try {
        const sessionId = this.getSessionId();
        const urlObj = new URL(url, window.location.origin);
        
        // Check if URL already has a sessionId parameter
        if (!urlObj.searchParams.has('sessionId')) {
          urlObj.searchParams.append('sessionId', sessionId);
        }
        
        return urlObj.toString();
      } catch (e) {
        console.error('SessionService: Error adding session ID to URL:', e);
        return url; // Return original URL if there's an error
      }
    },
    
    /**
     * Normalize a URL to ensure it has exactly one session ID parameter
     * @param url - The URL to normalize
     * @returns Normalized URL with exactly one session ID
     */
    normalizeUrl(url: string): string {
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
          if (key !== 'sessionId') {
            newParams.append(key, value);
          }
        }
        
        // Add the canonical session ID
        newParams.append('sessionId', sessionId);
        
        // Replace the search parameters
        urlObj.search = newParams.toString();
        
        return urlObj.toString();
      } catch (e) {
        console.error('SessionService: Error normalizing URL:', e);
        return url; // Return original URL if there's an error
      }
    },
  
    /**
     * Add session ID to data object for API requests
     * @param data - The data object to add the session ID to
     * @returns Data with session ID added
     */
    addSessionIdToData<T>(data: T): T & { sessionId: string } {
      const result = Object.assign({}, data) as T & { sessionId: string };
      result.sessionId = this.getSessionId();
      return result;
    }
  };
  
  // Make globally available
  (window as any).SessionService = SessionService;
  
  export default SessionService;