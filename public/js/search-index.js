/**
 * @fileoverview Search Modules Index
 * 
 * This file serves as the entry point for the modular search functionality.
 * It initializes the core search manager and loads the required modules.
 * 
 * @license MIT
 * @author Victor Chimenti
 * @version 1.0.1
 * @lastUpdated 2025-04-28
 */

// Import core manager
import searchManager from './modules/core-search-manager.js';

// Initialize the search functionality when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Configure manager with site-specific settings
  const config = {
    proxyBaseUrl: 'https://funnelback-proxy-dev.vercel.app/proxy',
    enabledModules: [
      'tabs',       // Tab navigation
      'facets',     // Faceted search
      'pagination', // Page navigation
      'spelling',   // Spelling suggestions
      'analytics'   // Click tracking and analytics
    ],
    // Optional overrides for default settings
    defaultResultsPerPage: 10,
    searchInputSelector: '#autocomplete-concierge-inputField',
    resultsContainerSelector: '#results'
  };

  // Initialize the search manager with configuration
  searchManager.init(config);

});

// Export for global access if needed
window.SearchManager = searchManager;