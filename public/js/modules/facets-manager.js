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
 * - Supports collapsible facet groups
 * - Integrates with search API via proxy
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 1.2.0
 * @lastModified 2025-04-28
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
    this.handleShowMoreClick = this.handleShowMoreClick.bind(this);
    this.handleFacetToggle = this.handleFacetToggle.bind(this);

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
    this.resultsContainer.addEventListener("click", (e) => {
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

      // Handle show more/less
      else if (
        e.target.closest('[data-component="facet-group-show-more-button"]')
      ) {
        e.preventDefault();
        this.handleShowMoreClick(e);
      }

      // Handle facet toggle
      else if (e.target.closest('[data-component="facet-group-control"]')) {
        this.handleFacetToggle(e);
      }
    });
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
   * Handles clicks on show more buttons in facets.
   * @param {Event} e - The click event
   */
  handleShowMoreClick(e) {
    e.preventDefault();

    const button = e.target.closest(
      '[data-component="facet-group-show-more-button"]'
    );
    if (!button) return;

    try {
      // Find parent facet group
      const facetGroup = button.closest(".facet-group__list");
      if (!facetGroup) return;

      // Get all hidden items
      const hiddenItems = facetGroup.querySelectorAll(
        ".facet-group__list-item--hidden"
      );

      // Remove hidden class from all items
      hiddenItems.forEach((item) => {
        item.classList.remove("facet-group__list-item--hidden");
      });

      // Hide the button
      button.style.display = "none";
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Handles facet group toggle for collapsible facets.
   * @param {Event} e - The click event
   */
  handleFacetToggle(e) {
    const toggleButton = e.target.closest(
      '[data-component="facet-group-control"]'
    );
    if (!toggleButton) return;

    try {
      // Find content to toggle
      const content = toggleButton.nextElementSibling;
      if (!content) return;

      // Toggle expanded state
      const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";
      toggleButton.setAttribute("aria-expanded", (!isExpanded).toString());

      // Toggle active class
      toggleButton.classList.toggle("facet-group__title--open");

      // Toggle content visibility
      if (isExpanded) {
        content.classList.remove("facet-group__list--open");
        content.setAttribute("aria-hidden", "true");
        content.style.display = "none";
      } else {
        content.classList.add("facet-group__list--open");
        content.setAttribute("aria-hidden", "false");
        content.style.display = "";
      }
    } catch (error) {
      // Silent error handling
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

    addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Initialize show more buttons if any
        const showMoreButtons = node.querySelectorAll(
          '[data-component="facet-group-show-more-button"]'
        );
        showMoreButtons.forEach((button) => {
          if (!button.hasAttribute("data-initialized")) {
            button.setAttribute("data-initialized", "true");
            // No need to add event listeners here as we're using event delegation
          }
        });

        // Initialize facet toggles if any
        const facetToggles = node.querySelectorAll(
          '[data-component="facet-group-control"]'
        );
        facetToggles.forEach((toggle) => {
          if (!toggle.hasAttribute("data-initialized")) {
            toggle.setAttribute("data-initialized", "true");
            // Set initial ARIA attributes if not present
            if (!toggle.hasAttribute("aria-expanded")) {
              const isOpen = toggle.classList.contains(
                "facet-group__title--open"
              );
              toggle.setAttribute("aria-expanded", isOpen.toString());

              // Also set content state
              const content = toggle.nextElementSibling;
              if (content) {
                content.setAttribute("aria-hidden", (!isOpen).toString());
                if (!isOpen) {
                  content.style.display = "none";
                }
              }
            }
          }
        });
      }
    });
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
