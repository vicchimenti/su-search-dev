/**
 * @fileoverview Specialized Tab Caching Implementation
 * 
 * This module provides optimized caching functionality specifically for tab content,
 * implementing preloading, predictive caching, and tab-specific cache management.
 *
 * @author Victor Chimenti
 * @version 1.1.0
 * @lastModified 2025-04-15
 */

import { getCachedData, setCachedData, clearCachedData, generateCacheKey } from './cache';

// Define a type for tab TTL keys
type TabTTLKey = 'DEFAULT' | 'ALL' | 'PROGRAMS' | 'STAFF' | 'NEWS';

// Tab content TTL constants in seconds for different tab types
const TAB_TTL: Record<TabTTLKey, number> = {
  // Default tab content TTL
  DEFAULT: 60 * 30, // 30 minutes
  
  // Content-specific tab TTLs
  ALL: 60 * 20, // 20 minutes - "All" tab changes more frequently
  PROGRAMS: 60 * 60 * 2, // 2 hours - Academic programs tabs
  STAFF: 60 * 60 * 4, // 4 hours - Staff directory tabs
  NEWS: 60 * 15 // 15 minutes - News tabs change frequently
};

/**
 * Maps common tab labels to their type for TTL determination
 */
const TAB_TYPE_MAP: Record<string, TabTTLKey> = {
  // Default/general tabs
  'all': 'ALL',
  'results': 'ALL',
  'everything': 'ALL',
  
  // Program tabs
  'programs': 'PROGRAMS',
  'academics': 'PROGRAMS',
  'courses': 'PROGRAMS',
  'degrees': 'PROGRAMS',
  'majors': 'PROGRAMS',
  'minors': 'PROGRAMS',
  
  // Staff tabs
  'staff': 'STAFF',
  'faculty': 'STAFF',
  'people': 'STAFF',
  'directory': 'STAFF',
  
  // News tabs
  'news': 'NEWS',
  'articles': 'NEWS',
  'announcements': 'NEWS',
  'press': 'NEWS'
};

/**
 * Tab-related cache utilities interface
 */
export interface TabCacheUtils {
  getTabContent: (query: string, tabId: string, sessionId?: string) => Promise<any>;
  cacheTabContent: (query: string, tabId: string, content: any, ttl?: number) => Promise<boolean>;
  preloadTabContent: (query: string, tabIds: string[], sessionId?: string) => Promise<void>;
  clearTabCache: (query: string, tabId?: string) => Promise<boolean>;
  refreshTabCache: (query: string, tabId: string, sessionId?: string) => Promise<any>;
  getTtlForTabType: (tabId: string, tabName?: string) => number;
}

/**
 * Create specialized tab cache utilities
 * @param fetchTabContentFn - Function to fetch tab content from backend
 * @returns Tab cache utility functions
 */
export function createTabCacheUtils(
  fetchTabContentFn: (query: string, tabId: string, sessionId?: string) => Promise<any>
): TabCacheUtils {
  /**
   * Get cached tab content or fetch if not in cache
   * @param query - The search query
   * @param tabId - The tab ID
   * @param sessionId - Optional session ID
   * @returns Tab content
   */
  const getTabContent = async (
    query: string, 
    tabId: string, 
    sessionId?: string
  ): Promise<any> => {
    // Generate cache key for this tab
    const params = {
      query,
      tab: tabId
    };
    
    const cacheKey = generateCacheKey('search', params);
    
    // Try to get from cache first
    const cachedContent = await getCachedData(cacheKey);
    if (cachedContent) {
      console.log(`Tab cache hit for ${cacheKey}`);
      return cachedContent;
    }
    
    console.log(`Tab cache miss for ${cacheKey}`);
    
    // Fetch content if not in cache
    try {
      const content = await fetchTabContentFn(query, tabId, sessionId);
      
      // Determine appropriate TTL
      const ttl = getTtlForTabType(tabId);
      
      // Cache the content
      await setCachedData(cacheKey, content, ttl);
      console.log(`Cached tab content for ${cacheKey} with TTL ${ttl}s`);
      
      return content;
    } catch (error) {
      console.error(`Error fetching tab content for ${tabId}:`, error);
      throw error;
    }
  };
  
  /**
   * Cache tab content with appropriate TTL
   * @param query - The search query
   * @param tabId - The tab ID
   * @param content - The content to cache
   * @param ttl - Optional TTL override
   * @returns Success indicator
   */
  const cacheTabContent = async (
    query: string, 
    tabId: string, 
    content: any, 
    ttl?: number
  ): Promise<boolean> => {
    const params = {
      query,
      tab: tabId
    };
    
    const cacheKey = generateCacheKey('search', params);
    
    // Use provided TTL or determine based on tab type
    const effectiveTtl = ttl || getTtlForTabType(tabId);
    
    try {
      await setCachedData(cacheKey, content, effectiveTtl);
      console.log(`Manually cached tab content for ${cacheKey} with TTL ${effectiveTtl}s`);
      return true;
    } catch (error) {
      console.error(`Error caching tab content for ${tabId}:`, error);
      return false;
    }
  };
  
  /**
   * Preload tab content for multiple tabs
   * @param query - The search query
   * @param tabIds - Array of tab IDs to preload
   * @param sessionId - Optional session ID
   */
  const preloadTabContent = async (
    query: string, 
    tabIds: string[], 
    sessionId?: string
  ): Promise<void> => {
    console.log(`Preloading ${tabIds.length} tabs for query "${query}"`);
    
    // Create promises for all tabs to fetch in parallel
    const preloadPromises = tabIds.map(async (tabId) => {
      const params = {
        query,
        tab: tabId
      };
      
      const cacheKey = generateCacheKey('search', params);
      
      // Check if already cached
      const existingContent = await getCachedData(cacheKey);
      if (existingContent) {
        // Already cached, skip
        console.log(`Tab ${tabId} already cached, skipping preload`);
        return;
      }
      
      try {
        // Fetch tab content
        const content = await fetchTabContentFn(query, tabId, sessionId);
        
        // Use existing TTL logic
        const ttl = getTtlForTabType(tabId);
        
        // Cache the content
        await setCachedData(cacheKey, content, ttl);
        console.log(`Preloaded tab ${tabId} with TTL ${ttl}s`);
      } catch (error) {
        console.error(`Error preloading tab ${tabId}:`, error);
        // Continue with other tabs despite errors
      }
    });
    
    // Wait for all preload operations to complete
    await Promise.allSettled(preloadPromises);
    console.log(`Tab preloading completed for query "${query}"`);
  };
  
  /**
   * Clear tab cache for a specific query and tab, or all tabs for a query
   * @param query - The search query
   * @param tabId - Optional tab ID (if not provided, clears all tabs for the query)
   * @returns Success indicator
   */
  const clearTabCache = async (
    query: string, 
    tabId?: string
  ): Promise<boolean> => {
    try {
      if (tabId) {
        // Clear specific tab
        const params = {
          query,
          tab: tabId
        };
        
        const cacheKey = generateCacheKey('search', params);
        await clearCachedData(cacheKey);
        console.log(`Cleared cache for tab ${tabId} with query "${query}"`);
      } else {
        // Clear all tabs for this query
        const cachePattern = `search:${query}:*:*:tab-*`;
        await clearCachedData(cachePattern);
        console.log(`Cleared cache for all tabs with query "${query}"`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error clearing tab cache:`, error);
      return false;
    }
  };
  
  /**
   * Force refresh of tab cache
   * @param query - The search query
   * @param tabId - The tab ID to refresh
   * @param sessionId - Optional session ID
   * @returns Fresh tab content
   */
  const refreshTabCache = async (
    query: string, 
    tabId: string, 
    sessionId?: string
  ): Promise<any> => {
    const params = {
      query,
      tab: tabId
    };
    
    const cacheKey = generateCacheKey('search', params);
    
    try {
      // Clear existing cache for this tab
      await clearCachedData(cacheKey);
      
      // Fetch fresh content
      const freshContent = await fetchTabContentFn(query, tabId, sessionId);
      
      // Determine TTL
      const ttl = getTtlForTabType(tabId);
      
      // Cache with fresh content
      await setCachedData(cacheKey, freshContent, ttl);
      console.log(`Refreshed tab cache for ${cacheKey} with TTL ${ttl}s`);
      
      return freshContent;
    } catch (error) {
      console.error(`Error refreshing tab cache for ${tabId}:`, error);
      throw error;
    }
  };
  
  /**
   * Determine appropriate TTL for a tab based on its type
   * @param tabId - The tab ID
   * @param tabName - Optional tab name for better type detection
   * @returns TTL in seconds
   */
  const getTtlForTabType = (
    tabId: string, 
    tabName?: string
  ): number => {
    // Use tab name if provided for better type matching
    if (tabName) {
      const normalizedName = tabName.toLowerCase().trim();
      
      // Check for exact matches in map
      for (const [key, type] of Object.entries(TAB_TYPE_MAP)) {
        if (normalizedName === key || normalizedName.includes(key)) {
          return TAB_TTL[type] || TAB_TTL.DEFAULT;
        }
      }
    }
    
    // No match by name, try to infer from tab ID
    const normalizedId = tabId.toLowerCase().trim();
    
    for (const [key, type] of Object.entries(TAB_TYPE_MAP)) {
      if (normalizedId === key || normalizedId.includes(key)) {
        return TAB_TTL[type] || TAB_TTL.DEFAULT;
      }
    }
    
    // Default TTL if no match
    return TAB_TTL.DEFAULT;
  };
  
  // Return the utility functions
  return {
    getTabContent,
    cacheTabContent,
    preloadTabContent,
    clearTabCache,
    refreshTabCache,
    getTtlForTabType
  };
}

/**
 * Create common tab labels from a list of tab names
 * @param tabData - Array of tab data with names
 * @returns Mapping of normalized tab labels to original tab IDs
 */
export function createTabLabelMap(tabData: Array<{ id: string, name: string }>): Record<string, string> {
  const labelMap: Record<string, string> = {};
  
  tabData.forEach(tab => {
    if (tab.name && tab.id) {
      // Normalize the name for consistent lookup
      const normalizedName = tab.name.toLowerCase()
        .replace(/\([^)]*\)/g, '') // Remove content in parentheses
        .replace(/\[[^\]]*\]/g, '') // Remove content in brackets
        .trim();
      
      labelMap[normalizedName] = tab.id;
    }
  });
  
  return labelMap;
}

/**
 * Predict which tabs might be accessed next based on current tab
 * @param currentTabId - The current tab ID
 * @param availableTabIds - Array of all available tab IDs
 * @returns Array of tab IDs predicted to be accessed next
 */
export function predictNextTabs(
  currentTabId: string, 
  availableTabIds: string[]
): string[] {
  // Filter out current tab
  const otherTabs = availableTabIds.filter(id => id !== currentTabId);
  
  // For now, use a simple prediction strategy:
  // 1. Always include the "All" tab if it exists
  // 2. Include up to 2 adjacent tabs (by position)
  const predictions: string[] = [];
  
  // Find "All" tab
  const allTabIndex = otherTabs.findIndex(id => 
    id.toLowerCase() === 'all' || 
    id.toLowerCase().includes('all') ||
    id.toLowerCase() === 'results');
  
  if (allTabIndex >= 0) {
    predictions.push(otherTabs[allTabIndex]);
  }
  
  // Find current tab index in full list
  const currentIndex = availableTabIds.indexOf(currentTabId);
  
  // Add adjacent tabs (if they exist)
  if (currentIndex > 0) {
    predictions.push(availableTabIds[currentIndex - 1]);
  }
  
  if (currentIndex < availableTabIds.length - 1) {
    predictions.push(availableTabIds[currentIndex + 1]);
  }
  
  // Return unique predictions
  return [...new Set(predictions)];
}

/**
 * Default export - create tab cache utilities with a default fetch function
 * @param fetchFn - Function to fetch tab content
 * @returns Tab cache utilities
 */
export default function createTabCache(
  fetchFn: (query: string, tabId: string, sessionId?: string) => Promise<any>
): TabCacheUtils {
  return createTabCacheUtils(fetchFn);
}