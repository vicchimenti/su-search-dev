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
 * - Monitors spelling suggestions
 * - Uses non-blocking sendBeacon for analytics data
 * 
 * @author Victor Chimenti
 * @version 2.2.1
 * @lastModified 2025-04-12
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
      else if (e.target.closest('.facet-group__list a:not(.facet-group__clear):not(.facet-group__show-more), a.facet-group__clear, .facet-breadcrumb__link')) {
        this.trackFacetSelection(e);
      }

      // Handle pagination clicks
      else if (e.target.closest('a.pagination__link')) {
        this.trackPaginationEvent(e);
      }

      // Handle spelling suggestion clicks
      else if (e.target.closest('.search-spelling-suggestions__link, .query-blending__highlight')) {
        this.trackSpellingSuggestion(e);
      }

      // NOTE: Tab tracking is now handled by TabsManager exclusively
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
      
      // Clean up title text
      const titleElement = link.closest('h3') || link;
      const rawTitle = titleElement.textContent || '';
      const title = this.sanitizeText(rawTitle);

      // Determine position
      let position = -1;
      const resultItem = link.closest('.fb-result, .search-result-item, .listing-item');
      if (resultItem) {
        const allResults = Array.from(document.querySelectorAll('.fb-result, .search-result-item, .listing-item'));
        position = allResults.indexOf(resultItem) + 1;
      }

      // Prepare data using the expected format for click endpoint
      const data = {
        type: 'click',
        originalQuery: this.core.originalQuery || '',
        clickedUrl: clickedUrl,
        clickedTitle: title,
        clickPosition: position,
        clickType: 'search',
        timestamp: Date.now()
      };

      // Send analytics data through core manager (handles session ID)
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
      
      // Determine action type (select or clear)
      const action = link.classList.contains('facet-group__clear') || 
                     link.classList.contains('facet-breadcrumb__link') ? 
                     'clear' : 'select';

      // Prepare data for supplement endpoint - IMPORTANT: use "query" not "originalQuery"
      const data = {
        type: 'facet',
        query: this.core.originalQuery || '', 
        enrichmentData: {
          actionType: 'facet',
          facetName: this.sanitizeText(facetName),
          facetValue: this.sanitizeText(facetValue),
          action: action,
          timestamp: Date.now()
        }
      };

      // Send analytics data through core manager
      this.core.sendAnalyticsData(data);

      console.log(`Analytics: Tracked facet ${action} "${facetName}:${facetValue}"`);
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

      // Prepare data for supplement endpoint - IMPORTANT: use "query" not "originalQuery"
      const data = {
        type: 'pagination',
        query: this.core.originalQuery || '',
        enrichmentData: {
          actionType: 'pagination',
          pageNumber: pageNumber,
          timestamp: Date.now()
        }
      };

      // Send analytics data through core manager
      this.core.sendAnalyticsData(data);

      console.log(`Analytics: Tracked pagination to page ${pageNumber}`);
    } catch (error) {
      console.error('Analytics: Error tracking pagination event', error);
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
      const suggestedTerm = this.sanitizeText(link.textContent) || '';

      // Prepare data for supplement endpoint - IMPORTANT: use "query" not "originalQuery"
      const data = {
        type: 'spelling',
        query: originalTerm,
        enrichmentData: {
          actionType: 'spelling',
          suggestedQuery: suggestedTerm,
          timestamp: Date.now()
        }
      };

      // Send analytics data through core manager
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
   * Sanitize a string value for analytics
   * @param {string} text - The text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    if (typeof text !== 'string') {
      return 'unknown';
    }

    // First, remove any surrounding whitespace
    let sanitized = text.trim();

    // Remove common counter patterns that might be in the text
    // Remove " (26)" or "(26)" at the end
    sanitized = sanitized.replace(/\s*\(\d+\)$/g, '');
    // Remove " [26]" or "[26]" at the end
    sanitized = sanitized.replace(/\s*\[\d+\]$/g, '');
    // Remove any number in parentheses anywhere
    sanitized = sanitized.replace(/\s*\(\d+\)/g, '');

    // Replace line breaks, tabs, and control characters with spaces
    sanitized = sanitized.replace(/[\r\n\t\f\v]+/g, ' ');

    // Remove any HTML tags that might be present
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Normalize multiple spaces to a single space
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Final trim to remove any leading/trailing whitespace
    sanitized = sanitized.trim();

    return sanitized || 'unknown';
  }

  /**
   * Handles DOM changes by adding listeners to new content.
   * @param {NodeList} addedNodes - Nodes added to the DOM
   */
  handleDomChanges(addedNodes) {
    // Using event delegation, no specific action needed here
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