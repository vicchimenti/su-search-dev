/**
 * @fileoverview Analytics Manager for Search UI
 * 
 * This module handles tracking and analytics for search interactions.
 * It captures user events and sends them to the analytics endpoint.
 * 
 * Features:
 * - Tracks result clicks with position data
 * - Captures facet interactions
 * - Records pagination events
 * - Monitors tab changes and spelling suggestions
 * - Uses non-blocking sendBeacon for analytics data
 * 
 * @author Victor Chimenti
 * @version 1.2.0
 * @lastModified 2025-04-08
 */

class AnalyticsManager {
  /**
   * Initialize the Analytics Manager.
   * @param {Object} core - Reference to the core search manager
   */
  constructor(core) {
    this.core = core;
    this.resultsContainer = document.getElementById('results');

    // Bind methods to maintain context
    this.trackResultClick = this.trackResultClick.bind(this);
    this.trackFacetSelection = this.trackFacetSelection.bind(this);
    this.trackPaginationEvent = this.trackPaginationEvent.bind(this);
    this.trackTabChange = this.trackTabChange.bind(this);
    this.trackSpellingSuggestion = this.trackSpellingSuggestion.bind(this);

    this.initialize();
  }

  /**
   * Initialize analytics tracking.
   */
  initialize() {
    if (!this.resultsContainer) {
      console.warn('Analytics Manager: Results container not found');
      return;
    }

    // Set up event delegation for all clickable elements in results
    this.resultsContainer.addEventListener('click', (e) => {
      // Handle result links
      if (e.target.closest('.fb-result h3 a, .search-result-item h3 a, .listing-item__title a')) {
        this.trackResultClick(e);
      }

      // Handle facet clicks
      else if (e.target.closest('.facet-group__list a, a.facet-group__clear, .facet-breadcrumb__link')) {
        this.trackFacetSelection(e);
      }

      // Handle pagination clicks
      else if (e.target.closest('a.pagination__link')) {
        this.trackPaginationEvent(e);
      }

      // Handle tab clicks
      else if (e.target.closest('.tab-list__nav a')) {
        this.trackTabChange(e);
      }

      // Handle spelling suggestion clicks
      else if (e.target.closest('.search-spelling-suggestions__link, .query-blending__highlight')) {
        this.trackSpellingSuggestion(e);
      }
    });

    console.log('Analytics Manager: Initialized');
  }

  /**
   * Tracks result link clicks with position data.
   * @param {Event} e - The click event
   */
  trackResultClick(e) {
    // Don't prevent default navigation
    const link = e.target.closest('a');
    if (!link) return;

    try {
      // Prioritize data-live-url over href for accurate destination tracking
      const dataLiveUrl = link.getAttribute('data-live-url');
      const href = link.getAttribute('href');
      const clickedUrl = dataLiveUrl || href || '';
      const title = link.textContent.trim() || '';

      // Determine position
      let position = -1;
      const resultItem = link.closest('.fb-result, .search-result-item, .listing-item');
      if (resultItem) {
        const allResults = Array.from(document.querySelectorAll('.fb-result, .search-result-item, .listing-item'));
        position = allResults.indexOf(resultItem) + 1;
      }

      // Prepare data - ensure field names match backend expectations
      const data = {
        type: 'click',
        originalQuery: this.core.originalQuery || '',
        clickedUrl: clickedUrl,
        clickedTitle: title,
        clickPosition: position,
        timestamp: new Date().toISOString()
      };

      // Send analytics data
      this.core.sendAnalyticsData(data);

      console.log(`Analytics: Tracked result click "${title}" (position ${position})`);
    } catch (error) {
      console.error('Analytics: Error tracking result click', error);
    }
  }

  /**
   * Tracks facet selection events.
   * @param {Event} e - The click event
   */
  trackFacetSelection(e) {
    const link = e.target.closest('a');
    if (!link) return;

    try {
      const facetName = this.getFacetName(link);
      const facetValue = this.getFacetValue(link);

      // Prepare data for supplement endpoint
      const data = {
        type: 'facet',
        // Use query instead of originalQuery for supplement endpoint
        query: this.core.originalQuery || '',
        enrichmentData: {
          facetType: 'facet',
          facetName: facetName,
          facetValue: facetValue,
          action: link.classList.contains('facet-group__clear') ? 'clear' : 'select'
        },
        timestamp: new Date().toISOString()
      };

      // Send analytics data
      this.core.sendAnalyticsData(data);

      console.log(`Analytics: Tracked facet ${data.enrichmentData.action} "${facetName}:${facetValue}"`);
    } catch (error) {
      console.error('Analytics: Error tracking facet selection', error);
    }
  }

  /**
   * Tracks pagination events.
   * @param {Event} e - The click event
   */
  trackPaginationEvent(e) {
    const link = e.target.closest('a');
    if (!link) return;

    try {
      let pageNumber = -1;

      // Try to extract page number from link text or class
      if (link.textContent && !isNaN(parseInt(link.textContent.trim()))) {
        pageNumber = parseInt(link.textContent.trim());
      } else if (link.classList.contains('pagination__link--next')) {
        pageNumber = 'next';
      } else if (link.classList.contains('pagination__link--prev')) {
        pageNumber = 'prev';
      }

      // Prepare data for supplement endpoint
      const data = {
        type: 'pagination',
        // Use query instead of originalQuery for supplement endpoint
        query: this.core.originalQuery || '',
        enrichmentData: {
          actionType: 'pagination',
          pageNumber: pageNumber
        },
        timestamp: new Date().toISOString()
      };

      // Send analytics data
      this.core.sendAnalyticsData(data);

      console.log(`Analytics: Tracked pagination to page ${pageNumber}`);
    } catch (error) {
      console.error('Analytics: Error tracking pagination event', error);
    }
  }

  /**
   * Tracks tab change events.
   * @param {Event} e - The click event
   */
  trackTabChange(e) {
    const link = e.target.closest('a');
    if (!link) return;

    try {
      const tabName = link.textContent.trim() || 'unknown';

      // Try to get tab id from attributes
      const tabId = link.getAttribute('data-tab-id') ||
        link.getAttribute('id') ||
        link.getAttribute('aria-controls') ||
        'unknown';

      // Prepare data for supplement endpoint
      const data = {
        type: 'tab',
        // Use query instead of originalQuery for supplement endpoint
        query: this.core.originalQuery || '',
        enrichmentData: {
          actionType: 'tab',
          tabName: tabName,
          tabId: tabId
        },
        timestamp: new Date().toISOString()
      };

      // Send analytics data
      this.core.sendAnalyticsData(data);

      console.log(`Analytics: Tracked tab change to "${tabName}"`);
    } catch (error) {
      console.error('Analytics: Error tracking tab change', error);
    }
  }

  /**
   * Tracks spelling suggestion clicks.
   * @param {Event} e - The click event
   */
  trackSpellingSuggestion(e) {
    const link = e.target.closest('a');
    if (!link) return;

    try {
      const originalTerm = this.core.originalQuery || '';
      const suggestedTerm = link.textContent.trim() || '';

      // Prepare data for supplement endpoint
      const data = {
        type: 'spelling',
        // Use query instead of originalQuery for supplement endpoint
        query: originalTerm,
        enrichmentData: {
          actionType: 'spelling',
          suggestedQuery: suggestedTerm
        },
        timestamp: new Date().toISOString()
      };

      // Send analytics data
      this.core.sendAnalyticsData(data);

      console.log(`Analytics: Tracked spelling suggestion "${suggestedTerm}"`);
    } catch (error) {
      console.error('Analytics: Error tracking spelling suggestion', error);
    }
  }

  /**
   * Extracts facet name from a facet link element.
   * @param {HTMLElement} link - The facet link element
   * @returns {string} The facet name
   */
  getFacetName(link) {
    // Try to get facet name from various locations

    // From data attribute
    if (link.hasAttribute('data-facet-name')) {
      return link.getAttribute('data-facet-name');
    }

    // From parent facet group
    const facetGroup = link.closest('.facet-group');
    if (facetGroup) {
      const heading = facetGroup.querySelector('.facet-group__title');
      if (heading) {
        return heading.textContent.trim();
      }
    }

    // From breadcrumb structure
    const breadcrumb = link.closest('.facet-breadcrumb__item');
    if (breadcrumb) {
      const categoryEl = breadcrumb.querySelector('.facet-breadcrumb__category');
      if (categoryEl) {
        return categoryEl.textContent.trim();
      }
    }

    return 'unknown';
  }

  /**
   * Extracts facet value from a facet link element.
   * @param {HTMLElement} link - The facet link element
   * @returns {string} The facet value
   */
  getFacetValue(link) {
    // Try to get facet value from various locations

    // From data attribute
    if (link.hasAttribute('data-facet-value')) {
      return link.getAttribute('data-facet-value');
    }

    // From link text for regular facets
    const valueEl = link.querySelector('.facet-group__list-link-text');
    if (valueEl) {
      return valueEl.textContent.trim();
    }

    // From breadcrumb structure
    const breadcrumb = link.closest('.facet-breadcrumb__item');
    if (breadcrumb) {
      const valueEl = breadcrumb.querySelector('.facet-breadcrumb__value');
      if (valueEl) {
        return valueEl.textContent.trim();
      }
    }

    // For clear facet links
    if (link.classList.contains('facet-group__clear')) {
      return 'all';
    }

    return link.textContent.trim() || 'unknown';
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
      // Using event delegation, so we just need to remove one listener
      this.resultsContainer.removeEventListener('click', this.handleClick);
    }
  }
}

export default AnalyticsManager;