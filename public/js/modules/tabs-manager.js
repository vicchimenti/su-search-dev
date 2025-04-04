/**
 * @fileoverview Tabs Manager Module
 * 
 * This module handles the tab navigation for search results.
 * It manages tab clicks, content loading, and state persistence.
 * 
 * @author Victor Chimenti
 * @version 1.0.1
 * @lastModified 2025-04-04
 */

class TabsManager {
  /**
   * Initialize the Tabs Manager
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    this.activeTabId = null;
    this.tabSelector = '.tab-list__nav a'; // Use exact original selector
    
    // Initialize if tabs exist on the page
    this.initialize();
  }
  
  /**
   * Initialize tab functionality
   */
  initialize() {
    console.log('Initializing TabsManager with selector:', this.tabSelector);
    
    // Log existing tabs for debugging
    const existingTabs = document.querySelectorAll(this.tabSelector);
    console.log(`Found ${existingTabs.length} tab elements:`, existingTabs);
    
    // Set up delegation for tab clicks
    document.addEventListener('click', this.handleTabClick.bind(this));
    
    // Set initial active tab based on URL or default
    this.setInitialActiveTab();
  }
  
  /**
   * Set the initial active tab based on URL parameters or default to first tab
   */
  setInitialActiveTab() {
    // Check URL parameters for tab selection
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    if (tabParam) {
      // Try to find and activate the tab from URL parameter
      const tabElement = document.querySelector(`${this.tabSelector}[data-tab-id="${tabParam}"]`) || 
                         document.querySelector(`${this.tabSelector}[href="#${tabParam}"]`);
      
      if (tabElement) {
        console.log('Found matching tab element from URL param:', tabElement);
        this.activateTab(tabElement, false); // Don't fetch content if it's the initial load
        return;
      }
    }
    
    // Default to first tab if no tab parameter or tab not found
    const firstTab = document.querySelector(this.tabSelector);
    if (firstTab) {
      console.log('Using first tab as default:', firstTab);
      this.activateTab(firstTab, false);
    } else {
      console.warn('No tab elements found on the page');
      
      // Try an alternative approach - look for tab-like elements
      const alternativeSelector = '.tabs a, [role="tab"], a[href*="tab="], a[href*="Tab="]';
      const alternativeTabs = document.querySelectorAll(alternativeSelector);
      
      if (alternativeTabs.length > 0) {
        console.log(`Found ${alternativeTabs.length} alternative tab-like elements`);
        this.tabSelector = alternativeSelector; // Update selector for future use
      }
    }
  }
  
  /**
   * Handle tab click events through delegation
   * @param {Event} e - The click event
   */
  handleTabClick(e) {
    const tabElement = e.target.closest(this.tabSelector);
    if (!tabElement) return;
    
    console.log('Tab click intercepted:', tabElement);
    
    // Stop event propagation to prevent other handlers from interfering
    e.stopPropagation();
    
    // Prevent default navigation - This is crucial to prevent page reload
    e.preventDefault();
    
    console.log('Tab clicked, default prevented:', tabElement.textContent.trim());
    
    // Activate the clicked tab
    this.activateTab(tabElement, true);
    
    // Return false to ensure no other handlers run
    return false;
  }
  
  /**
   * Activate a tab and optionally load its content
   * @param {Element} tabElement - The tab element to activate
   * @param {boolean} fetchContent - Whether to fetch new content
   */
  async activateTab(tabElement, fetchContent = true) {
    // Get tab ID
    const tabId = tabElement.getAttribute('data-tab-id') || 
                 tabElement.getAttribute('href')?.split('#')[1] || 
                 tabElement.textContent.trim().toLowerCase().replace(/\s+/g, '-');
    
    if (this.activeTabId === tabId) {
      console.log('Tab already active:', tabId);
      return;
    }
    
    console.log('Activating tab:', tabId);
    this.activeTabId = tabId;
    
    // Update active tab styling
    this.updateActiveTabStyle(tabElement);
    
    // Update URL to reflect tab change
    this.updateUrlWithTab(tabId);
    
    // Fetch tab content if needed
    if (fetchContent) {
      await this.fetchTabContent(tabElement);
    }
    
    // Track tab change in analytics
    this.trackTabChange(tabId);
  }
  
  /**
   * Update the active tab visual styling
   * @param {Element} activeTabElement - The newly active tab element
   */
  updateActiveTabStyle(activeTabElement) {
    // Remove active class from all tabs
    const allTabs = document.querySelectorAll(this.tabSelector);
    allTabs.forEach(tab => {
      tab.classList.remove('active', 'current');
      tab.setAttribute('aria-selected', 'false');
      
      // Also handle parent li if it exists
      const parentLi = tab.closest('li');
      if (parentLi) {
        parentLi.classList.remove('active', 'current');
      }
    });
    
    // Add active class to selected tab
    activeTabElement.classList.add('active', 'current');
    activeTabElement.setAttribute('aria-selected', 'true');
    
    // Also handle parent li if it exists
    const parentLi = activeTabElement.closest('li');
    if (parentLi) {
      parentLi.classList.add('active', 'current');
    }
  }
  
  /**
   * Update the URL to include the active tab
   * @param {string} tabId - The ID of the active tab
   */
  updateUrlWithTab(tabId) {
    if (!history || !history.pushState) return;
    
    const url = new URL(window.location);
    url.searchParams.set('tab', tabId);
    
    // Update URL without reloading the page
    history.pushState({ tab: tabId }, '', url);
  }
  
  /**
   * Fetch content for the selected tab
   * @param {Element} tabElement - The tab element
   */
  async fetchTabContent(tabElement) {
    const href = tabElement.getAttribute('href');
    if (!href) return;
    
    // Skip if it's just a hash link
    if (href.startsWith('#')) return;
    
    try {
      // Show loading indicator
      const resultsContainer = document.getElementById('results');
      if (resultsContainer) {
        resultsContainer.classList.add('loading');
      }
      
      console.log('Fetching tab content for URL:', href);
      
      // Fetch content from proxy
      const response = await this.core.fetchFromProxy(href, 'search');
      
      // Update results container
      this.core.updateResults(response);
    } catch (error) {
      console.error('Error fetching tab content:', error);
    } finally {
      // Hide loading indicator
      const resultsContainer = document.getElementById('results');
      if (resultsContainer) {
        resultsContainer.classList.remove('loading');
      }
    }
  }
  
  /**
   * Track tab change in analytics
   * @param {string} tabId - The ID of the selected tab
   */
  trackTabChange(tabId) {
    // Only track if we have a query
    if (!this.core.originalQuery) return;
    
    // Prepare analytics data
    const analyticsData = {
      type: 'tabChange',
      query: this.core.originalQuery,
      tab: tabId,
      sessionId: this.core.sessionId,
      timestamp: new Date().toISOString()
    };
    
    // Send analytics data
    this.core.sendAnalyticsData(analyticsData);
  }
  
  /**
   * Handle DOM changes to attach event listeners to new tabs
   * @param {NodeList} addedNodes - Nodes added to the DOM
   */
  handleDomChanges(addedNodes) {
    // Re-apply active tab styling
    if (this.activeTabId) {
      const activeTab = document.querySelector(`${this.tabSelector}[data-tab-id="${this.activeTabId}"]`) || 
                       document.querySelector(`${this.tabSelector}[href="#${this.activeTabId}"]`);
      
      if (activeTab) {
        this.updateActiveTabStyle(activeTab);
      }
    }
  }
  
  /**
   * Clean up resources when the module is destroyed
   */
  destroy() {
    document.removeEventListener('click', this.handleTabClick.bind(this));
  }
}

export default TabsManager;