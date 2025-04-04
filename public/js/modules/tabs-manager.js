/**
 * @fileoverview Tabs Manager Module
 * 
 * This module handles the tab navigation for search results.
 * It manages tab clicks, content loading, and state persistence.
 * 
 * @author Victor Chimenti
 * @version 1.0.0
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
      
      // Initialize if tabs exist on the page
      this.initialize();
    }
    
    /**
     * Initialize tab functionality
     */
    initialize() {
      console.log('Initializing TabsManager');
      
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
        const tabElement = document.querySelector(`.tab-list__nav a[data-tab-id="${tabParam}"]`);
        if (tabElement) {
          this.activateTab(tabElement, false); // Don't fetch content if it's the initial load
          return;
        }
      }
      
      // Default to first tab if no tab parameter or tab not found
      const firstTab = document.querySelector('.tab-list__nav a');
      if (firstTab) {
        this.activateTab(firstTab, false);
      }
    }
    
    /**
     * Handle tab click events through delegation
     * @param {Event} e - The click event
     */
    handleTabClick(e) {
      const tabElement = e.target.closest('.tab-list__nav a');
      if (!tabElement) return;
      
      // Prevent default navigation
      e.preventDefault();
      
      // Activate the clicked tab
      this.activateTab(tabElement, true);
    }
    
    /**
     * Activate a tab and optionally load its content
     * @param {Element} tabElement - The tab element to activate
     * @param {boolean} fetchContent - Whether to fetch new content
     */
    async activateTab(tabElement, fetchContent = true) {
      // Get tab ID
      const tabId = tabElement.getAttribute('data-tab-id') || tabElement.getAttribute('href').split('#')[1];
      
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
      const allTabs = document.querySelectorAll('.tab-list__nav a');
      allTabs.forEach(tab => {
        tab.classList.remove('active', 'current');
        tab.setAttribute('aria-selected', 'false');
      });
      
      // Add active class to selected tab
      activeTabElement.classList.add('active', 'current');
      activeTabElement.setAttribute('aria-selected', 'true');
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
      
      try {
        // Show loading indicator
        const resultsContainer = document.getElementById('results');
        if (resultsContainer) {
          resultsContainer.classList.add('loading');
        }
        
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
        const activeTab = document.querySelector(`.tab-list__nav a[data-tab-id="${this.activeTabId}"]`);
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