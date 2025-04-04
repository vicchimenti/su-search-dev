/**
 * @fileoverview Tabs Manager
 * 
 * A simplified tabs manager that directly mimics the behavior
 * of the original dynamic-results-manager.js implementation.
 * 
 * @author Victor Chimenti
 * @version 2.0.0
 * @lastModified 2025-04-05
 */

class TabsManager {
  /**
   * Initialize the Tabs Manager
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    this.initialize();
  }
  
  /**
   * Initialize tab functionality
   */
  initialize() {
    console.log('Initializing simplified TabsManager');
    
    // Set up global click handler
    document.addEventListener('click', this.handleClick.bind(this));
    
    console.log('Tab click handler registered');
  }
  
  /**
   * Handle all clicks and filter for tabs
   * @param {Event} e - The click event
   */
  async handleClick(e) {
    // Look for tab clicks using the exact original selector
    const tabElement = e.target.closest('.tab-list__nav a');
    
    if (tabElement) {
      console.log('Tab click detected:', tabElement.textContent.trim());
      e.preventDefault();
      
      const href = tabElement.getAttribute('href');
      if (href) {
        try {
          console.log('Fetching tab content for:', href);
          
          // Show loading state if needed
          const resultsContainer = document.getElementById('results');
          if (resultsContainer) {
            resultsContainer.classList.add('loading');
          }
          
          // Fetch content exactly as the original code did
          const response = await this.core.fetchFromProxy(href, 'search');
          
          // Update results container
          this.core.updateResults(response);
          
          console.log('Tab content updated');
        } catch (error) {
          console.error('Error handling tab click:', error);
        } finally {
          // Remove loading state
          const resultsContainer = document.getElementById('results');
          if (resultsContainer) {
            resultsContainer.classList.remove('loading');
          }
        }
      }
    }
  }
  
  /**
   * Handle DOM changes (required interface method)
   */
  handleDomChanges() {
    // Nothing to do here in this simplified version
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    document.removeEventListener('click', this.handleClick.bind(this));
  }
}

export default TabsManager;