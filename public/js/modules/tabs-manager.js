/**
 * @fileoverview Integrated Tabs Manager
 * 
 * This module enhances tab navigation without conflicting with
 * existing scripts. It intercepts tab clicks, prevents URL updates,
 * and handles content loading properly.
 * 
 * @author Victor Chimenti
 * @version 3.5.2
 * @lastModified 2025-04-10
 */

class TabsManager {
  /**
   * Initialize the Tabs Manager
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    this.isFromTabNavigation = false;
    this.activeTabId = null;
    this.tabContainers = [];
    this.originalPerformSearch = null;
    this.originalUpdateUrl = null;

    // More reliable tab selectors
    this.tabSelectors = [
      '.tab-list__nav a',
      '.tab__button',
      'a[role="tab"]',
      '.tab_button',
      '[data-tab-group-control]'
    ];

    // Initialize
    this.initialize();
  }

  /**
   * Initialize tab functionality by integrating with existing scripts
   */
  initialize() {
    console.log('Initializing Integrated TabsManager');

    // Find tab containers
    this.findTabContainers();

    // Override window.performSearch to intercept tab navigation
    if (window.performSearch) {
      // Store the original function
      this.originalPerformSearch = window.performSearch;
      window.performSearch = this.enhancedPerformSearch.bind(this);
      console.log('Enhanced performSearch function installed');
    } else {
      console.warn('Window performSearch function not found');
    }

    // Override URL update functions to prevent URL changes during tab navigation
    const urlUpdateFunctions = ['updateSearchUrl', 'updateUrl'];
    for (const funcName of urlUpdateFunctions) {
      if (window[funcName]) {
        if (!this.originalUpdateUrl) {
          this.originalUpdateUrl = window[funcName];
        }

        window[funcName] = this.enhancedUpdateUrl.bind(this);
      }
    }

    if (this.originalUpdateUrl) {
      console.log('Enhanced URL update function installed');
    } else {
      console.warn('URL update functions not found');
    }

    // Add direct capture of tab clicks
    this.installTabClickHandlers();

    // Set initial active tab
    this.determineActiveTab();

    console.log('TabsManager initialized successfully');
  }

  /**
   * Find all tab containers in the page
   */
  findTabContainers() {
    // Look for common tab container selectors
    const containerSelectors = [
      '.tab-list__nav',
      '.tab-container',
      '[role="tablist"]',
      '.tabs'
    ];

    containerSelectors.forEach(selector => {
      const containers = document.querySelectorAll(selector);
      if (containers.length > 0) {
        containers.forEach(container => {
          this.tabContainers.push(container);
        });
      }
    });

    console.log(`Found ${this.tabContainers.length} tab container(s)`);
  }

  /**
   * Install tab click handlers via event delegation
   */
  installTabClickHandlers() {
    // Use direct tab container if found
    if (this.tabContainers.length > 0) {
      this.tabContainers.forEach(container => {
        container.addEventListener('click', this.handleTabClick.bind(this));
      });
      console.log('Tab click handlers added to tab containers');
    } else {
      // Fallback to document-level delegation
      document.addEventListener('click', this.flagTabClick.bind(this));
      console.log('Document-level tab click detection active');
    }
  }

  /**
   * Determine the active tab on page load
   */
  determineActiveTab() {
    // Look for the active tab using common attributes
    const activeTabSelectors = [
      '.tab-list__nav a[aria-selected="true"]',
      '.tab__button[aria-selected="true"]',
      'a[role="tab"][aria-selected="true"]',
      '.tab_button[aria-selected="true"]',
      '[data-tab-group-control][aria-selected="true"]',
      '.tab-list__nav a.active',
      '.tab__button.active',
      '.tab_button.active'
    ];

    for (const selector of activeTabSelectors) {
      const activeTab = document.querySelector(selector);
      if (activeTab) {
        this.activeTabId = activeTab.id || activeTab.getAttribute('data-tab-group-control');
        const tabName = this.extractCleanTabName(activeTab);
        console.log(`Initial active tab: ${tabName}`);
        break;
      }
    }
  }

  /**
   * Extract the clean tab name without counters
   * @param {Element} tabElement - The tab element
   * @returns {string} The clean tab name
   */
  extractCleanTabName(tabElement) {
    if (!tabElement) return 'unknown';

    try {
      // Start with a null tabName
      let tabName = null;

      // Method 1: Look for a specific element that contains just the tab name
      const nameElement = tabElement.querySelector('.tab-name, .tab-title, .tab-label');
      if (nameElement) {
        tabName = nameElement.textContent.trim();
      }

      // Method 2: Try to get just the first text node (before any child elements)
      if (!tabName) {
        for (let i = 0; i < tabElement.childNodes.length; i++) {
          const node = tabElement.childNodes[i];
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            tabName = node.textContent.trim();
            break;
          }
        }
      }

      // Method 3: Use regex to remove patterns like " (23)" from the full text
      if (!tabName) {
        tabName = tabElement.textContent.trim();
      }

      // Apply sanitization regardless of which method succeeded
      return this.sanitizeTabName(tabName);
    } catch (error) {
      console.error('Error extracting tab name:', error);
      // Return a sanitized version of the full textContent as last resort
      return this.sanitizeTabName(tabElement.textContent || 'unknown');
    }
  }

  /**
   * Sanitize a tab name to ensure it's clean for analytics
   * @param {string} tabName - The tab name to sanitize
   * @returns {string} Sanitized tab name
   */
  sanitizeTabName(tabName) {
    if (typeof tabName !== 'string') {
      return 'unknown';
    }

    // First, remove any surrounding whitespace
    let sanitized = tabName.trim();

    // Remove common counter patterns that might be in the text
    // Remove " (26)" or "(26)" at the end
    sanitized = sanitized.replace(/\s*\(\d+\)$/g, '');
    // Remove " [26]" or "[26]" at the end
    sanitized = sanitized.replace(/\s*\[\d+\]$/g, '');
    // Remove any number in parentheses anywhere
    sanitized = sanitized.replace(/\s*\(\d+\)/g, '');

    // Replace line breaks, tabs, and control characters with spaces
    sanitized = sanitized.replace(/[\r\n\t\f\v]+/g, ' ');

    // Normalize multiple spaces to a single space
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Final trim to remove any leading/trailing whitespace
    sanitized = sanitized.trim();

    return sanitized || 'unknown';
  }

  /**
   * Handle tab clicks with direct handlers
   * @param {Event} e - The click event
   */
  handleTabClick(e) {
    // Check if any tab element was clicked
    for (const selector of this.tabSelectors) {
      const tabElement = e.target.closest(selector);
      if (tabElement) {
        const cleanTabName = this.extractCleanTabName(tabElement);
        console.log('Tab click captured directly:', cleanTabName);

        // Prevent default navigation
        e.preventDefault();

        // Set flag to prevent URL updates
        this.isFromTabNavigation = true;

        // Store the active tab ID
        this.activeTabId = tabElement.id || tabElement.getAttribute('data-tab-group-control');

        // Update visual state of tabs
        this.updateTabState(tabElement);

        // Track tab selection
        this.trackTabChange(tabElement, cleanTabName);

        // Load tab content
        const href = tabElement.getAttribute('href');
        if (href) {
          this.loadTabContent(href, tabElement);
        }

        return;
      }
    }
  }

  /**
   * Flag tab clicks for window-level function interception
   * @param {Event} e - The click event
   */
  flagTabClick(e) {
    // Check if any tab element was clicked
    for (const selector of this.tabSelectors) {
      const element = e.target.closest(selector);
      if (element) {
        // Mark that this is a tab navigation
        this.isFromTabNavigation = true;

        // Store the active tab ID
        this.activeTabId = element.id || element.getAttribute('data-tab-group-control');

        // Extract clean tab name
        const cleanTabName = this.extractCleanTabName(element);

        // Track tab selection
        this.trackTabChange(element, cleanTabName);

        console.log('Tab click flagged:', cleanTabName);
        break;
      }
    }
  }

  /**
   * Track tab change for analytics
   * @param {Element} tabElement - The tab element that was clicked
   * @param {string} cleanTabName - The already-sanitized tab name
   */
  trackTabChange(tabElement, cleanTabName) {
    try {
      // Use the provided cleanTabName or extract it if not provided
      const tabName = cleanTabName || this.extractCleanTabName(tabElement);

      // Get the tab ID (this is less critical but still useful for tracking)
      const tabId = tabElement.id ||
        tabElement.getAttribute('data-tab-id') ||
        tabElement.getAttribute('aria-controls') ||
        this.activeTabId ||
        'unknown';

      // Extract query from URL or input field
      const urlParams = new URLSearchParams(window.location.search);
      const query = urlParams.get('query') || this.core.originalQuery || '';

      // Create clean and properly structured data object for supplement endpoint
      const analyticsData = {
        type: 'tab', // This is used by core-search-manager for routing
        query: query, // Use "query" rather than "originalQuery" for supplement endpoint
        enrichmentData: {
          actionType: 'tab',
          tabName: tabName,
          tabId: tabId,
          timestamp: Date.now()
        }
      };

      // Log what we're sending
      console.log('Tab change tracked:', {
        tabName: analyticsData.enrichmentData.tabName,
        query: analyticsData.query
      });

      // Let core manager handle analytics submission and session ID
      this.core.sendAnalyticsData(analyticsData);
    } catch (error) {
      console.error('Error tracking tab change:', error);
    }
  }

  /**
   * Update the visual state of tabs
   * @param {Element} activeTab - The newly active tab
   */
  updateTabState(activeTab) {
    if (!activeTab) return;

    // Find all tabs in the same container
    const tabContainer = activeTab.closest('.tab-list__nav, .tab-container, [role="tablist"], .tabs');
    if (!tabContainer) return;

    // Get all tabs in this container
    const allTabs = tabContainer.querySelectorAll(this.tabSelectors.join(', '));

    // Update ARIA and class attributes
    allTabs.forEach(tab => {
      const isActive = tab === activeTab;

      // Update ARIA attributes
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');

      // Update classes
      if (isActive) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  /**
   * Load tab content from the specified URL
   * @param {string} href - The tab content URL
   * @param {Element} tabElement - The tab element that was clicked
   */
  async loadTabContent(href, tabElement) {
    // Get the results container - ensure it exists before proceeding
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) {
      console.error('Results container not found');
      return;
    }

    console.log('Loading tab content from:', href);

    // Show loading state
    resultsContainer.classList.add('loading');

    try {
      // Use the core's fetch method (which handles session ID properly)
      const response = await this.core.fetchFromProxy(href, 'search');

      // Ensure container is still available before updating
      const container = document.getElementById('results');
      if (!container) {
        console.error('Results container disappeared during tab content loading');
        return;
      }

      // Update results container
      container.innerHTML = `
        <div class="funnelback-search-container">
          ${response || "No results found."}
        </div>
      `;

      console.log('Tab content loaded successfully');
    } catch (error) {
      console.error('Error loading tab content:', error);

      // Ensure container still exists before showing error
      const container = document.getElementById('results');
      if (container) {
        // Show error in container
        container.innerHTML = `
          <div class="search-error">
            <h3>Error Loading Tab Content</h3>
            <p>${error.message}</p>
          </div>
        `;
      }
    } finally {
      // Ensure container still exists before removing loading state
      const container = document.getElementById('results');
      if (container) {
        // Remove loading state
        container.classList.remove('loading');
      }
    }
  }

  /**
   * Enhanced performSearch function that handles tab content specially
   * @param {string} query - The search query or tab URL
   * @param {HTMLElement|string} containerId - Results container or its ID
   * @param {string|null} sessionId - Session ID for tracking (now optional)
   */
  async enhancedPerformSearch(query, containerId, sessionId) {
    // Determine if this is a tab navigation by examining URL patterns
    const isTabNavigation = this.isFromTabNavigation ||
      (typeof query === 'string' &&
        query.includes('form=partial') &&
        (query.includes('tab=') ||
          query.includes('Tab=') ||
          query.includes('profile=')));

    // Get container reference
    const container = typeof containerId === 'string' ?
      document.getElementById(containerId) : containerId;

    if (!container) {
      console.error('Container not found for search/tab navigation');
      return;
    }

    // Session ID is now handled by the core, no need to generate here
    // Just pass along whatever was provided or let core handle it

    if (isTabNavigation) {
      console.log('Tab navigation detected, using specialized handler');

      // Set the flag to prevent URL updates
      this.isFromTabNavigation = true;

      try {
        // Show loading state
        container.classList.add('loading');

        // Use our core's fetch method to get the content (it handles session ID properly)
        console.log('Fetching tab content via core manager');
        const response = await this.core.fetchFromProxy(query, 'search');

        // Check if container still exists before updating
        if (container.isConnected) {
          // Update results container
          container.innerHTML = `
            <div class="funnelback-search-container">
              ${response || "No results found."}
            </div>
          `;

          console.log('Tab content fetched and displayed');
        } else {
          console.error('Container removed from DOM during tab content fetch');
        }

        // Reset the tab navigation flag after a short delay
        // to allow time for other handlers to see it
        setTimeout(() => {
          this.isFromTabNavigation = false;
        }, 100);

        return; // Skip the original function
      } catch (error) {
        console.error('Error fetching tab content:', error);

        // Check if container still exists before showing error
        if (container.isConnected) {
          // Show error in container
          container.innerHTML = `
            <div class="search-error">
              <h3>Error Loading Tab Content</h3>
              <p>${error.message}</p>
            </div>
          `;
        }
      } finally {
        // Check if container still exists before removing loading state
        if (container.isConnected) {
          // Remove loading state
          container.classList.remove('loading');
        }
      }
    } else {
      // For regular searches, use the original function, passing along whatever session ID was provided
      console.log('Regular search detected, using original handler');
      return this.originalPerformSearch(query, containerId, sessionId);
    }
  }

  /**
   * Enhanced URL update function that prevents updates during tab navigation
   * @param {string} query - The query to add to the URL
   */
  enhancedUpdateUrl(query) {
    // Skip URL updates for tab navigation
    if (this.isFromTabNavigation) {
      console.log('Blocking URL update for tab navigation');
      return;
    }

    // For normal searches, use the original function
    return this.originalUpdateUrl(query);
  }

  /**
   * Handle DOM changes (required interface method)
   * @param {NodeList} addedNodes - The nodes added to the DOM
   */
  handleDomChanges(addedNodes) {
    if (!addedNodes || addedNodes.length === 0) return;

    // Check for new tab containers
    const newTabContainers = [];

    addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Check if this node is a tab container
        const containerSelectors = [
          '.tab-list__nav',
          '.tab-container',
          '[role="tablist"]',
          '.tabs'
        ];

        for (const selector of containerSelectors) {
          if (node.matches(selector)) {
            newTabContainers.push(node);
          }

          // Check children
          const childContainers = node.querySelectorAll(selector);
          childContainers.forEach(container => {
            newTabContainers.push(container);
          });
        }
      }
    });

    // Add event listeners to new containers
    if (newTabContainers.length > 0) {
      newTabContainers.forEach(container => {
        // Make sure we haven't already added a listener
        if (!this.tabContainers.includes(container)) {
          this.tabContainers.push(container);
          container.addEventListener('click', this.handleTabClick.bind(this));
        }
      });

      console.log(`Added event listeners to ${newTabContainers.length} new tab container(s)`);
    }
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

    // Remove event listeners
    this.tabContainers.forEach(container => {
      container.removeEventListener('click', this.handleTabClick.bind(this));
    });

    document.removeEventListener('click', this.flagTabClick.bind(this));

    console.log('TabsManager destroyed');
  }
}

export default TabsManager;