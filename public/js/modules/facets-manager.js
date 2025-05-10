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
 * @version 1.5.0
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

      // NOTE: We removed the direct analytics tracking to avoid conflicts
      // Let the analytics-manager handle tracking through its event listeners

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

      // NOTE: We removed the direct analytics tracking to avoid conflicts
      // Let the analytics-manager handle tracking through its event listeners

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