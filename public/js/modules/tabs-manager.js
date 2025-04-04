/**
 * @fileoverview Tabs Manager Module for Seattle University Search
 * 
 * This module handles tab navigation for search results based on the actual
 * HTML structure used in Seattle University's search interface.
 * 
 * @author Victor Chimenti
 * @version 1.0.3
 * @lastModified 2025-04-05
 */

class TabsManager {
  /**
   * Initialize the Tabs Manager
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    
    // Primary tab selector based on the actual HTML structure
    this.tabSelector = '.tab__button';
    
    // Alternative selectors as fallbacks
    this.alternativeSelectors = [
      '[role="tab"]',
      '.tab-list__nav a',
      '[data-tab-group-control]'
    ];
    
    // Initialize
    this.initialize();
  }
  
  /**
   * Initialize tab functionality
   */
  initialize() {
    console.log('Initializing TabsManager...');
    
    // Find tab elements
    let tabs = document.querySelectorAll(this.tabSelector);
    
    // If no tabs found with primary selector, try alternatives
    if (tabs.length === 0) {
      for (const selector of this.alternativeSelectors) {
        tabs = document.querySelectorAll(selector);
        if (tabs.length > 0) {
          console.log(`Found ${tabs.length} tab elements with selector: ${selector}`);
          this.tabSelector = selector;
          break;
        }
      }
    } else {
      console.log(`Found ${tabs.length} tab elements with selector: ${this.tabSelector}`);
    }
    
    // Log found tabs
    Array.from(tabs).forEach((tab, index) => {
      console.log(`Tab ${index + 1}: ${tab.textContent.trim()}, Selected: ${tab.getAttribute('aria-selected')}`);
    });
    
    // Set up delegation for tab clicks
    document.addEventListener('click', this.handleTabClick.bind(this));
    
    // Store initial active tab
    this.findAndStoreActiveTab();
  }
  
  /**
   * Find and store the currently active tab
   */
  findAndStoreActiveTab() {
    // Look for tab with aria-selected="true"
    const activeTab = document.querySelector(`${this.tabSelector}[aria-selected="true"]`);
    
    if (activeTab) {
      this.activeTabElement = activeTab;
      console.log('Found active tab:', this.activeTabElement.textContent.trim());
    } else {
      // If no active tab found, use the first tab
      const firstTab = document.querySelector(this.tabSelector);
      if (firstTab) {
        this.activeTabElement = firstTab;
        console.log('No active tab found, using first tab:', this.activeTabElement.textContent.trim());
      }
    }
  }
  
  /**
   * Handle tab click events through delegation
   * @param {Event} e - The click event
   */
  handleTabClick(e) {
    // Find if a tab was clicked
    const tabElement = e.target.closest(this.tabSelector);
    if (!tabElement) return;
    
    // Verify it's a tab with role="tab" (if available)
    const role = tabElement.getAttribute('role');
    if (role && role !== 'tab') return;
    
    // Check if already active
    if (tabElement.getAttribute('aria-selected') === 'true') {
      console.log('Tab already active:', tabElement.textContent.trim());
      return;
    }
    
    console.log('Tab clicked:', tabElement.textContent.trim());
    
    // Prevent default navigation and stop propagation
    e.preventDefault();
    e.stopPropagation();
    
    // Activate the clicked tab
    this.activateTab(tabElement);
    
    // Return false to ensure no other handlers run
    return false;
  }
  
  /**
   * Activate a tab and load its content
   * @param {Element} tabElement - The tab element to activate
   */
  async activateTab(tabElement) {
    console.log('Activating tab:', tabElement.textContent.trim());
    
    // Update tab styling
    this.updateActiveTabStyle(tabElement);
    
    // Store as active tab
    this.activeTabElement = tabElement;
    
    // Get tab content URL
    const href = tabElement.getAttribute('href');
    if (!href) {
      console.warn('Tab has no href attribute, cannot fetch content');
      return;
    }
    
    try {
      // Show loading indicator
      const resultsContainer = document.getElementById('results');
      if (resultsContainer) {
        resultsContainer.classList.add('loading');
      }
      
      console.log('Fetching tab content from:', href);
      
      // Fetch content from proxy
      const response = await this.core.fetchFromProxy(href, 'search');
      
      // Update results container
      this.core.updateResults(response);
      
      console.log('Tab content fetched and displayed');
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
   * Update the active tab visual styling
   * @param {Element} activeTabElement - The newly active tab element
   */
  updateActiveTabStyle(activeTabElement) {
    // Get all tabs
    const allTabs = document.querySelectorAll(this.tabSelector);
    
    // Update aria-selected and active classes
    allTabs.forEach(tab => {
      // Remove active class and update aria
      tab.setAttribute('aria-selected', 'false');
      tab.classList.remove('tab__button--active');
      
      // Handle any parent elements that need styling
      const tabControl = tab.getAttribute('data-tab-group-control');
      if (tabControl) {
        // Find and update any associated tab panels
        const tabPanel = document.querySelector(`[data-tab-group-element="${tabControl}"]`);
        if (tabPanel) {
          tabPanel.classList.remove('active');
          tabPanel.setAttribute('aria-hidden', 'true');
        }
      }
    });
    
    // Set active tab
    activeTabElement.setAttribute('aria-selected', 'true');
    activeTabElement.classList.add('tab__button--active');
    
    // Handle any parent elements that need styling
    const tabControl = activeTabElement.getAttribute('data-tab-group-control');
    if (tabControl) {
      // Find and update any associated tab panels
      const tabPanel = document.querySelector(`[data-tab-group-element="${tabControl}"]`);
      if (tabPanel) {
        tabPanel.classList.add('active');
        tabPanel.setAttribute('aria-hidden', 'false');
      }
    }
  }
  
  /**
   * Handle DOM changes to check for tab updates
   * @param {NodeList} addedNodes - Nodes added to the DOM
   */
  handleDomChanges(addedNodes) {
    // After content changes, see if we need to find tabs again
    const tabs = document.querySelectorAll(this.tabSelector);
    
    if (tabs.length === 0) {
      console.log('No tabs found after DOM change, reinitializing tab detection');
      this.initialize();
    } else if (this.activeTabElement && !document.contains(this.activeTabElement)) {
      console.log('Active tab removed from DOM, finding new active tab');
      this.findAndStoreActiveTab();
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