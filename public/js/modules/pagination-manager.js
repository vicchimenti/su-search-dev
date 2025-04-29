/**
 * @fileoverview Pagination Manager for Search UI
 *
 * This module handles pagination functionality in the search interface.
 * It manages page navigation and result updates.
 *
 * Features:
 * - Handles page navigation clicks
 * - Updates search results for new pages
 * - Maintains URL state with current page
 * - Scrolls results into view on page change
 * - Supports next/previous and specific page navigation
 * - Integrates with SessionService via core manager
 *
 * @license MIT
 * @author Victor Chimenti
 * @version 1.2.0
 * @lastModified 2025-04-28
 */

class PaginationManager {
  /**
   * Initialize the Pagination Manager.
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    this.resultsContainer = document.getElementById("results");

    // Bind methods to maintain context
    this.handlePaginationClick = this.handlePaginationClick.bind(this);
    this.updateUrlWithoutRefresh = this.updateUrlWithoutRefresh.bind(this);
    this.scrollToResults = this.scrollToResults.bind(this);

    this.initialize();
  }

  /**
   * Initialize pagination functionality.
   */
  initialize() {
    if (!this.resultsContainer) {
      return;
    }

    // Set up event delegation for pagination links
    this.resultsContainer.addEventListener("click", (e) => {
      // Handle pagination links
      if (e.target.closest("a.pagination__link")) {
        e.preventDefault();
        this.handlePaginationClick(e);
      }
    });
  }

  /**
   * Handles clicks on pagination links.
   * @param {Event} e - The click event
   */
  async handlePaginationClick(e) {
    e.preventDefault();

    const link = e.target.closest("a.pagination__link");
    if (!link) return;

    try {
      // Show loading state
      this.resultsContainer.classList.add("loading");

      // Get href for pagination
      const href = link.getAttribute("href");
      if (!href) return;

      // Determine page number for analytics
      let pageLabel = "unknown";
      if (link.textContent && !isNaN(parseInt(link.textContent.trim()))) {
        pageLabel = link.textContent.trim();
      } else if (link.classList.contains("pagination__link--next")) {
        pageLabel = "next";
      } else if (link.classList.contains("pagination__link--prev")) {
        pageLabel = "previous";
      }

      // Fetch results using the search endpoint via core manager
      // This automatically handles session ID through the core manager
      const response = await this.core.fetchFromProxy(href, "search");

      // Update results container
      this.core.updateResults(response);

      // Update URL without refreshing the page
      this.updateUrlWithoutRefresh(href);

      // Scroll to results container
      this.scrollToResults();
    } catch (error) {
      // Silent error handling
    } finally {
      // Remove loading state
      this.resultsContainer.classList.remove("loading");
    }
  }

  /**
   * Updates the URL with new pagination parameters without refreshing page.
   * @param {string} href - The href from the pagination link
   */
  updateUrlWithoutRefresh(href) {
    if (!window.history || !window.history.pushState) return;

    try {
      // Extract query parameters from href
      const url = new URL(href, window.location.origin);
      const currentUrl = new URL(window.location);

      // Check for start rank parameter (common in Funnelback pagination)
      const startRank = url.searchParams.get("start_rank");
      if (startRank) {
        currentUrl.searchParams.set("start_rank", startRank);
      }

      // Check for page parameter
      const page = url.searchParams.get("page");
      if (page) {
        currentUrl.searchParams.set("page", page);
      }

      // Update browser history without reloading
      window.history.pushState({}, "", currentUrl);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Scrolls to the results container.
   */
  scrollToResults() {
    // Find an appropriate element to scroll to
    const scrollTarget =
      document.getElementById("on-page-search-input") ||
      document.querySelector(".search-result-summary") ||
      this.resultsContainer;

    if (scrollTarget) {
      // Scroll with smooth behavior if not at top of page
      if (window.scrollY > 0) {
        scrollTarget.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
  }

  /**
   * Handles DOM changes by adding listeners to new pagination components.
   * @param {NodeList} addedNodes - Nodes added to the DOM
   */
  handleDomChanges(addedNodes) {
    // No specific action needed as we're using event delegation
    // New pagination links will be handled by the event delegation
  }

  /**
   * Updates the active state of pagination links.
   * @param {string} currentPage - The current page number
   */
  updateActivePaginationState(currentPage) {
    if (!this.resultsContainer) return;

    // Find all pagination links
    const paginationLinks =
      this.resultsContainer.querySelectorAll("a.pagination__link");

    // Update active state
    paginationLinks.forEach((link) => {
      // Remove active class from all
      link.classList.remove("pagination__link--active");

      // Add active class to current page
      if (link.textContent.trim() === currentPage) {
        link.classList.add("pagination__link--active");
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  /**
   * Gets the current page number from URL or pagination component.
   * @returns {string} The current page number
   */
  getCurrentPage() {
    // Try to get from URL first
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get("page");
    if (pageParam) {
      return pageParam;
    }

    // Try to get from start_rank
    const startRank = urlParams.get("start_rank");
    if (startRank) {
      // Calculate page number based on start rank and results per page
      const resultsPerPage = this.core.config.defaultResultsPerPage || 10;
      const pageNumber = Math.floor(parseInt(startRank) / resultsPerPage) + 1;
      return pageNumber.toString();
    }

    // Check for active pagination link
    if (this.resultsContainer) {
      const activeLink = this.resultsContainer.querySelector(
        'a.pagination__link--active, a.pagination__link[aria-current="page"]'
      );
      if (activeLink) {
        return activeLink.textContent.trim();
      }
    }

    // Default to page 1
    return "1";
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

export default PaginationManager;
