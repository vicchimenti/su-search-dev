/**
 * @fileoverview SearchInput - User input component for search functionality
 * 
 * This module provides the user input interface for search, handling
 * text input, suggestions, and search submission.
 * 
 * Features:
 * - Input handling and validation
 * - Query debouncing
 * - Accessibility support
 * - Event-based communication
 * - Responsive design support
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace SearchInput
 * @requires EventBus, DomUtils
 * @lastUpdated 2025-04-02
 */

import EventBus from '../core/EventBus.js';
import { debounce } from '../utils/DebounceUtils.js';

/**
 * Default configuration for SearchInput
 * @type {Object}
 */
const DEFAULT_CONFIG = {
  // Selectors
  formSelector: '#search-form',
  inputSelector: '#search-input',
  submitSelector: '#search-button',
  suggestionsContainerSelector: '#search-suggestions',
  
  // Behavior
  minQueryLength: 3,
  debounceTime: 200,
  placeholderText: 'Search Seattle University',
  mobileBreakpoint: 768,
  
  // CSS classes
  loadingClass: 'is-loading',
  activeClass: 'is-active',
  errorClass: 'has-error',
  mobileClass: 'is-mobile',
  
  // Aria attributes
  ariaLabels: {
    input: 'Search query',
    submit: 'Submit search',
    suggestions: 'Search suggestions'
  }
};

/**
 * SearchInput - User input component for search functionality
 */
class SearchInput {
  /**
   * Create a new SearchInput instance
   * @param {Object} config - Component configuration
   */
  constructor(config = {}) {
    // Apply configuration with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize state
    this.state = {
      query: '',
      isLoading: false,
      hasError: false,
      errorMessage: '',
      isMobile: false,
      hasFocus: false
    };
    
    // Initialize elements
    this._initElements();
    
    // Set up event handlers
    this._setupEventHandlers();
    
    // Create debounced input handler
    this.debouncedHandleInput = debounce(
      this._handleInputDebounced.bind(this),
      this.config.debounceTime
    );
    
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
    // Get form elements
    this.form = document.querySelector(this.config.formSelector);
    this.input = document.querySelector(this.config.inputSelector);
    this.submitBtn = document.querySelector(this.config.submitSelector);
    this.suggestionsContainer = document.querySelector(this.config.suggestionsContainerSelector);
    
    // Validate required elements
    if (!this.form) {
      console.error(`SearchInput: Form element not found: ${this.config.formSelector}`);
    }
    
    if (!this.input) {
      console.error(`SearchInput: Input element not found: ${this.config.inputSelector}`);
    }
    
    // Set initial attributes
    if (this.input) {
      this.input.setAttribute('placeholder', this.config.placeholderText);
      this.input.setAttribute('aria-label', this.config.ariaLabels.input);
      
      // Set initial value from URL if present
      const urlParams = new URLSearchParams(window.location.search);
      const urlQuery = urlParams.get('query');
      
      if (urlQuery) {
        this.input.value = urlQuery;
        this.state.query = urlQuery;
      }
    }
    
    if (this.submitBtn) {
      this.submitBtn.setAttribute('aria-label', this.config.ariaLabels.submit);
    }
    
    if (this.suggestionsContainer) {
      this.suggestionsContainer.setAttribute('role', 'listbox');
      this.suggestionsContainer.setAttribute('aria-label', this.config.ariaLabels.suggestions);
    }
  }
  
  /**
   * Set up event handlers
   * @private
   */
  _setupEventHandlers() {
    // Form submit handler
    this._onFormSubmit = this._handleFormSubmit.bind(this);
    
    // Input handlers
    this._onInputFocus = this._handleInputFocus.bind(this);
    this._onInputBlur = this._handleInputBlur.bind(this);
    this._onInputChange = this._handleInputChange.bind(this);
    this._onInputKeydown = this._handleInputKeydown.bind(this);
    
    // Click handlers
    this._onDocumentClick = this._handleDocumentClick.bind(this);
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
    if (this.form) {
      this.form.classList.toggle(this.config.mobileClass, isMobile);
    }
    
    // Update behavior for mobile
    this._updateMobileBehavior(isMobile);
  }
  
  /**
   * Update behavior for mobile devices
   * @private
   * @param {boolean} isMobile - Whether the device is mobile
   */
  _updateMobileBehavior(isMobile) {
    // Example mobile-specific behaviors
    if (this.input) {
      // Adjust placeholder text for mobile
      this.input.setAttribute(
        'placeholder',
        isMobile ? 'Search' : this.config.placeholderText
      );
    }
  }
  
  /**
   * Initialize event listeners
   * @private
   */
  _initEventListeners() {
    // Form events
    if (this.form) {
      this.form.addEventListener('submit', this._onFormSubmit);
    }
    
    // Input events
    if (this.input) {
      this.input.addEventListener('focus', this._onInputFocus);
      this.input.addEventListener('blur', this._onInputBlur);
      this.input.addEventListener('input', this._onInputChange);
      this.input.addEventListener('keydown', this._onInputKeydown);
    }
    
    // Document events for handling clicks outside
    document.addEventListener('click', this._onDocumentClick);
    
    // Subscribe to events from other components
    EventBus.on('suggestions:update', this._handleSuggestionsUpdate.bind(this));
    EventBus.on('suggestions:loading', this._handleSuggestionsLoading.bind(this));
    EventBus.on('suggestions:error', this._handleSuggestionsError.bind(this));
    EventBus.on('suggestions:clear', this._handleSuggestionsClear.bind(this));
    EventBus.on('search:loading', this._handleSearchLoading.bind(this));
    EventBus.on('search:error', this._handleSearchError.bind(this));
  }
  
  /**
   * Handle form submission
   * @private
   * @param {Event} event - Form submit event
   */
  _handleFormSubmit(event) {
    event.preventDefault();
    
    const query = this.input.value.trim();
    
    if (query.length > 0) {
      // Update state
      this.state.query = query;
      
      // Hide suggestions
      this._hideSuggestions();
      
      // Emit event
      EventBus.emit('query:submit', query);
    }
  }
  
  /**
   * Handle input focus
   * @private
   * @param {Event} event - Focus event
   */
  _handleInputFocus(event) {
    // Update state
    this.state.hasFocus = true;
    
    // Show suggestions if we have a query
    const query = this.input.value.trim();
    if (query.length >= this.config.minQueryLength) {
      this._showSuggestions();
    }
  }
  
  /**
   * Handle input blur
   * @private
   * @param {Event} event - Blur event
   */
  _handleInputBlur(event) {
    // Update state
    this.state.hasFocus = false;
    
    // Don't hide suggestions immediately to allow for clicks on suggestions
    setTimeout(() => {
      // Check if focus moved to a suggestion
      if (!this.state.hasFocus) {
        this._hideSuggestions();
      }
    }, 150);
  }
  
  /**
   * Handle input change
   * @private
   * @param {Event} event - Input event
   */
  _handleInputChange(event) {
    const query = this.input.value.trim();
    
    // Update state
    this.state.query = query;
    
    // Clear error state
    this._clearError();
    
    // Show or hide suggestions based on query length
    if (query.length >= this.config.minQueryLength) {
      this._showSuggestions();
      
      // Debounce input to avoid excessive API calls
      this.debouncedHandleInput(query);
    } else {
      this._hideSuggestions();
      EventBus.emit('suggestions:clear');
    }
  }
  
  /**
   * Debounced input handler - called after user stops typing
   * @private
   * @param {string} query - The current query
   */
  _handleInputDebounced(query) {
    if (query.length >= this.config.minQueryLength) {
      // Emit event for suggestion fetching
      EventBus.emit('query:input', query);
    }
  }
  
  /**
   * Handle keyboard navigation in input and suggestions
   * @private
   * @param {KeyboardEvent} event - Keydown event
   */
  _handleInputKeydown(event) {
    // Check if suggestions are visible
    const isSuggestionsVisible = this.suggestionsContainer && 
                                !this.suggestionsContainer.hidden &&
                                this.suggestionsContainer.children.length > 0;
    
    if (!isSuggestionsVisible) {
      return;
    }
    
    // Get suggestion items
    const suggestionItems = this.suggestionsContainer.querySelectorAll('[role="option"]');
    
    // Find currently active item
    let activeIndex = -1;
    suggestionItems.forEach((item, index) => {
      if (item.classList.contains(this.config.activeClass)) {
        activeIndex = index;
      }
    });
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        
        // Move to next item or first if none active
        const nextIndex = activeIndex < suggestionItems.length - 1 ? activeIndex + 1 : 0;
        this._setActiveSuggestion(suggestionItems, activeIndex, nextIndex);
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        
        // Move to previous item or last if none active
        const prevIndex = activeIndex > 0 ? activeIndex - 1 : suggestionItems.length - 1;
        this._setActiveSuggestion(suggestionItems, activeIndex, prevIndex);
        break;
        
      case 'Enter':
        // If a suggestion is active, select it
        if (activeIndex >= 0) {
          event.preventDefault();
          this._selectSuggestion(suggestionItems[activeIndex]);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        this._hideSuggestions();
        this.input.blur();
        break;
    }
  }
  
  /**
   * Set the active suggestion in the list
   * @private
   * @param {NodeList} items - Suggestion items
   * @param {number} currentIndex - Current active index
   * @param {number} newIndex - New active index
   */
  _setActiveSuggestion(items, currentIndex, newIndex) {
    // Remove active class from current item
    if (currentIndex >= 0) {
      items[currentIndex].classList.remove(this.config.activeClass);
      items[currentIndex].setAttribute('aria-selected', 'false');
    }
    
    // Add active class to new item
    items[newIndex].classList.add(this.config.activeClass);
    items[newIndex].setAttribute('aria-selected', 'true');
    
    // Ensure the item is visible (scroll if needed)
    items[newIndex].scrollIntoView({ block: 'nearest' });
  }
  
  /**
   * Select a suggestion and perform search
   * @private
   * @param {Element} suggestionElement - The selected suggestion element
   */
  _selectSuggestion(suggestionElement) {
    // Get suggestion text
    const suggestionText = suggestionElement.textContent.trim();
    
    // Update input
    this.input.value = suggestionText;
    this.state.query = suggestionText;
    
    // Hide suggestions
    this._hideSuggestions();
    
    // Emit suggestion selection event
    EventBus.emit('suggestion:selected', {
      text: suggestionText,
      type: suggestionElement.dataset.type || 'general',
      url: suggestionElement.dataset.url || null
    });
    
    // Trigger search
    EventBus.emit('query:submit', suggestionText);
  }
  
  /**
   * Handle clicks outside the search component
   * @private
   * @param {MouseEvent} event - Click event
   */
  _handleDocumentClick(event) {
    // Check if click was outside search component
    const isClickInside = this.form && this.form.contains(event.target);
    
    if (!isClickInside) {
      this._hideSuggestions();
    }
  }
  
  /**
   * Show the suggestions container
   * @private
   */
  _showSuggestions() {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.hidden = false;
      this.suggestionsContainer.setAttribute('aria-hidden', 'false');
    }
  }
  
  /**
   * Hide the suggestions container
   * @private
   */
  _hideSuggestions() {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.hidden = true;
      this.suggestionsContainer.setAttribute('aria-hidden', 'true');
    }
  }
  
  /**
   * Clear error state
   * @private
   */
  _clearError() {
    this.state.hasError = false;
    this.state.errorMessage = '';
    
    if (this.input) {
      this.input.classList.remove(this.config.errorClass);
      this.input.removeAttribute('aria-invalid');
    }
  }
  
  /**
   * Set error state
   * @private
   * @param {string} message - Error message
   */
  _setError(message) {
    this.state.hasError = true;
    this.state.errorMessage = message;
    
    if (this.input) {
      this.input.classList.add(this.config.errorClass);
      this.input.setAttribute('aria-invalid', 'true');
    }
  }
  
  /**
   * Handle suggestions update event
   * @private
   * @param {Object} suggestions - Updated suggestions data
   */
  _handleSuggestionsUpdate(suggestions) {
    // Suggestions are handled by the SuggestionPanel component
    // This just ensures the container is visible if we have results
    if (this.state.hasFocus) {
      this._showSuggestions();
    }
  }
  
  /**
   * Handle suggestions loading event
   * @private
   * @param {boolean} isLoading - Whether suggestions are loading
   */
  _handleSuggestionsLoading(isLoading) {
    this.state.isLoading = isLoading;
    
    if (this.input) {
      this.input.classList.toggle(this.config.loadingClass, isLoading);
      
      if (isLoading) {
        this.input.setAttribute('aria-busy', 'true');
      } else {
        this.input.removeAttribute('aria-busy');
      }
    }
  }
  
  /**
   * Handle suggestions error event
   * @private
   * @param {string} error - Error message
   */
  _handleSuggestionsError(error) {
    this._setError(error);
  }
  
  /**
   * Handle suggestions clear event
   * @private
   */
  _handleSuggestionsClear() {
    this._hideSuggestions();
  }
  
  /**
   * Handle search loading event
   * @private
   * @param {boolean} isLoading - Whether search is loading
   */
  _handleSearchLoading(isLoading) {
    this.state.isLoading = isLoading;
    
    if (this.form) {
      this.form.classList.toggle(this.config.loadingClass, isLoading);
    }
    
    if (this.submitBtn) {
      this.submitBtn.disabled = isLoading;
      
      if (isLoading) {
        this.submitBtn.setAttribute('aria-busy', 'true');
      } else {
        this.submitBtn.removeAttribute('aria-busy');
      }
    }
  }
  
  /**
   * Handle search error event
   * @private
   * @param {string} error - Error message
   */
  _handleSearchError(error) {
    this._setError(error);
  }
  
  /**
   * Set the query programmatically
   * @param {string} query - New query
   */
  setQuery(query) {
    if (this.input) {
      this.input.value = query;
      this.state.query = query;
    }
  }
  
  /**
   * Focus the input field
   */
  focus() {
    if (this.input) {
      this.input.focus();
    }
  }
  
  /**
   * Clear the input field
   */
  clear() {
    if (this.input) {
      this.input.value = '';
      this.state.query = '';
      this._clearError();
      this._hideSuggestions();
    }
  }
  
  /**
   * Get the current query
   * @returns {string} Current query
   */
  getQuery() {
    return this.state.query;
  }
  
  /**
   * Destroy the component, removing event listeners
   */
  destroy() {
    // Remove form events
    if (this.form) {
      this.form.removeEventListener('submit', this._onFormSubmit);
    }
    
    // Remove input events
    if (this.input) {
      this.input.removeEventListener('focus', this._onInputFocus);
      this.input.removeEventListener('blur', this._onInputBlur);
      this.input.removeEventListener('input', this._onInputChange);
      this.input.removeEventListener('keydown', this._onInputKeydown);
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

export default SearchInput;