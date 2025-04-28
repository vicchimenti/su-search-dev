/**
 * @fileoverview IP Service for consistent client IP management
 * 
 * This service centralizes IP address capture and management across the application.
 * It ensures the original client IP is captured on page load and remains consistent
 * throughout the session, preventing middleware from overwriting it with x-forwarded-for.
 *
 * Features:
 * - Early IP detection on page load
 * - Session persistence to maintain the same IP across page refreshes
 * - Multiple fallback mechanisms for reliability
 * - API endpoint support for server-side IP detection
 * - Detailed logging for debugging and tracing
 *
 * @author Victor Chimenti
 * @version 1.0.0
 * @lastModified 2025-04-28
 */

/**
 * Interface for IP metadata
 */
interface IPMetadata {
    city?: string | null;
    region?: string | null;
    country?: string | null;
    timezone?: string | null;
    latitude?: string | null;
    longitude?: string | null;
  }
  
  /**
   * IP Service - Singleton for centralized IP management
   */
  class IPService {
    private clientIP: string | null = null;
    private ipMetadata: IPMetadata | null = null;
    private initialized: boolean = false;
    private initializing: boolean = false;
    private initPromise: Promise<string | null> | null = null;
    private ipSource: string = 'unknown';
  
    /**
     * Initialize the IP service
     * Should be called as early as possible in the application lifecycle
     * @returns Promise that resolves to the client IP or null if unavailable
     */
    public init(): Promise<string | null> {
      // Return existing promise if initialization is in progress
      if (this.initializing && this.initPromise) {
        console.log('[IPService] Initialization already in progress, returning existing promise');
        return this.initPromise;
      }
  
      // Return cached result if already initialized
      if (this.initialized) {
        console.log('[IPService] Already initialized with IP:', this.clientIP);
        return Promise.resolve(this.clientIP);
      }
  
      console.log('[IPService] Starting initialization');
      this.initializing = true;
  
      // Create and store the initialization promise
      this.initPromise = this.captureClientIP()
        .then(ip => {
          this.initialized = true;
          this.initializing = false;
          console.log(`[IPService] Initialization complete. Client IP: ${ip} (Source: ${this.ipSource})`);
          return ip;
        })
        .catch(error => {
          this.initializing = false;
          console.error('[IPService] Initialization failed:', error);
          
          // Try to fall back to storage if available
          const storedIP = this.getStoredIP();
          if (storedIP) {
            console.log('[IPService] Falling back to stored IP:', storedIP);
            this.clientIP = storedIP;
            this.initialized = true;
            return storedIP;
          }
          
          return null;
        });
  
      return this.initPromise;
    }
  
    /**
     * Capture the client IP address using all available methods
     * @returns Promise resolving to the client IP or null if unavailable
     */
    private async captureClientIP(): Promise<string | null> {
      console.log('[IPService] Attempting to capture client IP');
      
      try {
        // First try: Server API endpoint (most reliable)
        const apiIP = await this.getIPFromAPI();
        if (apiIP) {
          console.log('[IPService] Successfully captured IP from API endpoint:', apiIP);
          this.clientIP = apiIP;
          this.ipSource = 'api';
          this.storeIP(apiIP);
          return apiIP;
        }
      } catch (error) {
        console.warn('[IPService] Failed to capture IP from API endpoint:', error);
      }
  
      try {
        // Second try: Restore from session storage
        const storedIP = this.getStoredIP();
        if (storedIP) {
          console.log('[IPService] Using previously stored IP from session:', storedIP);
          this.clientIP = storedIP;
          this.ipSource = 'session';
          return storedIP;
        }
      } catch (error) {
        console.warn('[IPService] Failed to retrieve stored IP:', error);
      }
  
      console.warn('[IPService] All IP detection methods failed');
      return null;
    }
  
    /**
     * Get client IP from dedicated API endpoint
     * @returns Promise resolving to the client IP or null if unavailable
     */
    private async getIPFromAPI(): Promise<string | null> {
      try {
        console.log('[IPService] Fetching client IP from API endpoint');
        const response = await fetch('/api/client-ip', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          cache: 'no-store' // Ensure fresh response
        });
  
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
  
        const data = await response.json();
        
        if (data.ip) {
          console.log('[IPService] API returned IP:', data.ip);
          
          // Store metadata if available
          if (data.metadata) {
            this.ipMetadata = data.metadata;
            this.storeIPMetadata(data.metadata);
            console.log('[IPService] Stored IP metadata:', data.metadata);
          }
          
          return data.ip;
        }
        
        console.warn('[IPService] API response did not contain IP:', data);
        return null;
      } catch (error) {
        console.error('[IPService] Error fetching IP from API:', error);
        return null;
      }
    }
  
    /**
     * Store IP in session storage for persistence
     * @param ip The IP address to store
     */
    private storeIP(ip: string): void {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem('clientRealIP', ip);
          console.log('[IPService] Stored IP in session storage:', ip);
        }
      } catch (error) {
        console.warn('[IPService] Failed to store IP in session storage:', error);
      }
    }
  
    /**
     * Store IP metadata in session storage
     * @param metadata IP metadata to store
     */
    private storeIPMetadata(metadata: IPMetadata): void {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem('ipMetadata', JSON.stringify(metadata));
          console.log('[IPService] Stored IP metadata in session storage');
        }
      } catch (error) {
        console.warn('[IPService] Failed to store IP metadata in session storage:', error);
      }
    }
  
    /**
     * Retrieve stored IP from session storage
     * @returns Previously stored IP or null if unavailable
     */
    private getStoredIP(): string | null {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const ip = window.sessionStorage.getItem('clientRealIP');
          
          if (ip) {
            console.log('[IPService] Retrieved IP from session storage:', ip);
            
            // Also try to get stored metadata
            try {
              const metadataStr = window.sessionStorage.getItem('ipMetadata');
              if (metadataStr) {
                this.ipMetadata = JSON.parse(metadataStr);
                console.log('[IPService] Retrieved IP metadata from session storage');
              }
            } catch (metadataError) {
              console.warn('[IPService] Failed to parse stored IP metadata:', metadataError);
            }
            
            return ip;
          }
        }
        return null;
      } catch (error) {
        console.warn('[IPService] Error retrieving stored IP:', error);
        return null;
      }
    }
  
    /**
     * Get the client IP address
     * @returns The client IP or null if unavailable
     */
    public getClientIP(): string | null {
      // If not initialized, warn and try to get from storage
      if (!this.initialized) {
        console.warn('[IPService] getClientIP called before initialization complete');
        
        // Try to get from storage as fallback
        const storedIP = this.getStoredIP();
        if (storedIP) {
          console.log('[IPService] Falling back to stored IP:', storedIP);
          return storedIP;
        }
        
        console.warn('[IPService] No IP available yet - initialization may be in progress');
        return null;
      }
      
      return this.clientIP;
    }
  
    /**
     * Get IP metadata (location, etc.)
     * @returns IP metadata or null if unavailable
     */
    public getIPMetadata(): IPMetadata | null {
      if (!this.initialized) {
        console.warn('[IPService] getIPMetadata called before initialization complete');
        
        // Try to get from storage as fallback
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            const metadataStr = window.sessionStorage.getItem('ipMetadata');
            if (metadataStr) {
              return JSON.parse(metadataStr);
            }
          }
        } catch (error) {
          console.warn('[IPService] Error retrieving stored IP metadata:', error);
        }
        
        return null;
      }
      
      return this.ipMetadata;
    }
  
    /**
     * Enhance request options with client IP headers
     * Useful for adding IP headers to fetch or axios requests
     * @param options Request options to enhance
     * @returns Enhanced options with IP headers
     */
    public enhanceRequestOptions(options: any = {}): any {
      if (!options.headers) {
        options.headers = {};
      }
      
      const clientIP = this.getClientIP();
      if (clientIP) {
        console.log('[IPService] Adding client IP to request headers:', clientIP);
        options.headers['X-Real-Client-IP'] = clientIP;
        options.headers['X-Original-Client-IP'] = clientIP;
      } else {
        console.warn('[IPService] No client IP available to add to request headers');
      }
      
      return options;
    }
  
    /**
     * Get initialization status
     * @returns Whether the service has been fully initialized
     */
    public isInitialized(): boolean {
      return this.initialized;
    }
  
    /**
     * Get the source of the client IP
     * @returns The source of the client IP (api, session, etc.)
     */
    public getIPSource(): string {
      return this.ipSource;
    }
  
    /**
     * Force refresh the client IP
     * Useful if the client's network conditions have changed
     * @returns Promise resolving to the new client IP
     */
    public async refreshIP(): Promise<string | null> {
      console.log('[IPService] Manually refreshing client IP');
      
      // Reset initialization state
      this.initialized = false;
      this.initializing = false;
      this.initPromise = null;
      
      // Reinitialize
      return this.init();
    }
  }
  
  // Export as singleton instance
  const ipService = new IPService();
  export default ipService;