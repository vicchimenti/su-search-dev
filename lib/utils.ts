/**
 * @fileoverview Utility functions
 * 
 * This module provides utility functions used throughout the application.
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 2.4.1
 * @lastModified 2025-05-12
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

    return function (...args: Parameters<T>): void {
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

    return function (...args: Parameters<T>): ReturnType<T> {
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

    try {
        // Check for key patterns in tab request URLs
        const hasFormPartial = url.includes('form=partial');

        // Check for various tab parameter patterns based on actual logs
        const hasFTabsPattern1 = /f\.Tabs%7C[^&]+/.test(url);  // Match f.Tabs%7C followed by anything 
        const hasFTabsPattern2 = /f\.Tabs%5C[^&]+/.test(url);  // Alternative encoding
        const hasFTabsPattern3 = /f\.Tabs\|[^&]+/.test(url);   // Unencoded pipe character
        const hasFTabsPattern4 = url.includes('&f.Tabs');     // Simple check for f.Tabs parameter

        // Check Faculty_Staff specific patterns
        const hasFacultyStaffPattern = url.includes('staff=Faculty') || url.includes('Faculty_Staff') || url.includes('Faculty+%26+Staff');

        // Check Programs specific patterns
        const hasProgramsPattern = url.includes('programs-Programs') || url.includes('Programs');

        // Check News specific patterns
        const hasNewsPattern = url.includes('News');

        // Check for non-default profile that might indicate a tab
        const hasNonDefaultProfile = url.includes('profile=') && !url.includes('profile=_default');

        // Combined check
        const isTabResult = hasFormPartial && (
            hasFTabsPattern1 || hasFTabsPattern2 || hasFTabsPattern3 || hasFTabsPattern4 ||
            hasFacultyStaffPattern || hasProgramsPattern || hasNewsPattern ||
            hasNonDefaultProfile
        );

        // For debugging - only log if explicitly enabled via searchConfig
        if (typeof window !== 'undefined' &&
            window.searchConfig &&
            window.searchConfig.enableTabDebug) {
            console.log(`[TAB DEBUG] URL check:`, {
                url: url.substring(0, 100),
                hasFormPartial,
                hasFTabsPattern1,
                hasFTabsPattern2,
                hasFTabsPattern3,
                hasFTabsPattern4,
                hasFacultyStaffPattern,
                hasProgramsPattern,
                hasNewsPattern,
                hasNonDefaultProfile,
                isTabResult
            });
        }

        return isTabResult;
    } catch (error) {
        console.error('Error in isTabRequest:', error);
        return false;
    }
}

/**
 * Extract tab ID from various URL formats based on observed patterns
 * @param url - The URL to parse
 * @returns The extracted tab ID or null if not found
 */
export function extractTabId(url: string): string | null {
    if (!url) return null;

    try {
        // Try to get the full URL for debugging
        console.log(`[TAB DEBUG] Extracting tab ID from URL: ${url.substring(0, 200)}...`);

        // Extract from Faculty & Staff pattern
        if (url.includes('staff=Faculty') || url.includes('Faculty_Staff') || url.includes('Faculty+%26+Staff')) {
            return 'Faculty_Staff';
        }

        // Extract from Programs pattern
        if (url.includes('programs-Programs') || url.includes('Programs')) {
            return 'Programs';
        }

        // Extract from News pattern
        if (url.includes('News')) {
            return 'News';
        }

        // Default to Results if form=partial is present but no specific tab is identified
        if (url.includes('form=partial') && !url.includes('staff=') && !url.includes('programs-')) {
            return 'Results';
        }

        // Try more generic extraction patterns if specific ones fail

        // Look for f.Tabs pattern with equals sign
        const facetTabRegex1 = /f\.Tabs(?:%7C|%5C|\|)[^=]+=([^&]+)/;
        const match1 = url.match(facetTabRegex1);
        if (match1 && match1[1]) {
            // Decode URL component if needed
            const decoded = decodeURIComponent(match1[1]);
            console.log(`[TAB DEBUG] Matched f.Tabs pattern with equals: ${decoded}`);
            return normalizeTabId(decoded);
        }

        // Look for f.Tabs pattern with dash for Programs
        const facetTabRegex2 = /f\.Tabs(?:%7C|%5C|\|)[^-]+-([^&]+)/;
        const match2 = url.match(facetTabRegex2);
        if (match2 && match2[1]) {
            const decoded = decodeURIComponent(match2[1]);
            console.log(`[TAB DEBUG] Matched f.Tabs pattern with dash: ${decoded}`);
            return normalizeTabId(decoded);
        }

        // Check data-tab-group-control attribute in URL
        const groupControlRegex = /data-tab-group-control=["']([^"']+)["']/;
        const match3 = url.match(groupControlRegex);
        if (match3 && match3[1]) {
            console.log(`[TAB DEBUG] Matched data-tab-group-control: ${match3[1]}`);
            return normalizeTabId(match3[1]);
        }

        // Check for tab parameter directly
        const tabRegex = /[?&]tab=([^&]+)/i;
        const match4 = url.match(tabRegex);
        if (match4 && match4[1]) {
            const decoded = decodeURIComponent(match4[1]);
            console.log(`[TAB DEBUG] Matched direct tab parameter: ${decoded}`);
            return normalizeTabId(decoded);
        }

        console.log(`[TAB DEBUG] No tab ID found in URL`);
        return null;
    } catch (error) {
        console.error('Error extracting tab ID from URL:', error);
        return null;
    }
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
        'Faculty & Staff': 'Faculty_Staff',
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

            // If no specific tab ID found but is a tab request, default to Results
            if (!result.tabId && result.isTabRequest) {
                result.tabId = 'Results';
            }
        }

        console.log(`[TAB DEBUG] Parsed URL result:`, result);
    } catch (error) {
        console.error('Error parsing tab request URL:', error);
    }

    return result;
}

/**
 * Safely get current timestamp
 * @returns Current timestamp in milliseconds
 */
export function getCurrentTimestamp(): number {
    return Date.now();
}

/**
 * Check if a sufficient time has elapsed since a given timestamp
 * @param timestamp - The timestamp to check against (in milliseconds)
 * @param threshold - The threshold in milliseconds
 * @returns Whether the threshold has been exceeded
 */
export function hasTimeElapsed(timestamp: number, threshold: number): boolean {
    if (!timestamp) return true;

    const now = getCurrentTimestamp();
    return (now - timestamp) >= threshold;
}

/**
 * Validate whether a connection needs to be refreshed based on inactivity
 * @param lastActivityTime - Timestamp of last activity
 * @param inactivityThreshold - Threshold in milliseconds (default: 10 minutes)
 * @returns Whether connection refresh is needed
 */
export function shouldRefreshConnection(
    lastActivityTime: number,
    inactivityThreshold: number = 10 * 60 * 1000
): boolean {
    // Always return false if we're not in a browser environment
    if (typeof window === 'undefined') return false;

    return hasTimeElapsed(lastActivityTime, inactivityThreshold);
}

/**
 * Log a message with consistent formatting for reconnection-related events
 * @param message - Message to log
 * @param level - Log level (info, warn, error, debug)
 * @param data - Optional data to include
 */
export function logReconnection(
    message: string,
    level: 'info' | 'warn' | 'error' | 'debug' = 'info',
    data?: any
): void {
    const prefix = '[RECONNECT]';

    switch (level) {
        case 'error':
            if (data) {
                console.error(`${prefix} ${message}`, data);
            } else {
                console.error(`${prefix} ${message}`);
            }
            break;
        case 'warn':
            if (data) {
                console.warn(`${prefix} ${message}`, data);
            } else {
                console.warn(`${prefix} ${message}`);
            }
            break;
        case 'debug':
            if (data) {
                console.debug(`${prefix} ${message}`, data);
            } else {
                console.debug(`${prefix} ${message}`);
            }
            break;
        case 'info':
        default:
            if (data) {
                console.log(`${prefix} ${message}`, data);
            } else {
                console.log(`${prefix} ${message}`);
            }
    }
}