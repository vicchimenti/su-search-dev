/**
 * @fileoverview SuggestionPanel - Three-column search suggestions component
 * 
 * This module provides a three-column suggestion panel for displaying
 * search suggestions, staff profiles, and academic programs.
 * 
 * Features:
 * - Three-column layout for different suggestion types
 * - Responsive design for mobile devices
 * - Keyboard navigation support
 * - Click handling for different suggestion types
 * - Direct profile links for staff
 * - Loading state indicators
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace SuggestionPanel
 * @requires EventBus, DomUtils
 * @lastUpdated 2025-04-02
 */

import EventBus from '../core/EventBus.js';
import { createElement, createFragment } from '../utils/DomUtils.js';

/**
 * Default configuration for SuggestionPanel
 * @type {Object}
 */
const DEFAULT_CONFIG = {
  // Container selector
  containerSelector: '#search-suggestions',
  
  // Column settings
  columns: {
    general: {
      title: 'Suggestions',
      maxItems: 5,
      emptyMessage: 'No suggestions found'
    },
    staff: {
      title: 'Faculty & Staff',
      maxItems: 3,
      emptyMessage: 'No staff matches found'
    },
    programs: {
      title: 'Programs',
      maxItems: 3,
      emptyMessage: 'No program matches found'
    }
  },
  
  // Behavior
  mobileBreakpoint: 768,
  closeOnSelect: true,
  openLinksInNewTab: true,
  trackClicks: true,
  
  // CSS classes
  loadingClass: 'is-loading',
  activeClass: 'is-active',
  mobileClass: 'is-mobile',
  
  // CSS selectors
  selectors: {
    columnContainer: '.suggestions-columns',
    column: '.suggestions-column',
    item: '.suggestion-item',
    header: '.column-header',
    staffImage: '.staff-image img',
    staffInfo: '.staff-info',
    programInfo: '.program-info'
  }
};

/**
 * SuggestionPanel - Three-column search suggestions component
 */
class SuggestionPanel {
  /**
   * Create a new SuggestionPanel instance
   * @param {Object} config - Component configuration
   */
  constructor(config = {}) {
    // Apply configuration with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize state
    this.state = {
      suggestions: {
        general: [],
        staff: [],
        programs: []
      },
      isLoading: false,
      hasError: false,
      errorMessage: '',
      isMobile: false,
      activeColumn: null,
      activeIndex: -1
    };
    
    // Initialize elements
    this._initElements();
    
    // Set up event handlers
    this._setupEventHandlers();
    
    // Initialize media query for responsive behavior
    this._initMediaQuery();
    
    // Set up event listeners
    this._initEventListeners();
  }
  
  /**
   * Initialize DOM elements
   * @private
   */
  _initElements() {
    // Get container element
    this.container = document.querySelector(this.config.containerSelector);
    
    // Validate container
    if (!this.container) {
      console.error(`SuggestionPanel: Container element not found: ${this.config.containerSelector}`);
      return;
    }
    
    // Set container attributes
    this.container.setAttribute('role', 'listbox');
    this.container.setAttribute('aria-label', 'Search suggestions');
    this.container.hidden = true;
    
    // Create initial structure
    this._createPanelStructure();
  }
  
  /**
   * Create the suggestion panel structure
   * @private
   */
  _createPanelStructure() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create columns container
    this.columnsContainer = createElement('div', {
      className: 'suggestions-columns'
    });
    
    // Create columns
    this.columns = {
      general: this._createColumn('general'),
      staff: this._createColumn('staff'),
      programs: this._createColumn('programs')
    };
    
    // Add columns to container
    this.columnsContainer.appendChild(this.columns.general);
    this.columnsContainer.appendChild(this.columns.staff);
    this.columnsContainer.appendChild(this.columns.programs);
    
    // Add to main container
    this.container.appendChild(this.columnsContainer);
  }
  
  /**
   * Create a suggestion column
   * @private
   * @param {string} type - Column type ('general', 'staff', or 'programs')
   * @returns {HTMLElement} Column element
   */
  _createColumn(type) {
    const column = createElement('div', {
      className: 'suggestions-column',
      attributes: {
        'data-column-type': type
      }
    });
    
    // Create column header
    const header = createElement('div', {
      className: 'column-header',
      textContent: this.config.columns[type].title
    });
    
    // Create items container
    const itemsContainer = createElement('div', {
      className: 'column-items'
    });
    
    // Add to column
    column.appendChild(header);
    column.appendChild(itemsContainer);
    
    return column;
  }
  
  /**
   * Set up event handlers
   * @private
   */
  _setupEventHandlers() {
    // Click handlers
    this._onContainerClick = this._handleContainerClick.bind(this);
    this._onDocumentClick = this._handleDocumentClick.bind(this);
    
    // Keyboard handlers
    this._onKeydown = this._handleKeydown.bind(this);
  }
  
  /**
   * Initialize media query for responsive behavior
   * @private
   */
  _initMediaQuery() {
    // Create media query
    this.mediaQuery = window.matchMedia(`(max-width: ${this.config.mobileBreakpoint}px)`);
    
    // Initial check
    this._handleMediaQueryChange(this.mediaQuery);
    
    // Set up listener for changes
    if (this.mediaQuery.addEventListener) {
      // Modern browsers
      this.mediaQuery.addEventListener('change', this._handleMediaQueryChange.bind(this));
    } else {
      // Legacy support
      this.mediaQuery.addListener(this._handleMediaQueryChange.bind(this));
    }
  }
  
  /**
   * Handle media query changes for responsive behavior
   * @private
   * @param {MediaQueryList|MediaQueryListEvent} mql - Media query list or event
   */
  _handleMediaQueryChange(mql) {
    const isMobile = mql.matches;
    
    // Update state
    this.state.isMobile = isMobile;
    
    // Update classes
    if (this.container) {
      this.container.classList.toggle(this.config.mobileClass, isMobile);
    }
    
    // Adjust column layout for mobile
    this._updateMobileLayout(isMobile);
  }
  
  /**
   * Update layout for mobile devices
   * @private
   * @param {boolean} isMobile - Whether the device is mobile
   */
  _updateMobileLayout(isMobile) {
    if (this.columnsContainer) {
      if (isMobile) {
        // On mobile, stack the columns vertically
        this.columnsContainer.classList.add('vertical-layout');
      } else {
        // On desktop, use horizontal layout
        this.columnsContainer.classList.remove('vertical-layout');
      }
    }
  }
  
  /**
   * Initialize event listeners
   * @private
   */
  _initEventListeners() {
    // Container events
    if (this.container) {
      this.container.addEventListener('click', this._onContainerClick);
      this.container.addEventListener('keydown', this._onKeydown);
    }
    
    // Document events for handling clicks outside
    document.addEventListener('click', this._onDocumentClick);
    
    // Subscribe to events from other components
    EventBus.on('suggestions:update', this._handleSuggestionsUpdate.bind(this));
    EventBus.on('suggestions:loading', this._handleSuggestionsLoading.bind(this));
    EventBus.on('suggestions:error', this._handleSuggestionsError.bind(this));
    EventBus.on('suggestions:clear', this._handleSuggestionsClear.bind(this));
  }
  
  /**
   * Handle container click events
   * @private
   * @param {MouseEvent} event - Click event
   */
  _handleContainerClick(event) {
    // Find closest suggestion item
    const item = event.target.closest(this.config.selectors.item);
    
    if (item) {
      // Get suggestion data
      const type = item.dataset.type;
      const text = item.querySelector('.suggestion-text')?.textContent.trim() || '';
      const url = item.dataset.url || null;
      
      // Check if click was on a link
      const isLinkClick = event.target.closest('a');
      
      // Handle click based on type
      if (type === 'staff' || type === 'program') {
        if (url && isLinkClick) {
          // Allow default link behavior if click was on link
          // Track click for analytics
          if (this.config.trackClicks) {
            this._trackSuggestionClick(text, type, url);
          }
          
          // Don't prevent default, let the link handle navigation
          return;
        }
      }
      
      // For other cases, handle selection manually
      event.preventDefault();
      this._selectSuggestion(item);
    }
  }
  
  /**
   * Handle document clicks (for closing suggestions)
   * @private
   * @param {MouseEvent} event - Click event
   */
  _handleDocumentClick(event) {
    // Only handle if suggestions are visible
    if (this.container && !this.container.hidden) {
      // Check if click was outside suggestions
      const isClickInside = this.container.contains(event.target);
      
      if (!isClickInside) {
        this._hide();
      }
    }
  }
  
  /**
   * Handle keyboard navigation in suggestions
   * @private
   * @param {KeyboardEvent} event - Keydown event
   */
  _handleKeydown(event) {
    // Only handle if suggestions are visible
    if (this.container.hidden) {
      return;
    }
    
    // Get active elements
    const { activeColumn, activeIndex } = this.state;
    
    // Define column order for navigation
    const columnOrder = ['general', 'staff', 'programs'];
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        
        if (activeColumn) {
          // Get items in current column
          const items = this._getColumnItems(activeColumn);
          
          if (items.length > 0) {
            // Move to next item or wrap around
            const nextIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
            this._setActiveSuggestion(activeColumn, nextIndex);
          }
        } else {
          // No active item, select first item in first column with items
          for (const colType of columnOrder) {
            const items = this._getColumnItems(colType);
            if (items.length > 0) {
              this._setActiveSuggestion(colType, 0);
              break;
            }
          }
        }
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        
        if (activeColumn) {
          // Get items in current column
          const items = this._getColumnItems(activeColumn);
          
          if (items.length > 0) {
            // Move to previous item or wrap around
            const prevIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
            this._setActiveSuggestion(activeColumn, prevIndex);
          }
        } else {
          // No active item, select last item in first column with items
          for (const colType of columnOrder) {
            const items = this._getColumnItems(colType);
            if (items.length > 0) {
              this._setActiveSuggestion(colType, items.length - 1);
              break;
            }
          }
        }
        break;
        
      case 'ArrowRight':
        event.preventDefault();
        
        if (activeColumn) {
          // Find next column with items
          const currentColIndex = columnOrder.indexOf(activeColumn);
          
          if (currentColIndex < columnOrder.length - 1) {
            // Try each column to the right
            for (let i = currentColIndex + 1; i < columnOrder.length; i++) {
              const nextColType = columnOrder[i];
              const items = this._getColumnItems(nextColType);
              
              if (items.length > 0) {
                // Move to same index in next column if possible, otherwise first item
                const nextIndex = activeIndex < items.length ? activeIndex : 0;
                this._setActiveSuggestion(nextColType, nextIndex);
                break;
              }
            }
          }
        } else {
          // No active item, select first item in first column with items
          for (const colType of columnOrder) {
            const items = this._getColumnItems(colType);
            if (items.length > 0) {
              this._setActiveSuggestion(colType, 0);
              break;
            }
          }
        }
        break;
        
      case 'ArrowLeft':
        event.preventDefault();
        
        if (activeColumn) {
          // Find previous column with items
          const currentColIndex = columnOrder.indexOf(activeColumn);
          
          if (currentColIndex > 0) {
            // Try each column to the left
            for (let i = currentColIndex - 1; i >= 0; i--) {
              const prevColType = columnOrder[i];
              const items = this._getColumnItems(prevColType);
              
              if (items.length > 0) {
                // Move to same index in previous column if possible, otherwise first item
                const prevIndex = activeIndex < items.length ? activeIndex : 0;
                this._setActiveSuggestion(prevColType, prevIndex);
                break;
              }
            }
          }
        } else {
          // No active item, select first item in last column with items
          for (let i = columnOrder.length - 1; i >= 0; i--) {
            const colType = columnOrder[i];
            const items = this._getColumnItems(colType);
            if (items.length > 0) {
              this._setActiveSuggestion(colType, 0);
              break;
            }
          }
        }
        break;
        
      case 'Enter':
        if (activeColumn && activeIndex >= 0) {
          event.preventDefault();
          
          // Get active item
          const items = this._getColumnItems(activeColumn);
          if (activeIndex < items.length) {
            this._selectSuggestion(items[activeIndex]);
          }
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        this._hide();
        break;
    }
  }
  
  /**
   * Get all suggestion items in a column
   * @private
   * @param {string} columnType - Column type ('general', 'staff', or 'programs')
   * @returns {NodeList} Suggestion items
   */
  _getColumnItems(columnType) {
    const column = this.columns[columnType];
    return column ? column.querySelectorAll(this.config.selectors.item) : [];
  }
  
  /**
   * Set the active suggestion
   * @private
   * @param {string} columnType - Column type ('general', 'staff', or 'programs')
   * @param {number} index - Item index
   */
  _setActiveSuggestion(columnType, index) {
    // Clear current active item
    if (this.state.activeColumn) {
      const items = this._getColumnItems(this.state.activeColumn);
      if (this.state.activeIndex >= 0 && this.state.activeIndex < items.length) {
        items[this.state.activeIndex].classList.remove(this.config.activeClass);
        items[this.state.activeIndex].setAttribute('aria-selected', 'false');
      }
    }
    
    // Set new active item
    this.state.activeColumn = columnType;
    this.state.activeIndex = index;
    
    const items = this._getColumnItems(columnType);
    if (index >= 0 && index < items.length) {
      items[index].classList.add(this.config.activeClass);
      items[index].setAttribute('aria-selected', 'true');
      
      // Ensure item is visible
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }
  
  /**
   * Select a suggestion
   * @private
   * @param {Element} item - Suggestion item element
   */
  _selectSuggestion(item) {
    // Get suggestion data
    const type = item.dataset.type;
    const text = item.querySelector('.suggestion-text')?.textContent.trim() || '';
    const url = item.dataset.url || null;
    
    // Track click for analytics
    if (this.config.trackClicks && url) {
      this._trackSuggestionClick(text, type, url);
    }
    
    // Emit suggestion selected event
    EventBus.emit('suggestion:selected', {
      text,
      type,
      url
    });
    
    // Handle URL navigation for staff and program items
    if ((type === 'staff' || type === 'program') && url) {
      // Open in new tab if configured
      if (this.config.openLinksInNewTab) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = url;
      }
    }
    
    // Close suggestions if configured
    if (this.config.closeOnSelect) {
      this._hide();
    }
  }
  
  /**
   * Track suggestion click for analytics
   * @private
   * @param {string} text - Suggestion text
   * @param {string} type - Suggestion type
   * @param {string} url - Suggestion URL
   */
  _trackSuggestionClick(text, type, url) {
    EventBus.emit('suggestion:click', {
      text,
      type,
      url
    });
  }
  
  /**
   * Hide the suggestions panel
   * @private
   */
  _hide() {
    if (this.container) {
      this.container.hidden = true;
      this.container.setAttribute('aria-hidden', 'true');
      
      // Clear active item
      this.state.activeColumn = null;
      this.state.activeIndex = -1;
    }
  }
  
  /**
   * Show the suggestions panel
   * @private
   */
  _show() {
    if (this.container) {
      this.container.hidden = false;
      this.container.setAttribute('aria-hidden', 'false');
    }
  }
  
  /**
   * Handle suggestions update event
   * @private
   * @param {Object} suggestions - New suggestions data
   */
  _handleSuggestionsUpdate(suggestions) {
    // Update state
    this.state.suggestions = suggestions;
    
    // Update UI
    this._updateSuggestionDisplay();
    
    // Show panel if there are suggestions
    const hasAnySuggestions = 
      suggestions.general.length > 0 ||
      suggestions.staff.length > 0 ||
      suggestions.programs.length > 0;
    
    if (hasAnySuggestions) {
      this._show();
    } else {
      this._hide();
    }
  }
  
  /**
   * Handle suggestions loading event
   * @private
   * @param {boolean} isLoading - Whether suggestions are loading
   */
  _handleSuggestionsLoading(isLoading) {
    this.state.isLoading = isLoading;
    
    if (this.container) {
      this.container.classList.toggle(this.config.loadingClass, isLoading);
    }
  }
  
  /**
   * Handle suggestions error event
   * @private
   * @param {string} error - Error message
   */
  _handleSuggestionsError(error) {
    this.state.hasError = true;
    this.state.errorMessage = error;
    
    // Display error in UI
    this._hide();
  }
  
  /**
   * Handle suggestions clear event
   * @private
   */
  _handleSuggestionsClear() {
    // Clear state
    this.state.suggestions = {
      general: [],
      staff: [],
      programs: []
    };
    
    // Clear UI
    this._updateSuggestionDisplay();
    
    // Hide panel
    this._hide();
  }
  
  /**
   * Update the suggestion display with current suggestions
   * @private
   */
  _updateSuggestionDisplay() {
    // Update general suggestions
    this._updateGeneralSuggestions();
    
    // Update staff suggestions
    this._updateStaffSuggestions();
    
    // Update program suggestions
    this._updateProgramSuggestions();
  }
  
  /**
   * Update general suggestions column
   * @private
   */
  _updateGeneralSuggestions() {
    const column = this.columns.general;
    if (!column) return;
    
    const itemsContainer = column.querySelector('.column-items');
    if (!itemsContainer) return;
    
    // Clear current items
    itemsContainer.innerHTML = '';
    
    // Get suggestions
    const suggestions = this.state.suggestions.general || [];
    const maxItems = this.config.columns.general.maxItems;
    
    // Create fragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    
    if (suggestions.length > 0) {
      // Add suggestion items
      suggestions.slice(0, maxItems).forEach((suggestion, index) => {
        const item = createElement('div', {
          className: 'suggestion-item',
          attributes: {
            'role': 'option',
            'data-type': 'general',
            'data-index': index,
            'aria-selected': 'false'
          }
        });
        
        // Create text content
        const text = createElement('span', {
          className: 'suggestion-text',
          textContent: suggestion.display || ''
        });
        
        // Add to item
        item.appendChild(text);
        fragment.appendChild(item);
      });
    } else {
      // Add empty message
      const emptyMessage = createElement('div', {
        className: 'empty-message',
        textContent: this.config.columns.general.emptyMessage
      });
      
      fragment.appendChild(emptyMessage);
    }
    
    // Add to container
    itemsContainer.appendChild(fragment);
  }
  
  /**
   * Update staff suggestions column
   * @private
   */
  _updateStaffSuggestions() {
    const column = this.columns.staff;
    if (!column) return;
    
    const itemsContainer = column.querySelector('.column-items');
    if (!itemsContainer) return;
    
    // Clear current items
    itemsContainer.innerHTML = '';
    
    // Get suggestions
    const staffItems = this.state.suggestions.staff || [];
    const maxItems = this.config.columns.staff.maxItems;
    
    // Create fragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    
    if (staffItems.length > 0) {
      // Add staff items
      staffItems.slice(0, maxItems).forEach((staff, index) => {
        const item = createElement('div', {
          className: 'suggestion-item staff-item',
          attributes: {
            'role': 'option',
            'data-type': 'staff',
            'data-index': index,
            'data-url': staff.url || '',
            'aria-selected': 'false',
            'title': 'Click to view profile'
          }
        });
        
        // Create link wrapper
        const link = createElement('a', {
          className: 'staff-link',
          attributes: {
            'href': staff.url || '#',
            'target': this.config.openLinksInNewTab ? '_blank' : '',
            'rel': this.config.openLinksInNewTab ? 'noopener noreferrer' : ''
          }
        });
        
        // Create suggestion content
        const content = createElement('div', {
          className: 'staff-suggestion'
        });
        
        // Add image if available
        if (staff.image) {
          const imageDiv = createElement('div', {
            className: 'staff-image'
          });
          
          const img = createElement('img', {
            attributes: {
              'src': staff.image,
              'alt': staff.title || 'Staff photo',
              'loading': 'lazy'
            },
            className: 'staff-thumbnail'
          });
          
          imageDiv.appendChild(img);
          content.appendChild(imageDiv);
        }
        
        // Create info container
        const info = createElement('div', {
          className: 'staff-info'
        });
        
        // Add title
        const text = createElement('span', {
          className: 'suggestion-text',
          textContent: staff.title || ''
        });
        info.appendChild(text);
        
        // Add metadata if available
        if (staff.metadata) {
          const role = createElement('span', {
            className: 'staff-role',
            textContent: staff.metadata
          });
          info.appendChild(role);
        }
        
        // Add department if available
        if (staff.department) {
          const dept = createElement('span', {
            className: 'staff-department suggestion-type',
            textContent: staff.department
          });
          info.appendChild(dept);
        }
        
        // Assemble components
        content.appendChild(info);
        link.appendChild(content);
        item.appendChild(link);
        fragment.appendChild(item);
      });
    } else {
      // Add empty message
      const emptyMessage = createElement('div', {
        className: 'empty-message',
        textContent: this.config.columns.staff.emptyMessage
      });
      
      fragment.appendChild(emptyMessage);
    }
    
    // Add to container
    itemsContainer.appendChild(fragment);
  }
  
  /**
   * Update program suggestions column
   * @private
   */
  _updateProgramSuggestions() {
    const column = this.columns.programs;
    if (!column) return;
    
    const itemsContainer = column.querySelector('.column-items');
    if (!itemsContainer) return;
    
    // Clear current items
    itemsContainer.innerHTML = '';
    
    // Get suggestions
    const programItems = this.state.suggestions.programs || [];
    const maxItems = this.config.columns.programs.maxItems;
    
    // Create fragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    
    if (programItems.length > 0) {
      // Add program items
      programItems.slice(0, maxItems).forEach((program, index) => {
        const item = createElement('div', {
          className: 'suggestion-item program-item',
          attributes: {
            'role': 'option',
            'data-type': 'program',
            'data-index': index,
            'data-url': program.url || '',
            'aria-selected': 'false',
            'title': 'Click to view program'
          }
        });
        
        // Create link wrapper
        const link = createElement('a', {
          className: 'program-link',
          attributes: {
            'href': program.url || '#',
            'target': this.config.openLinksInNewTab ? '_blank' : '',
            'rel': this.config.openLinksInNewTab ? 'noopener noreferrer' : ''
          }
        });
        
        // Create suggestion content
        const content = createElement('div', {
          className: 'program-suggestion'
        });
        
        // Add title
        const text = createElement('span', {
          className: 'suggestion-text',
          textContent: program.title || ''
        });
        content.appendChild(text);
        
        // Add department if available
        if (program.department) {
          const dept = createElement('span', {
            className: 'suggestion-type',
            textContent: program.department
          });
          content.appendChild(dept);
        }
        
        // Add description if available
        if (program.description) {
          const desc = createElement('span', {
            className: 'program-description',
            textContent: program.description
          });
          content.appendChild(desc);
        }
        
        // Assemble components
        link.appendChild(content);
        item.appendChild(link);
        fragment.appendChild(item);
      });
    } else {
      // Add empty message
      const emptyMessage = createElement('div', {
        className: 'empty-message',
        textContent: this.config.columns.programs.emptyMessage
      });
      
      fragment.appendChild(emptyMessage);
    }
    
    // Add to container
    itemsContainer.appendChild(fragment);
  }
  
  /**
   * Destroy the component, removing event listeners
   */
  destroy() {
    // Remove container events
    if (this.container) {
      this.container.removeEventListener('click', this._onContainerClick);
      this.container.removeEventListener('keydown', this._onKeydown);
    }
    
    // Remove document events
    document.removeEventListener('click', this._onDocumentClick);
    
    // Remove media query listener
    if (this.mediaQuery && this.mediaQuery.removeEventListener) {
      this.mediaQuery.removeEventListener('change', this._handleMediaQueryChange);
    } else if (this.mediaQuery && this.mediaQuery.removeListener) {
      this.mediaQuery.removeListener(this._handleMediaQueryChange);
    }
  }
}

export default SuggestionPanel;