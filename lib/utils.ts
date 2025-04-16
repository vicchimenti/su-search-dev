/**
 * @fileoverview Utility functions
 * 
 * This module provides utility functions used throughout the application.
 *
 * @author Victor Chimenti
 * @version 2.1.0
 * @lastModified 2025-04-16
 */

/**
 * Debounce a function call
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generate a unique session ID
 * @returns Unique session ID
 */
export function generateSessionId(): string {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Get or create a session ID in browser storage
 * @returns Session ID
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return generateSessionId();
  }
  
  try {
    let sessionId = sessionStorage.getItem('searchSessionId');
    
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem('searchSessionId', sessionId);
    }
    
    return sessionId;
  } catch (e) {
    // Fallback if sessionStorage is unavailable
    return generateSessionId();
  }
}

/**
 * Extract result count from HTML response
 * @param html - HTML response from search
 * @returns Result count
 */
export function extractResultCount(html: string): number {
  try {
    const match = html.match(/totalMatching">([0-9,]+)</);
    if (match && match[1]) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
  } catch (error) {
    console.error('Error extracting result count:', error);
  }
  
  return 0;
}

/**
 * Create a function that executes only once
 * @param func - Function to execute once
 * @returns Function that executes only once
 */
export function once<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => ReturnType<T> {
  let result: ReturnType<T>;
  let called = false;
  
  return function(...args: Parameters<T>): ReturnType<T> {
    if (!called) {
      called = true;
      result = func(...args);
    }
    return result;
  };
}

/**
 * Check if a request is for tab content
 * @param url - The URL to check
 * @returns Whether this is a tab content request
 */
export function isTabRequest(url: string): boolean {
  if (!url) return false;
  
  // Check for key patterns in tab request URLs
  const hasFormPartial = url.includes('form=partial');
  const hasTabParam = url.includes('tab=') || url.includes('Tab=');
  const hasProfile = url.includes('profile=') && !url.includes('profile=_default');
  const hasFacetTab = url.includes('f.Tabs%7C') || url.includes('f.Tabs|');
  
  // Check for other tab indicators
  const isTabResult = hasFormPartial && (hasTabParam || hasProfile || hasFacetTab);
  
  // For debugging
  if (process.env.NODE_ENV === 'development' && isTabResult) {
    console.log(`[TAB DEBUG] URL identified as tab request: ${url.substring(0, 100)}...`);
  }
  
  return isTabResult;
}

/**
 * Extract tab ID from various URL formats
 * @param url - The URL to parse
 * @returns The extracted tab ID or null if not found
 */
export function extractTabId(url: string): string | null {
  if (!url) return null;
  
  try {
    // Extract from facet tab parameter (f.Tabs|collection=TabName)
    const facetTabRegex = /f\.Tabs(?:%7C|\|).*?=([^&]+)/;
    const facetMatch = url.match(facetTabRegex);
    if (facetMatch && facetMatch[1]) {
      // Decode URL component if needed
      return decodeURIComponent(facetMatch[1]);
    }
    
    // Extract from regular tab parameter
    const tabRegex = /[\?&]tab=([^&]+)/i;
    const tabMatch = url.match(tabRegex);
    if (tabMatch && tabMatch[1]) {
      return decodeURIComponent(tabMatch[1]);
    }
    
    // Extract from profile if not default
    const profileRegex = /[\?&]profile=([^&_][^&]*)/;
    const profileMatch = url.match(profileRegex);
    if (profileMatch && profileMatch[1] && profileMatch[1] !== '_default') {
      return decodeURIComponent(profileMatch[1]);
    }
    
    // Parse from data-tab-group-control in URL fragment
    const groupControlRegex = /data-tab-group-control=["']([^"']+)["']/;
    const groupMatch = url.match(groupControlRegex);
    if (groupMatch && groupMatch[1]) {
      return groupMatch[1];
    }
    
    // Extract 'Results', 'People', etc. from known patterns
    const knownTabsRegex = /(Results|Programs|Faculty_Staff|News|People|Events)(?:\d+)?(?=&|$)/;
    const knownMatch = url.match(knownTabsRegex);
    if (knownMatch && knownMatch[1]) {
      return knownMatch[1];
    }
  } catch (error) {
    console.error('Error extracting tab ID from URL:', error);
  }
  
  return null;
}

/**
 * Normalize a tab ID to a consistent format
 * @param tabId - The raw tab ID
 * @returns Normalized tab ID
 */
export function normalizeTabId(tabId: string | null): string | null {
  if (!tabId) return null;
  
  // Remove any numeric suffixes (e.g., Results0 -> Results)
  let normalized = tabId.replace(/(\D+)(\d+)$/, '$1');
  
  // Map common variations to standard names
  const tabMappings: Record<string, string> = {
    'Results': 'Results',
    'Programs': 'Programs',
    'Faculty_Staff': 'Faculty_Staff',
    'FacultyStaff': 'Faculty_Staff',
    'Faculty': 'Faculty_Staff',
    'Staff': 'Faculty_Staff',
    'News': 'News'
  };
  
  // Look up in mappings or keep original
  return tabMappings[normalized] || normalized;
}

/**
 * Generate a standardized tab cache key from request parameters
 * @param query - The search query
 * @param collection - The collection name
 * @param tabId - The tab ID
 * @returns Formatted cache key for tab content
 */
export function generateTabCacheKey(query: string, collection: string, tabId: string): string {
  // Normalize inputs
  const normalizedQuery = (query || '').trim().toLowerCase();
  const normalizedCollection = (collection || 'default').trim();
  const normalizedTabId = normalizeTabId(tabId) || 'default';
  
  // Create a standardized key format
  return `tab:${normalizedQuery}:${normalizedCollection}:${normalizedTabId}`;
}

/**
 * Parse request URL to extract essential tab parameters
 * @param url - The request URL
 * @returns Object with parsed parameters
 */
export function parseTabRequestUrl(url: string): {
  query: string | null;
  collection: string | null;
  profile: string | null;
  tabId: string | null;
  isTabRequest: boolean;
} {
  const result = {
    query: null,
    collection: null,
    profile: null,
    tabId: null,
    isTabRequest: false
  } as {
    query: string | null;
    collection: string | null;
    profile: string | null;
    tabId: string | null;
    isTabRequest: boolean;
  };
  
  if (!url) return result;
  
  try {
    // Determine if this is a tab request
    result.isTabRequest = isTabRequest(url);
    
    // Create URL object for easier parsing (handle both absolute and relative URLs)
    let urlObj: URL;
    try {
      // Try as absolute URL
      urlObj = new URL(url);
    } catch (e) {
      // Try as relative URL with a base
      urlObj = new URL(url, '/search-test/');
    }
    
    // Extract search params
    const params = urlObj.searchParams;
    
    // Get common parameters
    result.query = params.get('query');
    result.collection = params.get('collection');
    result.profile = params.get('profile');
    
    // Extract tab ID if this is a tab request
    if (result.isTabRequest) {
      result.tabId = extractTabId(url);
    }
  } catch (error) {
    console.error('Error parsing tab request URL:', error);
  }
  
  return result;
}