/**
 * @fileoverview Integrated Tabs Manager
 * 
 * This module works WITH the existing integration.js and search-bundle.js
 * instead of competing with them for event handling.
 * 
 * @author Victor Chimenti
 * @version 3.0.2
 * @lastModified 2025-04-06
 */

class TabsManager {
  /**
   * Initialize the Tabs Manager
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    this.isFromTabNavigation = false;
    this.initialize();
  }
  
  /**
   * Initialize tab functionality by integrating with existing scripts
   */
  initialize() {
    console.log('Initializing Integrated TabsManager');
    
    // Instead of adding our own event listeners, we'll replace the existing
    // performSearch function in the window scope to intercept tab navigation
    
    if (window.performSearch) {
      // Store the original function
      this.originalPerformSearch = window.performSearch;
      
      // Replace it with our enhanced version
      window.performSearch = this.enhancedPerformSearch.bind(this);
      console.log('Enhanced performSearch function installed');
    } else {
      console.warn('Window performSearch function not found');
    }
    
    // Override the URL update function to prevent URL changes
    if (window.updateSearchUrl || window.updateUrl) {
      this.originalUpdateUrl = window.updateSearchUrl || window.updateUrl;
      
      // Only replace if coming from our tabs
      const originalFn = this.originalUpdateUrl;
      const self = this;
      
      window.updateSearchUrl = window.updateUrl = function(query) {
        // If query contains tab navigation markers, don't update the URL
        if (self.isFromTabNavigation) {
          console.log('Skipping URL update for tab navigation');
          self.isFromTabNavigation = false;
          return;
        }
        
        // Otherwise use the original function
        return originalFn(query);
      };
      
      console.log('Enhanced URL update function installed');
    }
    
    // Set up minimal click detection to flag tab clicks
    document.addEventListener('click', this.flagTabClick.bind(this));
    
    console.log('Tab click detection active');
  }
  
  /**
   * Flag clicks on tab elements to prevent URL updates
   * @param {Event} e - The click event
   */
  flagTabClick(e) {
    // Try various tab selectors
    const possibleTabSelectors = [
      '.tab-list__nav a',
      '.tab__button',
      'a[role="tab"]'
    ];
    
    for (const selector of possibleTabSelectors) {
      const element = e.target.closest(selector);
      if (element) {
        // Mark that this is a tab navigation
        this.isFromTabNavigation = true;
        
        // Set the flag in core manager if available
        if (this.core && typeof this.core.isFromTabNavigation !== 'undefined') {
          this.core.isFromTabNavigation = true;
        }
        
        // Also set the flag in the tabs module of core manager if it exists
        if (this.core && this.core.modules && this.core.modules.tabs) {
          this.core.modules.tabs.isFromTabNavigation = true;
        }
        
        console.log('Tab click flagged:', element.textContent.trim());
        break;
      }
    }
  }
  
  /**
   * Enhanced performSearch function that handles tab content specially
   * @param {string} query - The search query or tab URL
   * @param {HTMLElement|string} containerId - Results container or its ID
   * @param {string} sessionId - Session ID for tracking
   */
  async enhancedPerformSearch(query, containerId, sessionId) {
    // Determine if this is a tab navigation by checking for tab-specific URL patterns
    const isTabNavigation = query.includes('form=partial') && 
                           (query.includes('tab=') || query.includes('Tab='));
    
    // Get container reference
    const container = typeof containerId === 'string' ? 
                     document.getElementById(containerId) : containerId;
    
    if (!container) {
      console.error('Container not found for search/tab navigation');
      return;
    }
    
    if (!sessionId) {
      // Use the available session ID retrieval function
      if (window.getOrCreateSearchSessionId) {
        sessionId = window.getOrCreateSearchSessionId();
      } else if (window.getOrCreateSessionId) {
        sessionId = window.getOrCreateSessionId();
      } else if (this.core && this.core.sessionId) {
        sessionId = this.core.sessionId;
      }
    }
    
    if (isTabNavigation) {
      console.log('Tab navigation detected, using our specialized handler');
      
      // Set the flag to prevent URL updates and scrolling
      this.isFromTabNavigation = true;
      
      // Set the flag in core manager if available
      if (this.core && typeof this.core.isFromTabNavigation !== 'undefined') {
        this.core.isFromTabNavigation = true;
      }
      
      // Also set the flag in the tabs module of core manager if it exists
      if (this.core && this.core.modules && this.core.modules.tabs) {
        this.core.modules.tabs.isFromTabNavigation = true;
      }
      
      try {
        // Show loading state if needed
        container.classList.add('loading');
        
        // Get the current scroll position before loading tab content
        const scrollY = window.scrollY;
        
        // Use our core's fetch method to get the content
        console.log('Fetching tab content via core manager');
        const response = await this.core.fetchFromProxy(query, 'search');
        
        // Update results container
        this.core.updateResults(response);
        
        // Restore the scroll position to prevent unwanted scrolling
        window.scrollTo({
          top: scrollY,
          behavior: 'auto'
        });
        
        console.log('Tab content fetched and displayed');
        
        // Reset the flag after a short delay
        setTimeout(() => {
          this.isFromTabNavigation = false;
          
          if (this.core && typeof this.core.isFromTabNavigation !== 'undefined') {
            this.core.isFromTabNavigation = false;
          }
        }, 100);
        
        return; // Skip the original function
      } catch (error) {
        console.error('Error fetching tab content:', error);
        
        // Show error in container
        container.innerHTML = `
          <div class="search-error">
            <h3>Error Loading Tab Content</h3>
            <p>${error.message}</p>
          </div>
        `;
      } finally {
        // Remove loading state
        container.classList.remove('loading');
      }
    } else {
      // For regular searches, use the original function
      console.log('Regular search detected, using original handler');
      return this.originalPerformSearch(query, containerId, sessionId);
    }
  }
  
  /**
   * Handle DOM changes (required interface method)
   * @param {NodeList} addedNodes - The nodes added to the DOM
   */
  handleDomChanges(addedNodes) {
    // No special handling needed
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Restore original functions
    if (this.originalPerformSearch) {
      window.performSearch = this.originalPerformSearch;
    }
    
    if (this.originalUpdateUrl) {
      window.updateSearchUrl = window.updateUrl = this.originalUpdateUrl;
    }
    
    document.removeEventListener('click', this.flagTabClick.bind(this));
  }
}

export default TabsManager;