/**
 * @fileoverview ResultsManager - Search results display component
 * 
 * This module manages the display and interaction with search results,
 * handling result rendering, click tracking, and dynamic updates.
 * 
 * Features:
 * - Result rendering and display
 * - Click tracking for analytics
 * - Dynamic content updates
 * - Loading state management
 * - Empty state handling
 * - Error state handling
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace ResultsManager
 * @requires EventBus, DomUtils
 * @lastUpdated 2025-04-02
 */

import EventBus from '../core/EventBus.js';
import { createElement } from '../utils/DomUtils.js';

/**
 * Default configuration for ResultsManager
 * @type {Object}
 */
const DEFAULT_CONFIG = {
  // Container selector
  containerSelector: '#results',
  
  // Loading/state classes
  loadingClass: 'is-loading',
  errorClass: 'has-error',
  emptyClass: 'is-empty',
  
  // Behavior
  scrollToResults: true,
  scrollOffset: 20,
  trackClicks: true,
  
  // CSS selectors
  selectors: {
    resultItem: '.search-result-item, .fb-result, .listing-item',
    resultLink: '.search-result-item h3 a, .fb-result h3 a, .listing-item__title a',
    pagination: '.pagination',
    paginationLink: '.pagination__link',
    facet: '.facet',
    facetLink: '.facet-group__list a, .facet-breadcrumb__link',
    tab: '.tab-list__nav a',
    loadingIndicator: '.loading-indicator',
    errorContainer: '.error-container',
    emptyContainer: '.empty-container'
  }
};

/**
 * ResultsManager - Manage search results display and interaction
 */
class ResultsManager {
  /**
   * Create a new ResultsManager instance
   * @param {Object} config - Component configuration
   */
  constructor(config = {}) {
    // Apply configuration with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize state
    this.state = {
      isLoading: false,
      hasError: false,
      errorMessage: '',
      isEmpty: false,
      query: '',
      resultCount: 0,
      currentPage: 1
    };
    
    // Initialize elements
    this._initElements();
    
    // Set up mutation observer for dynamic content
    this._initMutationObserver();
    
    // Set up event handlers
    this._setupEventHandlers();
    
    // Set up event listeners
    this._initEventListeners();
  }
  
  /**
   * Initialize DOM elements
   * @private
   */
  _initElements() {
    // Get container element
    this.container = document.querySelector(this.config.containerSelector);
    
    // Validate container
    if (!this.container) {
      console.error(`ResultsManager: Container element not found: ${this.config.containerSelector}`);
      return;
    }
    
    // Create loading indicator if it doesn't exist
    this._createStaticElements();
    
    // Check for URL parameters
    this._checkUrlParameters();
  }
  
  /**
   * Create static elements for various states
   * @private
   */
  _createStaticElements() {
    // Create loading indicator if it doesn't exist
    if (!this.container.querySelector(this.config.selectors.loadingIndicator)) {
      const loadingIndicator = createElement('div', {
        className: 'loading-indicator',
        innerHTML: '<div class="spinner"></div><p>Loading results...</p>'
      });
      loadingIndicator.hidden = true;
      this.container.appendChild(loadingIndicator);
    }
    
    // Create error container if it doesn't exist
    if (!this.container.querySelector(this.config.selectors.errorContainer)) {
      const errorContainer = createElement('div', {
        className: 'error-container',
        innerHTML: '<h3>Error Loading Results</h3><p class="error-message"></p>'
      });
      errorContainer.hidden = true;
      this.container.appendChild(errorContainer);
    }
    
    // Create empty container if it doesn't exist
    if (!this.container.querySelector(this.config.selectors.emptyContainer)) {
      const emptyContainer = createElement('div', {
        className: 'empty-container',
        innerHTML: '<h3>No Results Found</h3><p>Try broadening your search terms or using different keywords.</p>'
      });
      emptyContainer.hidden = true;
      this.container.appendChild(emptyContainer);
    }
  }
  
  /**
   * Check URL parameters for initial search
   * @private
   */
  _checkUrlParameters() {
    // Processed by SearchCore, no need to duplicate logic here
  }
  
  /**
   * Initialize mutation observer for dynamic content
   * @private
   */
  _initMutationObserver() {
    // Observer configuration
    const observerConfig = {
      childList: true,
      subtree: true
    };
    
    // Create observer
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Process added nodes
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this._processAddedNode(node);
            }
          });
        }
      });
    });
    
    // Start observing
    if (this.container) {
      this.observer.observe(this.container, observerConfig);
    }
  }
  
  /**
   * Process added DOM nodes for dynamic content
   * @private
   * @param {Node} node - Added DOM node
   */
  _processAddedNode(node) {
    // Attach event listeners to interactive elements
    
    // Result links
    const resultLinks = node.querySelectorAll(this.config.selectors.resultLink);
    resultLinks.forEach(link => {
      if (!link.getAttribute('data-tracking-initialized')) {
        link.addEventListener('click', this._handleResultLinkClick.bind(this));
        link.setAttribute('data-tracking-initialized', 'true');
      }
    });
    
    // Pagination links
    const paginationLinks = node.querySelectorAll(this.config.selectors.paginationLink);
    paginationLinks.forEach(link => {
      if (!link.getAttribute('data-initialized')) {
        link.addEventListener('click', this._handlePaginationClick.bind(this));
        link.setAttribute('data-initialized', 'true');
      }
    });
    
    // Facet links
    const facetLinks = node.querySelectorAll(this.config.selectors.facetLink);
    facetLinks.forEach(link => {
      if (!link.getAttribute('data-initialized')) {
        link.addEventListener('click', this._handleFacetClick.bind(this));
        link.setAttribute('data-initialized', 'true');
      }
    });
    
    // Tab links
    const tabLinks = node.querySelectorAll(this.config.selectors.tab);
    tabLinks.forEach(link => {
      if (!link.getAttribute('data-initialized')) {
        link.addEventListener('click', this._handleTabClick.bind(this));
        link.setAttribute('data-initialized', 'true');
      }
    });
    
    // Extract result count if present
    const funnelbackContainer = node.querySelector('.funnelback-search-container');
    if (funnelbackContainer) {
      // Try to extract result count from HTML
      this._extractResultCount(funnelbackContainer.innerHTML);
    }
  }
  
  /**
   * Extract result count from HTML response
   * @private
   * @param {string} html - HTML response content
   */
  _extractResultCount(html) {
    try {
      // Look for result count in HTML response using regex
      const match = html.match(/totalMatching">([0-9,]+)</);
      if (match && match[1]) {
        const count = parseInt(match[1].replace(/,/g, ''), 10);
        
        // Update state
        this.state.resultCount = count;
        this.state.isEmpty = count === 0;
        
        // Update UI states based on count
        this._updateEmptyState();
      }
    } catch (error) {
      console.error('Error extracting result count:', error);
    }
  }
  
  /**
   * Set up event handlers
   * @private
   */
  _setupEventHandlers() {
    // Result link click handler
    this._onResultLinkClick = this._handleResultLinkClick.bind(this);
    
    // Pagination click handler
    this._onPaginationClick = this._handlePaginationClick.bind(this);
    
    // Facet click handler
    this._onFacetClick = this._handleFacetClick.bind(this);
    
    // Tab click handler
    this._onTabClick = this._handleTabClick.bind(this);
  }
  
  /**
   * Initialize event listeners
   * @private
   */
  _initEventListeners() {
    // Find and initialize existing interactive elements
    this._initializeExistingElements();
    
    // Subscribe to events from other components
    EventBus.on('results:update', this._handleResultsUpdate.bind(this));
    EventBus.on('search:loading', this._handleSearchLoading.bind(this));
    EventBus.on('search:error', this._handleSearchError.bind(this));
    EventBus.on('query:submit', this._handleQuerySubmit.bind(this));
  }
  
  /**
   * Initialize existing interactive elements
   * @private
   */
  _initializeExistingElements() {
    if (!this.container) return;
    
    // Result links
    const resultLinks = this.container.querySelectorAll(this.config.selectors.resultLink);
    resultLinks.forEach(link => {
      if (!link.getAttribute('data-tracking-initialized')) {
        link.addEventListener('click', this._onResultLinkClick);
        link.setAttribute('data-tracking-initialized', 'true');
      }
    });
    
    // Pagination links
    const paginationLinks = this.container.querySelectorAll(this.config.selectors.paginationLink);
    paginationLinks.forEach(link => {
      if (!link.getAttribute('data-initialized')) {
        link.addEventListener('click', this._onPaginationClick);
        link.setAttribute('data-initialized', 'true');
      }
    });
    
    // Facet links
    const facetLinks = this.container.querySelectorAll(this.config.selectors.facetLink);
    facetLinks.forEach(link => {
      if (!link.getAttribute('data-initialized')) {
        link.addEventListener('click', this._onFacetClick);
        link.setAttribute('data-initialized', 'true');
      }
    });
    
    // Tab links
    const tabLinks = this.container.querySelectorAll(this.config.selectors.tab);
    tabLinks.forEach(link => {
      if (!link.getAttribute('data-initialized')) {
        link.addEventListener('click', this._onTabClick);
        link.setAttribute('data-initialized', 'true');
      }
    });
  }
  
  /**
   * Handle result link clicks for analytics tracking
   * @private
   * @param {Event} event - Click event
   */
  _handleResultLinkClick(event) {
    if (!this.config.trackClicks) return;
    
    // Don't prevent default navigation
    
    const link = event.currentTarget;
    if (!link) return;
    
    try {
      // Get link details
      const dataLiveUrl = link.getAttribute('data-live-url');
      const href = link.getAttribute('href') || '';
      const clickedUrl = dataLiveUrl || href; // Prioritize data-live-url
      const title = link.innerText.trim() || '';
      
      // Get position information
      let position = -1;
      const resultItem = link.closest(this.config.selectors.resultItem);
      
      if (resultItem) {
        const allResults = Array.from(document.querySelectorAll(this.config.selectors.resultItem));
        position = allResults.indexOf(resultItem) + 1;
      }
      
      // Emit click event for tracking
      EventBus.emit('result:click', {
        url: clickedUrl,
        title: title,
        position: position,
        query: this.state.query
      });
    } catch (error) {
      console.error('Error tracking result click:', error);
    }
  }
  
  /**
   * Handle pagination link clicks
   * @private
   * @param {Event} event - Click event
   */
  _handlePaginationClick(event) {
    event.preventDefault();
    
    const link = event.currentTarget;
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Get page number from href if possible
    let page = 1;
    const pageMatch = href.match(/page=(\d+)/);
    if (pageMatch && pageMatch[1]) {
      page = parseInt(pageMatch[1], 10);
    }
    
    // Update state
    this.state.currentPage = page;
    
    // Emit page change event
    EventBus.emit('page:change', page);
    
    // Apply loading state
    this._setLoadingState(true);
  }
  
  /**
   * Handle facet link clicks
   * @private
   * @param {Event} event - Click event
   */
  _handleFacetClick(event) {
    event.preventDefault();
    
    const link = event.currentTarget;
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Extract filter information
    const filterMatch = href.match(/f\.([^|]+)\|([^=]+)=([^&]+)/);
    
    if (filterMatch) {
      const [, name, subname, value] = filterMatch;
      const fullName = `f.${name}|${subname}`;
      
      // Check if this is a clear filter link
      const isClearFilter = link.closest('.facet-breadcrumb__link, .facet-group__clear');
      
      if (isClearFilter) {
        // Emit filter remove event
        EventBus.emit('filter:remove', { name: fullName, value });
      } else {
        // Emit filter add event
        EventBus.emit('filter:add', { name: fullName, value });
      }
    } else {
      // Handle clear all filters
      const isClearAllFilters = link.classList.contains('clear-all-filters') || 
                               link.closest('.clear-all-filters');
      
      if (isClearAllFilters) {
        EventBus.emit('filter:clear');
      } else {
        // Just use the href for direct Funnelback fetching
        this._fetchResults(href);
      }
    }
    
    // Apply loading state
    this._setLoadingState(true);
  }
  
  /**
   * Handle tab link clicks
   * @private
   * @param {Event} event - Click event
   */
  _handleTabClick(event) {
    event.preventDefault();
    
    const link = event.currentTarget;
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Extract tab information
    const tabMatch = href.match(/f\.Tabs\|([^=]+)=([^&]+)/);
    
    if (tabMatch) {
      const [, name, value] = tabMatch;
      const fullName = `f.Tabs|${name}`;
      
      // Clear existing tabs first
      EventBus.emit('tabs:clear');
      
      // Emit filter add event for the tab
      EventBus.emit('filter:add', { name: fullName, value });
    } else {
      // Just use the href for direct Funnelback fetching
      this._fetchResults(href);
    }
    
    // Apply loading state
    this._setLoadingState(true);
  }
  
  /**
   * Fetch results from a Funnelback URL
   * @private
   * @param {string} href - Funnelback URL
   */
  _fetchResults(href) {
    EventBus.emit('results:fetch', href);
  }
  
  /**
   * Handle results update event
   * @private
   * @param {Object} results - Search results data
   */
  _handleResultsUpdate(results) {
    // Update state
    this.state.resultCount = results.resultCount || 0;
    this.state.isEmpty = results.resultCount === 0;
    
    // Update UI
    this._updateEmptyState();
    
    // Remove loading state
    this._setLoadingState(false);
    
    // Clear error state
    this._clearErrorState();
    
    // Scroll to results if configured
    if (this.config.scrollToResults) {
      this._scrollToResults();
    }
  }
  
  /**
   * Handle search loading event
   * @private
   * @param {boolean} isLoading - Whether search is loading
   */
  _handleSearchLoading(isLoading) {
    this._setLoadingState(isLoading);
  }
  
  /**
   * Handle search error event
   * @private
   * @param {string} error - Error message
   */
  _handleSearchError(error) {
    this._setErrorState(error);
  }
  
  /**
   * Handle query submit event
   * @private
   * @param {string} query - The submitted query
   */
  _handleQuerySubmit(query) {
    // Update state
    this.state.query = query;
  }
  
  /**
   * Set loading state
   * @private
   * @param {boolean} isLoading - Whether results are loading
   */
  _setLoadingState(isLoading) {
    this.state.isLoading = isLoading;
    
    if (this.container) {
      this.container.classList.toggle(this.config.loadingClass, isLoading);
      
      // Show/hide loading indicator
      const loadingIndicator = this.container.querySelector(this.config.selectors.loadingIndicator);
      if (loadingIndicator) {
        loadingIndicator.hidden = !isLoading;
      }
    }
  }
  
  /**
   * Set error state
   * @private
   * @param {string} errorMessage - Error message
   */
  _setErrorState(errorMessage) {
    this.state.hasError = true;
    this.state.errorMessage = errorMessage;
    
    if (this.container) {
      this.container.classList.add(this.config.errorClass);
      
      // Show error container
      const errorContainer = this.container.querySelector(this.config.selectors.errorContainer);
      if (errorContainer) {
        errorContainer.hidden = false;
        
        // Update error message
        const errorMessageElement = errorContainer.querySelector('.error-message');
        if (errorMessageElement) {
          errorMessageElement.textContent = errorMessage;
        }
      }
      
      // Hide loading indicator
      this._setLoadingState(false);
    }
  }
  
  /**
   * Clear error state
   * @private
   */
  _clearErrorState() {
    this.state.hasError = false;
    this.state.errorMessage = '';
    
    if (this.container) {
      this.container.classList.remove(this.config.errorClass);
      
      // Hide error container
      const errorContainer = this.container.querySelector(this.config.selectors.errorContainer);
      if (errorContainer) {
        errorContainer.hidden = true;
      }
    }
  }
  
  /**
   * Update empty state based on result count
   * @private
   */
  _updateEmptyState() {
    if (this.container) {
      this.container.classList.toggle(this.config.emptyClass, this.state.isEmpty);
      
      // Show/hide empty container
      const emptyContainer = this.container.querySelector(this.config.selectors.emptyContainer);
      if (emptyContainer) {
        emptyContainer.hidden = !this.state.isEmpty;
      }
    }
  }
  
  /**
   * Scroll to results container
   * @private
   */
  _scrollToResults() {
    if (this.container) {
      const rect = this.container.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
      
      if (!isVisible) {
        // Calculate position
        const offsetTop = this.container.offsetTop - this.config.scrollOffset;
        
        // Scroll to position
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    }
  }
  
  /**
   * Update results with HTML content
   * @param {string} html - HTML content
   */
  updateResults(html) {
    if (this.container) {
      // Create wrapper if needed
      const wrapper = document.createElement('div');
      wrapper.className = 'funnelback-search-container';
      wrapper.innerHTML = html;
      
      // Clear container
      this.container.innerHTML = '';
      
      // Add wrapper
      this.container.appendChild(wrapper);
      
      // Extract result count
      this._extractResultCount(html);
      
      // Initialize interactive elements
      this._initializeExistingElements();
    }
  }
  
  /**
   * Clear results
   */
  clearResults() {
    if (this.container) {
      // Keep static elements
      const loadingIndicator = this.container.querySelector(this.config.selectors.loadingIndicator);
      const errorContainer = this.container.querySelector(this.config.selectors.errorContainer);
      const emptyContainer = this.container.querySelector(this.config.selectors.emptyContainer);
      
      // Clear container
      this.container.innerHTML = '';
      
      // Add back static elements
      if (loadingIndicator) this.container.appendChild(loadingIndicator);
      if (errorContainer) this.container.appendChild(errorContainer);
      if (emptyContainer) this.container.appendChild(emptyContainer);
      
      // Reset state
      this.state.resultCount = 0;
      this.state.isEmpty = true;
      
      // Update UI
      this._updateEmptyState();
    }
  }
  
  /**
   * Get the current result count
   * @returns {number} Current result count
   */
  getResultCount() {
    return this.state.resultCount;
  }
  
  /**
   * Destroy the component, removing event listeners and observers
   */
  destroy() {
    // Disconnect mutation observer
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Find and remove event listeners from interactive elements
    if (this.container) {
      // Result links
      const resultLinks = this.container.querySelectorAll(this.config.selectors.resultLink);
      resultLinks.forEach(link => {
        link.removeEventListener('click', this._onResultLinkClick);
      });
      
      // Pagination links
      const paginationLinks = this.container.querySelectorAll(this.config.selectors.paginationLink);
      paginationLinks.forEach(link => {
        link.removeEventListener('click', this._onPaginationClick);
      });
      
      // Facet links
      const facetLinks = this.container.querySelectorAll(this.config.selectors.facetLink);
      facetLinks.forEach(link => {
        link.removeEventListener('click', this._onFacetClick);
      });
      
      // Tab links
      const tabLinks = this.container.querySelectorAll(this.config.selectors.tab);
      tabLinks.forEach(link => {
        link.removeEventListener('click', this._onTabClick);
      });
    }
  }
}

export default ResultsManager;