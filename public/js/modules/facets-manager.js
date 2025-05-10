/**
 * @fileoverview Facets Manager for Search UI
 *
 * This module handles faceted search interactions in the search interface.
 * It manages facet selection, clearing, and result updates.
 *
 * Features:
 * - Handles facet selection and clearing
 * - Maintains facet breadcrumbs
 * - Updates search results based on facet selections
 * - Integrates with search API via proxy
 *
 * Note: Collapsible functionality is now handled by the CollapseManager
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 1.4.0
 * @lastModified 2025-05-10
 */

class FacetsManager {
  /**
   * Initialize the Facets Manager.
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    this.resultsContainer = document.getElementById("results");

    // Bind methods to maintain context
    this.handleFacetClick = this.handleFacetClick.bind(this);
    this.handleClearFacetClick = this.handleClearFacetClick.bind(this);
    this.handleClick = this.handleClick.bind(this);

    this.initialize();
  }

  /**
   * Initialize facets functionality.
   */
  initialize() {
    if (!this.resultsContainer) {
      return;
    }

    // Set up event delegation for facets
    this.resultsContainer.addEventListener("click", this.handleClick);
  }

  /**
   * Main click handler that delegates to appropriate functions.
   * @param {Event} e - The click event
   */
  handleClick(e) {
    // Handle facet selection
    if (
      e.target.closest(
        ".facet-group__list a:not(.facet-group__clear):not(.facet-group__show-more)"
      )
    ) {
      e.preventDefault();
      this.handleFacetClick(e);
    }

    // Handle clear facet
    else if (
      e.target.closest("a.facet-group__clear, .facet-breadcrumb__link")
    ) {
      e.preventDefault();
      this.handleClearFacetClick(e);
    }

    // Note: Collapse and show more functionality is now handled by CollapseManager
    // We've removed these handlers to avoid conflicts
  }

  /**
   * Handles clicks on facet links.
   * @param {Event} e - The click event
   */
  async handleFacetClick(e) {
    e.preventDefault();

    const link = e.target.closest("a");
    if (!link) return;

    try {
      // Show loading state
      this.resultsContainer.classList.add("loading");

      // Get href for facet selection
      const href = link.getAttribute("href");
      if (!href) return;

      // Determine facet category and value for analytics
      const facetCategory = this.getFacetCategory(link);
      const facetValue =
        link
          .querySelector(".facet-group__list-link-text")
          ?.textContent.trim() || link.textContent.trim();

      // Track facet selection directly - ADDED
      this.trackFacetInteraction(facetCategory, facetValue, "select");

      // Fetch results using the search endpoint via core manager
      // This uses SessionService through the core manager
      const response = await this.core.fetchFromProxy(href, "search");

      // Update results container
      this.core.updateResults(response);
    } catch (error) {
      // Silent error handling
    } finally {
      // Remove loading state
      this.resultsContainer.classList.remove("loading");
    }
  }

  /**
   * Handles clicks on clear facet links.
   * @param {Event} e - The click event
   */
  async handleClearFacetClick(e) {
    e.preventDefault();

    const link = e.target.closest("a");
    if (!link) return;

    try {
      // Show loading state
      this.resultsContainer.classList.add("loading");

      // Get href for facet clearing
      const href = link.getAttribute("href");
      if (!href) return;

      // Determine facet category for analytics
      const facetCategory = this.getFacetCategory(link);

      // Track facet clearing directly - ADDED
      this.trackFacetInteraction(facetCategory, "all", "clear");

      // Fetch results using the search endpoint via core manager
      // This uses SessionService through the core manager
      const response = await this.core.fetchFromProxy(href, "search");

      // Update results container
      this.core.updateResults(response);
    } catch (error) {
      // Silent error handling
    } finally {
      // Remove loading state
      this.resultsContainer.classList.remove("loading");
    }
  }

  /**
   * Track facet interaction for analytics
   * 
   * @param {string} facetName - The name of the facet
   * @param {string} facetValue - The value of the facet
   * @param {string} action - The action (select or clear)
   */
  trackFacetInteraction(facetName, facetValue, action) {
    try {
      // Extract query from URL or core
      const urlParams = new URLSearchParams(window.location.search);
      const query = urlParams.get("query") || this.core.originalQuery || "";

      // Create properly formatted data for supplement endpoint
      const analyticsData = {
        type: "facet", // This is used by core-search-manager for routing
        query: query, // Use "query" for supplement endpoint
        enrichmentData: {
          actionType: "facet",
          facetName: this.sanitizeText(facetName),
          facetValue: this.sanitizeText(facetValue),
          action: action,
          timestamp: Date.now()
        }
      };

      // Send analytics data through core manager
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
   * Gets the facet category from a facet link element.
   * @param {HTMLElement} link - The facet link element
   * @returns {string} The facet category
   */
  getFacetCategory(link) {
    // Try to get category from parent facet group
    const facetGroup = link.closest(".facet-group");
    if (facetGroup) {
      const heading = facetGroup.querySelector(".facet-group__title");
      if (heading) {
        return heading.textContent.trim();
      }
    }

    return "unknown";
  }

  /**
   * Handles DOM changes by initializing new facet elements.
   * @param {NodeList} addedNodes - Nodes added to the DOM
   */
  handleDomChanges(addedNodes) {
    if (!addedNodes || addedNodes.length === 0) return;

    // Note: We no longer initialize toggle buttons or show more buttons here
    // CollapseManager now handles this functionality
  }

  /**
   * Clean up event listeners when this module is destroyed.
   */
  destroy() {
    if (this.resultsContainer) {
      this.resultsContainer.removeEventListener("click", this.handleClick);
    }
  }
}

export default FacetsManager;