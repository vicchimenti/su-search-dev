/**
 * @fileoverview Collapse Manager for Search UI
 *
 * This module handles all collapsible elements in the search interface.
 * It manages initialization, state management, and animations for collapsible
 * components like facets, filters, and tab groups.
 *
 * Features:
 * - Manages collapsible facet groups
 * - Handles tab group visibility toggles
 * - Controls show more/less functionality
 * - Supports animated transitions
 * - Maintains ARIA attributes for accessibility
 * - Handles dynamic content updates
 * - Tracks collapse interactions for analytics
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 1.2.0
 * @lastModified 2025-05-10
 */

class CollapseManager {
  /**
   * Initialize the Collapse Manager.
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    this.resultsContainer = document.getElementById("results");

    // Transition timing
    this.transitionLength = 450; // milliseconds

    // Track interactions - avoid duplicate events
    this.lastTrackedEvent = null;
    this.lastTrackedTime = 0;
    this.trackingDebounceTime = 300; // milliseconds

    // Initialize collapse functionality
    this.initialize();
  }

  /**
   * Initialize collapse functionality.
   */
  initialize() {
    if (!this.resultsContainer) {
      return;
    }

    // Initialize existing elements
    this.initializeExistingElements();

    // The core manager's observer will call handleDomChanges when new content is added
  }

  /**
   * Initialize any existing elements in the results container
   * that should have collapse functionality.
   */
  initializeExistingElements() {
    if (!this.resultsContainer) return;

    // Initialize facet group controls
    const facetButtons = this.resultsContainer.querySelectorAll(
      '[data-component="facet-group-control"]:not([data-collapse-initialized])'
    );
    facetButtons.forEach(button => {
      this.initializeCollapse(button);
    });

    // Initialize collapse-all buttons
    const collapseAllButtons = this.resultsContainer.querySelectorAll(
      '[data-component="collapse-all"]:not([data-collapse-initialized])'
    );
    collapseAllButtons.forEach(button => {
      this.initializeCollapse(button);
    });

    // Initialize show more buttons
    const showMoreButtons = this.resultsContainer.querySelectorAll(
      '[data-component="facet-group-show-more-button"]:not([data-collapse-initialized])'
    );
    showMoreButtons.forEach(button => {
      this.initializeShowMore(button);
    });

    // Initialize tab groups
    this.addToggleButtonsToTabGroups();
  }

  /**
   * Initializes a collapse button with all necessary properties and event listeners.
   * 
   * @param {HTMLElement} button - The button to initialize
   */
  initializeCollapse(button) {
    if (!button || button.hasAttribute('data-collapse-initialized')) {
      return;
    }

    button.setAttribute('data-collapse-initialized', 'true');

    // Find associated content
    let content;
    if (button.getAttribute('data-component') === 'collapse-all') {
      content = button.closest('.facet').querySelector('[data-component="facet-group-content"]');
    } else {
      content = button.nextElementSibling;
    }

    if (!content) {
      console.warn('No content found for button:', button);
      return;
    }

    // Ensure the content has an ID for aria-controls
    if (!content.id) {
      content.id = `collapse-content-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    // Set up button as a controller for the content
    button.setAttribute('aria-controls', content.id);

    // Set initial state based on default setting
    const openByDefault = button.classList.contains('facet-group__title--open');

    if (openByDefault) {
      this.openElement(button, content);
    } else {
      this.closeElement(button, content);
    }

    // Add click event listener
    button.addEventListener('click', (e) => {
      // Prevent default if it's a link
      if (button.tagName === 'A') {
        e.preventDefault();
      }

      // Get current state (expanded or collapsed)
      const isExpanded = button.getAttribute('aria-expanded') === 'true';

      // Toggle state with animation
      if (isExpanded) {
        this.transitionItemClosed(button, content);

        // Track collapse event
        this.trackCollapseEvent(button, 'collapse');
      } else {
        this.transitionItemOpen(button, content);

        // Track expand event
        this.trackCollapseEvent(button, 'expand');
      }
    });
  }

  /**
   * Initializes a show more button for facet groups.
   * 
   * @param {HTMLElement} button - The show more button to initialize
   */
  initializeShowMore(button) {
    if (!button || button.hasAttribute('data-collapse-initialized')) {
      return;
    }

    button.setAttribute('data-collapse-initialized', 'true');

    const facetGroup = button.closest('.facet-group__list');
    if (!facetGroup) {
      console.warn('No parent facet group found for show more button');
      return;
    }

    button.addEventListener('click', (e) => {
      e.preventDefault();

      const hiddenItems = facetGroup.querySelectorAll('.facet-group__list-item--hidden');
      hiddenItems.forEach(item => {
        item.classList.remove('facet-group__list-item--hidden');
      });

      button.style.display = 'none';

      // Track show more event
      this.trackShowMoreEvent(button);
    });
  }

  /**
   * Adds toggle buttons to all tab groups in the document.
   */
  addToggleButtonsToTabGroups() {
    const tabGroups = this.resultsContainer.querySelectorAll('.tabs--center:not([data-toggle-initialized])');
    tabGroups.forEach(tabGroup => {
      this.addToggleButtonToTabGroup(tabGroup);
    });
  }

  /**
   * Adds a toggle button to a specific tab group.
   * 
   * @param {HTMLElement} tabGroup - The tab group element to add the toggle to
   */
  addToggleButtonToTabGroup(tabGroup) {
    if (!tabGroup || tabGroup.hasAttribute('data-toggle-initialized')) {
      return;
    }

    // Create toggle button with proper HTML structure
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'tab-group__toggle';
    toggleButton.setAttribute('aria-expanded', 'true');

    toggleButton.innerHTML = `
      <svg class="tab-group__icon tab-group__icon--closed">
        <use href="#add"></use>
      </svg>
      <svg class="tab-group__icon tab-group__icon--open">
        <use href="#subtract"></use>
      </svg>
      <span class="tab-group__text tab-group__text--show">Show Filters</span>
      <span class="tab-group__text tab-group__text--hide">Hide Filters</span>
      <span class="sr-only">Toggle filters visibility</span>
    `;

    // Find and verify tab list nav
    const tabListNav = tabGroup.querySelector('[data-tab-group-element="tab-list-nav"]');
    if (!tabListNav) {
      console.warn('No tab list nav found in tab group');
      return;
    }

    // Insert and setup toggle button
    tabListNav.parentNode.insertBefore(toggleButton, tabListNav);
    toggleButton.addEventListener('click', () => {
      const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';

      toggleButton.setAttribute('aria-expanded', (!isExpanded).toString());
      toggleButton.classList.toggle('tab-group__toggle--collapsed');

      if (isExpanded) {
        tabListNav.style.display = 'none';
        tabListNav.setAttribute('aria-hidden', 'true');

        // Track collapse event
        this.trackTabGroupEvent(toggleButton, 'collapse');
      } else {
        tabListNav.style.display = '';
        tabListNav.setAttribute('aria-hidden', 'false');

        // Track expand event
        this.trackTabGroupEvent(toggleButton, 'expand');
      }
    });

    tabGroup.setAttribute('data-toggle-initialized', 'true');
  }

  /**
   * Track a facet collapse/expand event for analytics
   * 
   * @param {HTMLElement} button - The button that was clicked
   * @param {string} action - The action: 'expand' or 'collapse'
   */
  trackCollapseEvent(button, action) {
    try {
      // Get facet name
      let facetName = 'unknown';

      if (button.textContent) {
        facetName = this.sanitizeText(button.textContent);
      }

      // Create event ID to detect duplicates
      const now = Date.now();
      const eventId = `${facetName}-${action}-${now}`;

      // Debounce to prevent duplicate events
      if (this.lastTrackedEvent === eventId &&
        now - this.lastTrackedTime < this.trackingDebounceTime) {
        return;
      }

      // Update tracking state
      this.lastTrackedEvent = eventId;
      this.lastTrackedTime = now;

      // Extract query from URL or input field
      const urlParams = new URLSearchParams(window.location.search);
      const query = urlParams.get("query") || this.core.originalQuery || "";

      // Create properly formatted data for supplement endpoint using standard type
      const analyticsData = {
        type: "tab", // Changed to a standard type recognized by core manager
        query: query, // Use "query" for supplement endpoint
        enrichmentData: {
          actionType: "ui-interaction", // More generic action type
          elementType: "facet-group",
          action: action,
          elementName: facetName,
          timestamp: now
        }
      };

      // Send through core manager
      this.core.sendAnalyticsData(analyticsData);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Track a show more button click for analytics
   * 
   * @param {HTMLElement} button - The button that was clicked
   */
  trackShowMoreEvent(button) {
    try {
      // Try to determine facet group name
      let facetName = 'unknown';
      const facetGroup = button.closest('.facet-group');

      if (facetGroup) {
        const heading = facetGroup.querySelector('.facet-group__title');
        if (heading && heading.textContent) {
          facetName = this.sanitizeText(heading.textContent);
        }
      }

      // Create event ID to detect duplicates
      const now = Date.now();
      const eventId = `${facetName}-show-more-${now}`;

      // Debounce to prevent duplicate events
      if (this.lastTrackedEvent === eventId &&
        now - this.lastTrackedTime < this.trackingDebounceTime) {
        return;
      }

      // Update tracking state
      this.lastTrackedEvent = eventId;
      this.lastTrackedTime = now;

      // Extract query from URL or input field
      const urlParams = new URLSearchParams(window.location.search);
      const query = urlParams.get("query") || this.core.originalQuery || "";

      // Create properly formatted data for supplement endpoint using standard type
      const analyticsData = {
        type: "tab", // Changed to a standard type recognized by core manager
        query: query, // Use "query" for supplement endpoint
        enrichmentData: {
          actionType: "ui-interaction", // More generic action type
          elementType: "show-more",
          action: "click",
          elementName: facetName,
          timestamp: now
        }
      };

      // Send through core manager
      this.core.sendAnalyticsData(analyticsData);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Track a tab group toggle event for analytics
   * 
   * @param {HTMLElement} button - The button that was clicked
   * @param {string} action - The action: 'expand' or 'collapse'
   */
  trackTabGroupEvent(button, action) {
    try {
      // Create event ID to detect duplicates
      const now = Date.now();
      const eventId = `tab-group-${action}-${now}`;

      // Debounce to prevent duplicate events
      if (this.lastTrackedEvent === eventId &&
        now - this.lastTrackedTime < this.trackingDebounceTime) {
        return;
      }

      // Update tracking state
      this.lastTrackedEvent = eventId;
      this.lastTrackedTime = now;

      // Extract query from URL or input field
      const urlParams = new URLSearchParams(window.location.search);
      const query = urlParams.get("query") || this.core.originalQuery || "";

      // Create properly formatted data for supplement endpoint using standard type
      const analyticsData = {
        type: "tab", // Changed to a standard type recognized by core manager
        query: query, // Use "query" for supplement endpoint
        enrichmentData: {
          actionType: "ui-interaction", // More generic action type
          elementType: "tab-group-filters",
          action: action,
          timestamp: now
        }
      };

      // Send through core manager
      this.core.sendAnalyticsData(analyticsData);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Sanitize text for analytics purposes
   * 
   * @param {string} text - The text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    if (typeof text !== "string") {
      return "unknown";
    }

    // First, remove any surrounding whitespace
    let sanitized = text.trim();

    // Remove common counter patterns that might be in the text
    // Remove " (26)" or "(26)" at the end
    sanitized = sanitized.replace(/\s*\(\d+\)$/g, "");
    // Remove " [26]" or "[26]" at the end
    sanitized = sanitized.replace(/\s*\[\d+\]$/g, "");
    // Remove any number in parentheses anywhere
    sanitized = sanitized.replace(/\s*\(\d+\)/g, "");

    // Replace line breaks, tabs, and control characters with spaces
    sanitized = sanitized.replace(/[\r\n\t\f\v]+/g, " ");

    // Remove any HTML tags that might be present
    sanitized = sanitized.replace(/<[^>]*>/g, "");

    // Normalize multiple spaces to a single space
    sanitized = sanitized.replace(/\s+/g, " ");

    // Final trim to remove any leading/trailing whitespace
    sanitized = sanitized.trim();

    return sanitized || "unknown";
  }

  /**
   * Opens a collapse element, updating classes and ARIA attributes.
   * 
   * @param {HTMLElement} button - The control button
   * @param {HTMLElement} content - The content element to open
   */
  openElement(button, content) {
    button.setAttribute('aria-expanded', 'true');
    content.setAttribute('aria-hidden', 'false');
    button.classList.add('facet-group__title--open');
    content.classList.add('facet-group__list--open');
    content.style.display = 'inherit';

    // If there's a wrapper, update its classes too
    const wrapper = button.closest('.facet-group');
    if (wrapper) {
      wrapper.classList.add('facet-group__list--open');
    }
  }

  /**
   * Closes a collapse element, updating classes and ARIA attributes.
   * 
   * @param {HTMLElement} button - The control button
   * @param {HTMLElement} content - The content element to close
   */
  closeElement(button, content) {
    button.setAttribute('aria-expanded', 'false');
    content.setAttribute('aria-hidden', 'true');
    button.classList.remove('facet-group__title--open');
    content.classList.remove('facet-group__list--open');
    content.style.display = 'none';

    // If there's a wrapper, update its classes too
    const wrapper = button.closest('.facet-group');
    if (wrapper) {
      wrapper.classList.remove('facet-group__list--open');
    }
  }

  /**
   * Transitions an item to its open state with animation.
   * 
   * @param {HTMLElement} button - The control button
   * @param {HTMLElement} content - The content element to open with animation
   */
  transitionItemOpen(button, content) {
    let called = false;

    // Set initial state
    content.style.display = 'inherit';

    // Open immediately for ARIA purposes
    this.openElement(button, content);

    // Add expanding class and set height for animation
    content.classList.add('facet-group__list--expanding');
    content.style.height = `${content.scrollHeight}px`;

    // Handle transition end
    content.addEventListener(
      'transitionend',
      () => {
        called = true;
        content.classList.remove('facet-group__list--expanding');
        content.style.height = '';
      },
      { once: true }
    );

    // Fallback if transition doesn't complete
    setTimeout(() => {
      if (!called) {
        content.dispatchEvent(new window.Event('transitionend'));
      }
    }, this.transitionLength);
  }

  /**
   * Transitions an item to its closed state with animation.
   * 
   * @param {HTMLElement} button - The control button
   * @param {HTMLElement} content - The content element to close with animation
   */
  transitionItemClosed(button, content) {
    let called = false;

    // Set height for animation
    content.style.height = `${content.scrollHeight}px`;

    // Close immediately for ARIA purposes
    this.closeElement(button, content);

    // Need to set display back for animation
    content.style.display = '';

    // Small delay before starting animation to ensure height is applied
    setTimeout(() => {
      content.classList.add('facet-group__list--collapsing');
      content.style.height = '0px';
    }, 10);

    // Handle transition end
    content.addEventListener(
      'transitionend',
      () => {
        called = true;
        content.classList.remove('facet-group__list--collapsing');
        content.style.height = '';
        content.style.display = 'none';
      },
      { once: true }
    );

    // Fallback if transition doesn't complete
    setTimeout(() => {
      if (!called) {
        content.dispatchEvent(new window.Event('transitionend'));
      }
    }, this.transitionLength + 50);
  }

  /**
   * Handles DOM changes by finding and initializing new collapse elements.
   * This method is called by the core search manager when new content is added.
   * 
   * @param {NodeList} addedNodes - Nodes added to the DOM
   */
  handleDomChanges(addedNodes) {
    if (!addedNodes || addedNodes.length === 0) return;

    addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Handle tab groups
        const tabGroups = node.querySelectorAll('.tabs--center:not([data-toggle-initialized])');
        tabGroups.forEach(tabGroup => {
          this.addToggleButtonToTabGroup(tabGroup);
        });

        // Handle facet buttons
        const facetButtons = node.querySelectorAll('[data-component="facet-group-control"]:not([data-collapse-initialized])');
        facetButtons.forEach(button => {
          this.initializeCollapse(button);
        });

        // Handle collapse-all buttons
        const collapseAllButtons = node.querySelectorAll('[data-component="collapse-all"]:not([data-collapse-initialized])');
        collapseAllButtons.forEach(button => {
          this.initializeCollapse(button);
        });

        // Handle show more buttons
        const showMoreButtons = node.querySelectorAll('[data-component="facet-group-show-more-button"]:not([data-collapse-initialized])');
        showMoreButtons.forEach(button => {
          this.initializeShowMore(button);
        });
      }
    });
  }

  /**
   * Clean up resources and event listeners when this module is destroyed.
   */
  destroy() {
    // Clean up could be implemented here if needed
    // Since we're not adding global event listeners or observers directly,
    // most cleanup will happen automatically when elements are removed from the DOM
  }
}

export default CollapseManager;