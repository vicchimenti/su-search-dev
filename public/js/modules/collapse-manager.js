/**
 * @fileoverview Collapse Manager for Search UI
 *
 * This module provides centralized management of all collapsible elements in the search interface.
 * It handles facet group toggling, tab group visibility, and show more/less functionality.
 *
 * Features:
 * - Manages collapsible facet groups
 * - Handles tab group visibility toggles
 * - Controls show more/less functionality
 * - Provides analytics tracking for interactions
 * - Uses consistent animation patterns
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 2.0.0
 * @lastModified 2025-05-11
 */

class CollapseManager {
  /**
   * Initialize the Collapse Manager.
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    this.resultsContainer = document.getElementById("results");

    // Animation durations and timing
    this.animationDuration = 300; // milliseconds
    this.animationTiming = "ease";

    // Track known elements to avoid double initialization
    this.initializedElements = new Set();

    // Bind methods to maintain context
    this.handleClick = this.handleClick.bind(this);

    // Initialize the manager
    this.initialize();
  }

  /**
   * Initialize collapse functionality.
   */
  initialize() {
    if (!this.resultsContainer) {
      return;
    }

    // Set up event delegation for all collapsible elements
    this.resultsContainer.addEventListener("click", this.handleClick);

    // Initialize existing collapsible elements
    this.initializeExistingElements();
  }

  /**
   * Initialize any existing elements in the results container
   * that should have collapse functionality.
   */
  initializeExistingElements() {
    if (!this.resultsContainer) return;

    // Facet group controls
    const facetButtons = this.resultsContainer.querySelectorAll(
      '[data-component="facet-group-control"]:not([data-collapse-initialized])'
    );
    facetButtons.forEach((button) => {
      this.initializeFacetToggle(button);
    });

    // Show more buttons
    const showMoreButtons = this.resultsContainer.querySelectorAll(
      '[data-component="facet-group-show-more-button"]:not([data-collapse-initialized])'
    );
    showMoreButtons.forEach((button) => {
      this.initializeShowMoreButton(button);
    });

    // Tab groups
    const tabGroups = this.resultsContainer.querySelectorAll(
      ".tabs--center:not([data-collapse-initialized])"
    );
    tabGroups.forEach((tabGroup) => {
      this.initializeTabGroup(tabGroup);
    });
  }

  /**
   * Handle click events via delegation.
   * @param {Event} e - The click event
   */
  handleClick(e) {
    const target = e.target;

    // Handle facet toggle buttons
    if (target.closest('[data-component="facet-group-control"]')) {
      const button = target.closest('[data-component="facet-group-control"]');
      e.preventDefault();
      this.toggleFacetGroup(button);
    }

    // Handle show more/less buttons
    else if (
      target.closest('[data-component="facet-group-show-more-button"]')
    ) {
      const button = target.closest(
        '[data-component="facet-group-show-more-button"]'
      );
      e.preventDefault();
      this.toggleShowMore(button);
    }

    // Handle tab group toggle buttons
    else if (target.closest('[data-component="tab-group-toggle"]')) {
      const button = target.closest('[data-component="tab-group-toggle"]');
      e.preventDefault();
      this.toggleTabGroup(button);
    }
  }

  /**
   * Initialize a facet group toggle button.
   * @param {HTMLElement} button - The facet group toggle button
   */
  initializeFacetToggle(button) {
    if (!button || this.initializedElements.has(button)) return;

    // Mark as initialized
    button.setAttribute("data-collapse-initialized", "true");
    this.initializedElements.add(button);

    // Find content to toggle
    const content = button.nextElementSibling;
    if (!content) return;

    // Set initial state based on existing classes
    const isExpanded = button.classList.contains("facet-group__title--open");

    // Set ARIA attributes
    button.setAttribute("aria-expanded", isExpanded.toString());
    content.setAttribute("aria-hidden", (!isExpanded).toString());

    // Set initial visibility
    if (!isExpanded) {
      content.style.display = "none";
    }
  }

  /**
   * Initialize a show more/less button.
   * @param {HTMLElement} button - The show more/less button
   */
  initializeShowMoreButton(button) {
    if (!button || this.initializedElements.has(button)) return;

    // Mark as initialized
    button.setAttribute("data-collapse-initialized", "true");
    this.initializedElements.add(button);

    // Find parent facet group
    const facetGroup = button.closest(".facet-group__list");
    if (!facetGroup) return;

    // Set initial state
    button.setAttribute("data-state", "more");

    // Try to find hidden items to determine if button should be visible
    const hiddenItems = facetGroup.querySelectorAll(
      ".facet-group__list-item--hidden"
    );
    if (hiddenItems.length === 0) {
      // No hidden items, hide the button
      button.style.display = "none";
    }
  }

  /**
   * Initialize a tab group with toggle functionality.
   * @param {HTMLElement} tabGroup - The tab group element
   */
  initializeTabGroup(tabGroup) {
    if (!tabGroup || this.initializedElements.has(tabGroup)) return;

    // Mark as initialized
    tabGroup.setAttribute("data-collapse-initialized", "true");
    this.initializedElements.add(tabGroup);

    // Find or create the toggle button
    let toggleButton = tabGroup.querySelector(
      '[data-component="tab-group-toggle"]'
    );

    if (!toggleButton) {
      // Create the toggle button if it doesn't exist
      toggleButton = document.createElement("button");
      toggleButton.setAttribute("data-component", "tab-group-toggle");
      toggleButton.className = "tab-group__toggle";
      toggleButton.innerHTML = `
        <span class="tab-group__icon--open">▲</span>
        <span class="tab-group__icon--closed">▼</span>
        <span class="tab-group__text--hide">Hide tabs</span>
        <span class="tab-group__text--show">Show tabs</span>
      `;

      // Find the right place to insert the toggle
      const tabList =
        tabGroup.querySelector('[data-tab-group-element="tab-list-nav"]') ||
        tabGroup.querySelector(".tab-list__nav");

      if (tabList) {
        // Insert after the tab list
        tabList.parentNode.insertBefore(toggleButton, tabList.nextSibling);
      } else {
        // Insert at the beginning of the tab group
        tabGroup.insertBefore(toggleButton, tabGroup.firstChild);
      }
    }

    // Initial state (expanded by default)
    toggleButton.setAttribute("aria-expanded", "true");
  }

  /**
   * Toggle a facet group between expanded and collapsed states.
   * @param {HTMLElement} button - The toggle button
   */
  toggleFacetGroup(button) {
    if (!button) return;

    // Find content to toggle
    const content = button.nextElementSibling;
    if (!content) return;

    // Get current state
    const isExpanded = button.getAttribute("aria-expanded") === "true";

    // Toggle state
    button.setAttribute("aria-expanded", (!isExpanded).toString());
    content.setAttribute("aria-hidden", isExpanded.toString());

    // Toggle classes
    button.classList.toggle("facet-group__title--open");

    // Animate the transition
    if (isExpanded) {
      // Collapse
      this.animateCollapse(content);
    } else {
      // Expand
      this.animateExpand(content);
    }

    // Track the event for analytics
    this.trackFacetCollapseEvent(button, !isExpanded);
  }

  /**
   * Toggle show more/less functionality for a facet group.
   * @param {HTMLElement} button - The show more/less button
   */
  toggleShowMore(button) {
    if (!button) return;

    // Find parent facet group
    const facetGroup = button.closest(".facet-group__list");
    if (!facetGroup) return;

    // Get current state
    const isShowingMore = button.getAttribute("data-state") === "less";

    // Get hidden items
    const hiddenItems = facetGroup.querySelectorAll(
      ".facet-group__list-item--hidden"
    );

    if (isShowingMore) {
      // Switch to showing less
      hiddenItems.forEach((item) => {
        item.classList.add("facet-group__list-item--hidden");
      });
      button.setAttribute("data-state", "more");
      button.textContent = button.getAttribute("data-more-text") || "Show more";
    } else {
      // Switch to showing more
      hiddenItems.forEach((item) => {
        item.classList.remove("facet-group__list-item--hidden");
      });
      button.setAttribute("data-state", "less");
      button.textContent = button.getAttribute("data-less-text") || "Show less";
    }

    // Track the event for analytics
    this.trackShowMoreEvent(button, !isShowingMore);
  }

  /**
   * Toggle a tab group between expanded and collapsed states.
   * @param {HTMLElement} button - The toggle button
   */
  toggleTabGroup(button) {
    if (!button) return;

    // Find tab group container
    const tabGroup = button.closest(".tabs--center");
    if (!tabGroup) return;

    // Find the tab list
    const tabList =
      tabGroup.querySelector('[data-tab-group-element="tab-list-nav"]') ||
      tabGroup.querySelector(".tab-list__nav");
    if (!tabList) return;

    // Get current state
    const isExpanded = button.getAttribute("aria-expanded") === "true";

    // Toggle state
    button.setAttribute("aria-expanded", (!isExpanded).toString());
    button.classList.toggle("tab-group__toggle--collapsed");

    // Show/hide tab list
    if (isExpanded) {
      // Collapse
      tabList.style.display = "none";
    } else {
      // Expand
      tabList.style.display = "";
    }

    // Track the event for analytics
    this.trackTabToggleEvent(tabGroup, !isExpanded);
  }

  /**
   * Animate expanding a collapsible element.
   * @param {HTMLElement} element - The element to expand
   */
  animateExpand(element) {
    // First make sure the element is visible but not taking up space
    element.style.display = "";
    element.style.overflow = "hidden";
    element.style.height = "0px";
    element.style.paddingTop = "0";
    element.style.paddingBottom = "0";
    element.style.marginTop = "0";
    element.style.marginBottom = "0";

    // Add open class
    element.classList.add("facet-group__list--open");

    // Trigger reflow
    void element.offsetWidth;

    // Set up transition
    element.style.transition = `height ${this.animationDuration}ms ${this.animationTiming}, 
                               padding ${this.animationDuration}ms ${this.animationTiming}, 
                               margin ${this.animationDuration}ms ${this.animationTiming}`;

    // Get natural height by temporarily removing constraints
    const prevHeight = element.style.height;
    const prevOverflow = element.style.overflow;
    element.style.height = "auto";
    element.style.overflow = "hidden";
    const height = element.offsetHeight;
    element.style.height = prevHeight;
    element.style.overflow = prevOverflow;

    // Trigger animation
    requestAnimationFrame(() => {
      element.style.height = `${height}px`;
      element.style.paddingTop = "";
      element.style.paddingBottom = "";
      element.style.marginTop = "";
      element.style.marginBottom = "";
    });

    // Clean up after animation
    element.addEventListener("transitionend", function handler(e) {
      if (e.propertyName === "height") {
        element.style.height = "";
        element.style.overflow = "";
        element.style.transition = "";
        element.removeEventListener("transitionend", handler);
      }
    });
  }

  /**
   * Animate collapsing a collapsible element.
   * @param {HTMLElement} element - The element to collapse
   */
  animateCollapse(element) {
    // Set up initial state - get current height
    const height = element.offsetHeight;
    element.style.height = `${height}px`;
    element.style.overflow = "hidden";

    // Trigger reflow
    void element.offsetWidth;

    // Set up transition
    element.style.transition = `height ${this.animationDuration}ms ${this.animationTiming}, 
                               padding ${this.animationDuration}ms ${this.animationTiming}, 
                               margin ${this.animationDuration}ms ${this.animationTiming}`;

    // Remove open class
    element.classList.remove("facet-group__list--open");

    // Trigger animation
    requestAnimationFrame(() => {
      element.style.height = "0px";
      element.style.paddingTop = "0";
      element.style.paddingBottom = "0";
      element.style.marginTop = "0";
      element.style.marginBottom = "0";
    });

    // Hide element after animation
    element.addEventListener("transitionend", function handler(e) {
      if (e.propertyName === "height") {
        element.style.display = "none";
        element.style.height = "";
        element.style.overflow = "";
        element.style.transition = "";
        element.style.paddingTop = "";
        element.style.paddingBottom = "";
        element.style.marginTop = "";
        element.style.marginBottom = "";
        element.removeEventListener("transitionend", handler);
      }
    });
  }

  /**
   * Track facet collapse/expand events for analytics.
   * @param {HTMLElement} button - The toggle button
   * @param {boolean} isExpanded - Whether the facet is now expanded
   */
  trackFacetCollapseEvent(button, isExpanded) {
    try {
      // Get facet group title
      const facetName = button.textContent.trim();

      // Prepare analytics data
      const data = {
        type: "facet", // Use facet type for facet analytics
        query: this.core.originalQuery || "",
        enrichmentData: {
          actionType: "facet_collapse",
          facetName: facetName,
          state: isExpanded ? "expanded" : "collapsed",
          timestamp: Date.now(),
        },
      };

      // Send analytics through core manager
      this.core.sendAnalyticsData(data);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Track show more/less events for analytics.
   * @param {HTMLElement} button - The show more/less button
   * @param {boolean} isShowingMore - Whether more items are now shown
   */
  trackShowMoreEvent(button, isShowingMore) {
    try {
      // Find parent facet group to get facet name
      const facetGroup = button.closest(".facet-group");
      let facetName = "unknown";

      if (facetGroup) {
        const heading = facetGroup.querySelector(".facet-group__title");
        if (heading) {
          facetName = heading.textContent.trim();
        }
      }

      // Prepare analytics data
      const data = {
        type: "facet", // Use facet type for facet analytics
        query: this.core.originalQuery || "",
        enrichmentData: {
          actionType: "facet_show_more",
          facetName: facetName,
          state: isShowingMore ? "more" : "less",
          timestamp: Date.now(),
        },
      };

      // Send analytics through core manager
      this.core.sendAnalyticsData(data);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Track tab group toggle events for analytics.
   * @param {HTMLElement} tabGroup - The tab group
   * @param {boolean} isExpanded - Whether the tab group is now expanded
   */
  trackTabToggleEvent(tabGroup, isExpanded) {
    try {
      // Get tab group identifier
      let tabGroupName = "main_tabs";

      // Try to get a more specific name if possible
      if (tabGroup.id) {
        tabGroupName = tabGroup.id;
      } else if (tabGroup.dataset.tabGroup) {
        tabGroupName = tabGroup.dataset.tabGroup;
      }

      // Prepare analytics data
      const data = {
        type: "tab", // Use tab type for tab analytics
        query: this.core.originalQuery || "",
        enrichmentData: {
          actionType: "tab_group_toggle",
          tabName: tabGroupName,
          state: isExpanded ? "expanded" : "collapsed",
          timestamp: Date.now(),
        },
      };

      // Send analytics through core manager
      this.core.sendAnalyticsData(data);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Handles DOM changes by finding and initializing new collapsible elements.
   * @param {NodeList} addedNodes - Nodes added to the DOM
   */
  handleDomChanges(addedNodes) {
    if (!addedNodes || addedNodes.length === 0) return;

    // For each new node, check if it contains elements we need to initialize
    addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Process facet group toggles
        const facetToggles = node.querySelectorAll(
          '[data-component="facet-group-control"]:not([data-collapse-initialized])'
        );
        facetToggles.forEach((toggle) => {
          this.initializeFacetToggle(toggle);
        });

        // Check if this node itself is a facet toggle
        if (
          node.matches('[data-component="facet-group-control"]') &&
          !node.hasAttribute("data-collapse-initialized")
        ) {
          this.initializeFacetToggle(node);
        }

        // Process show more buttons
        const showMoreButtons = node.querySelectorAll(
          '[data-component="facet-group-show-more-button"]:not([data-collapse-initialized])'
        );
        showMoreButtons.forEach((button) => {
          this.initializeShowMoreButton(button);
        });

        // Check if this node itself is a show more button
        if (
          node.matches('[data-component="facet-group-show-more-button"]') &&
          !node.hasAttribute("data-collapse-initialized")
        ) {
          this.initializeShowMoreButton(node);
        }

        // Process tab groups
        const tabGroups = node.querySelectorAll(
          ".tabs--center:not([data-collapse-initialized])"
        );
        tabGroups.forEach((tabGroup) => {
          this.initializeTabGroup(tabGroup);
        });

        // Check if this node itself is a tab group
        if (
          node.matches(".tabs--center") &&
          !node.hasAttribute("data-collapse-initialized")
        ) {
          this.initializeTabGroup(node);
        }
      }
    });
  }

  /**
   * Clean up resources and event listeners when this module is destroyed.
   */
  destroy() {
    if (this.resultsContainer) {
      this.resultsContainer.removeEventListener("click", this.handleClick);
    }

    // Clear the set of initialized elements
    this.initializedElements.clear();
  }
}

export default CollapseManager;
