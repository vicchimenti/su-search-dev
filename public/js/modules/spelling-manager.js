/**
 * @fileoverview Spelling Manager for Search UI
 *
 * This module handles spelling suggestion functionality for search.
 * It processes "Did you mean" suggestions and allows query blending.
 *
 * Features:
 * - Handles "Did you mean" spelling suggestions
 * - Supports query blending for enhanced results
 * - Integrates with search API via proxy
 * - Updates URL parameters when suggestions are applied
 * - Integrates with SessionService via core manager
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 1.2.0
 * @lastModified 2025-04-28
 */

class SpellingManager {
  /**
   * Initialize the Spelling Manager.
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    this.resultsContainer = document.getElementById("results");
    this.searchInput = document.getElementById(
      "autocomplete-concierge-inputField"
    );

    // Bind methods to maintain context
    this.handleSpellingSuggestionClick =
      this.handleSpellingSuggestionClick.bind(this);
    this.updateSearchInput = this.updateSearchInput.bind(this);
    this.updateUrlWithoutRefresh = this.updateUrlWithoutRefresh.bind(this);

    this.initialize();
  }

  /**
   * Initialize spelling functionality.
   */
  initialize() {
    if (!this.resultsContainer) {
      return;
    }

    // Set up event delegation for spelling suggestions
    this.resultsContainer.addEventListener("click", (e) => {
      // Handle spelling suggestions
      if (
        e.target.closest(
          ".search-spelling-suggestions__link, .query-blending__highlight"
        )
      ) {
        e.preventDefault();
        this.handleSpellingSuggestionClick(e);
      }
    });
  }

  /**
   * Handles clicks on spelling suggestions.
   * @param {Event} e - The click event
   */
  async handleSpellingSuggestionClick(e) {
    e.preventDefault();

    const link = e.target.closest("a");
    if (!link) return;

    try {
      // Get suggested query
      const suggestedQuery = link.textContent.trim();
      if (!suggestedQuery) return;

      // Update search input with suggested query
      this.updateSearchInput(suggestedQuery);

      // Get original link href and adjust for proxy
      const href = link.getAttribute("href");
      if (!href) return;

      // Fetch results using the spelling endpoint via core manager
      // This automatically handles session ID through the core manager
      const response = await this.core.fetchFromProxy(href, "spelling");

      // Update results container
      this.core.updateResults(response);

      // Update URL without refreshing the page
      this.updateUrlWithoutRefresh(suggestedQuery);

      // Update original query for analytics
      this.core.originalQuery = suggestedQuery;
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Updates the search input field with suggested query.
   * @param {string} query - The suggested query
   */
  updateSearchInput(query) {
    if (this.searchInput) {
      this.searchInput.value = query;
    }
  }

  /**
   * Updates the URL without refreshing the page.
   * @param {string} query - The query to update in URL
   */
  updateUrlWithoutRefresh(query) {
    if (!window.history || !window.history.pushState) return;

    const url = new URL(window.location);
    url.searchParams.set("query", query);
    window.history.pushState({}, "", url);
  }

  /**
   * Handles DOM changes by adding listeners to new content.
   * @param {NodeList} addedNodes - Nodes added to the DOM
   */
  handleDomChanges(addedNodes) {
    // No specific action needed as we're using event delegation
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

export default SpellingManager;
