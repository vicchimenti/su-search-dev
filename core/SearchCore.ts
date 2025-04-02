/**
 * @fileoverview SearchCore - Central state management for Seattle University search system
 * 
 * This module serves as the central state manager for the search application,
 * implementing a simplified state management pattern that coordinates between
 * UI components and backend services.
 * 
 * Features:
 * - Centralized state management
 * - Event-based communication
 * - Optimized data flow
 * - Session tracking
 * - Caching integration
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace SearchCore
 * @lastUpdated 2025-04-02
 */

import { EventBus } from './EventBus';
import { ConfigManager, SearchConfig } from './ConfigManager';
import { ApiService } from '../services/ApiService';
import { SessionManager } from '../services/SessionManager';
import { FacetFilter, SearchParams, SearchResults, SearchState, SuggestionResults } from '../types/search';

/**
 * SearchCore - Main state management and coordination
 */
export class SearchCore {
  private static instance: SearchCore;
  private state: SearchState;
  private config: ConfigManager;
  private api: ApiService;
  private session: SessionManager;
  private eventBus: EventBus;

  /**
   * Creates a new SearchCore instance
   * @param config - Configuration options
   */
  constructor(config: Partial<SearchConfig> = {}) {
    // Ensure singleton pattern
    if (SearchCore.instance) {
      return SearchCore.instance;
    }
    
    SearchCore.instance = this;
    
    // Initialize state
    this.state = {
      query: '',
      collection: '',
      profile: '',
      results: null,
      isLoading: false,
      hasError: false,
      errorMessage: '',
      suggestions: {
        general: [],
        staff: [],
        programs: []
      },
      activeFilters: new Map<string, Set<string>>(),
      resultCount: 0,
      pageNumber: 1,
      totalPages: 1
    };
    
    // Initialize dependencies
    this.config = new ConfigManager(config);
    this.api = new ApiService(this.config.getApiConfig());
    this.session = new SessionManager();
    this.eventBus = EventBus.getInstance();
    
    // Set up event listeners
    this._initEventListeners();
    
    // Check URL parameters
    if (typeof window !== 'undefined') {
      this._processUrlParameters();
    }
  }
  
  /**
   * Get singleton instance
   * @param config - Configuration options
   * @returns SearchCore instance
   */
  public static getInstance(config: Partial<SearchConfig> = {}): SearchCore {
    if (!SearchCore.instance) {
      SearchCore.instance = new SearchCore(config);
    }
    return SearchCore.instance;
  }
  
  /**
   * Initialize event listeners for coordinating components
   * @private
   */
  private _initEventListeners(): void {
    // Input handling
    this.eventBus.on('query:input', this._handleQueryInput.bind(this));
    this.eventBus.on('query:submit', this._handleQuerySubmit.bind(this));
    
    // Filter actions
    this.eventBus.on('filter:add', this._handleFilterAdd.bind(this));
    this.eventBus.on('filter:remove', this._handleFilterRemove.bind(this));
    this.eventBus.on('filter:clear', this._handleFilterClear.bind(this));
    
    // Pagination
    this.eventBus.on('page:change', this._handlePageChange.bind(this));
    
    // Result actions
    this.eventBus.on('result:click', this._handleResultClick.bind(this));
  }
  
  /**
   * Process URL parameters to initialize search
   * @private
   */
  private _processUrlParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    
    if (query) {
      // Update state
      this.state.query = query;
      
      // Optional parameters
      this.state.collection = urlParams.get('collection') || this.config.get('defaultCollection');
      this.state.profile = urlParams.get('profile') || this.config.get('defaultProfile');
      
      // Perform search
      this.search(query);
      
      // Notify components of state
      this.eventBus.emit('query:update', query);
    }
  }
  
  /**
   * Handle query input for suggestions
   * @private
   * @param query - The query text
   */
  private _handleQueryInput(query: string): void {
    this.state.query = query;
    
    if (query.length >= this.config.get('minQueryLength')) {
      // Fetch all suggestion types
      this._fetchSuggestions(query);
    } else {
      // Clear suggestions if query is too short
      this.state.suggestions = { general: [], staff: [], programs: [] };
      this.eventBus.emit('suggestions:clear');
    }
  }
  
  /**
   * Fetch suggestions from all endpoints
   * @private
   * @param query - The query text
   */
  private async _fetchSuggestions(query: string): Promise<void> {
    try {
      this.eventBus.emit('suggestions:loading', true);
      
      // Fetch suggestions in parallel
      const [generalSuggestions, staffSuggestions, programSuggestions] = await Promise.all([
        this.api.fetchGeneralSuggestions(query),
        this.api.fetchStaffSuggestions(query),
        this.api.fetchProgramSuggestions(query)
      ]);
      
      // Update state
      this.state.suggestions = {
        general: generalSuggestions,
        staff: staffSuggestions,
        programs: programSuggestions.programs || []
      };
      
      // Notify components
      this.eventBus.emit('suggestions:update', this.state.suggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      this.eventBus.emit('suggestions:error', error instanceof Error ? error.message : 'Error fetching suggestions');
    } finally {
      this.eventBus.emit('suggestions:loading', false);
    }
  }
  
  /**
   * Handle query submission for search
   * @private
   * @param query - The query text
   */
  private _handleQuerySubmit(query: string): void {
    this.state.query = query;
    this.search(query);
  }
  
  /**
   * Perform search with current query and filters
   * @param query - The search query
   * @returns Search results
   */
  public async search(query: string = this.state.query): Promise<SearchResults | null> {
    try {
      // Update state
      this.state.isLoading = true;
      this.state.hasError = false;
      this.state.errorMessage = '';
      
      // Notify loading state
      this.eventBus.emit('search:loading', true);
      
      // Prepare search parameters
      const searchParams: SearchParams = {
        query,
        collection: this.state.collection || this.config.get('defaultCollection'),
        profile: this.state.profile || this.config.get('defaultProfile'),
        page: this.state.pageNumber,
        filters: this._serializeFilters(this.state.activeFilters)
      };
      
      // Add session ID for analytics
      searchParams.sessionId = this.session.getSessionId();
      
      // Perform search
      const results = await this.api.search(searchParams);
      
      // Update state with results
      this._updateSearchResults(results);
      
      // Notify components
      this.eventBus.emit('results:update', this.state.results);
      
      return results;
    } catch (error) {
      console.error('Search error:', error);
      
      // Update error state
      this.state.hasError = true;
      this.state.errorMessage = error instanceof Error ? error.message : 'Error performing search';
      
      // Notify error
      this.eventBus.emit('search:error', this.state.errorMessage);
      
      return null;
    } finally {
      // Update loading state
      this.state.isLoading = false;
      this.eventBus.emit('search:loading', false);
    }
  }
  
  /**
   * Update state with search results
   * @private
   * @param results - The search results
   */
  private _updateSearchResults(results: SearchResults): void {
    this.state.results = results;
    this.state.resultCount = results?.resultCount || 0;
    this.state.totalPages = results?.totalPages || 1;
    
    // Extract available filters
    if (results?.facets) {
      // Process facets for UI
    }
  }
  
  /**
   * Handle filter addition
   * @private
   * @param filter - Filter to add
   */
  private _handleFilterAdd(filter: FacetFilter): void {
    const { name, value } = filter;
    
    // Get current values or create new set
    const values = this.state.activeFilters.get(name) || new Set<string>();
    values.add(value);
    
    // Update filters
    this.state.activeFilters.set(name, values);
    
    // Reset to first page
    this.state.pageNumber = 1;
    
    // Perform search with updated filters
    this.search();
    
    // Notify filter update
    this.eventBus.emit('filters:update', this._getSerializedFilters());
  }
  
  /**
   * Handle filter removal
   * @private
   * @param filter - Filter to remove
   */
  private _handleFilterRemove(filter: FacetFilter): void {
    const { name, value } = filter;
    const values = this.state.activeFilters.get(name);
    
    if (values) {
      values.delete(value);
      
      // Remove the key if no values left
      if (values.size === 0) {
        this.state.activeFilters.delete(name);
      }
      
      // Reset to first page
      this.state.pageNumber = 1;
      
      // Perform search with updated filters
      this.search();
      
      // Notify filter update
      this.eventBus.emit('filters:update', this._getSerializedFilters());
    }
  }
  
  /**
   * Handle clearing all filters
   * @private
   */
  private _handleFilterClear(): void {
    this.state.activeFilters.clear();
    
    // Reset to first page
    this.state.pageNumber = 1;
    
    // Perform search with no filters
    this.search();
    
    // Notify filter update
    this.eventBus.emit('filters:update', this._getSerializedFilters());
  }
  
  /**
   * Handle page change
   * @private
   * @param page - New page number
   */
  private _handlePageChange(page: number): void {
    if (page !== this.state.pageNumber && page > 0 && page <= this.state.totalPages) {
      this.state.pageNumber = page;
      this.search();
    }
  }
  
  /**
   * Handle result click
   * @private
   * @param data - Click data including URL and position
   */
  private _handleResultClick(data: { url: string, title: string, position: number }): void {
    // Record click for analytics
    this.api.recordClick({
      originalQuery: this.state.query,
      clickedUrl: data.url,
      clickedTitle: data.title,
      clickPosition: data.position,
      sessionId: this.session.getSessionId(),
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get current filters in serialized format
   * @private
   * @returns Serialized filters
   */
  private _getSerializedFilters(): Record<string, string[]> {
    const serialized: Record<string, string[]> = {};
    
    this.state.activeFilters.forEach((values, name) => {
      serialized[name] = Array.from(values);
    });
    
    return serialized;
  }
  
  /**
   * Convert filters Map to serialized format for API
   * @private
   * @param filtersMap - Map of filters
   * @returns Serialized filters
   */
  private _serializeFilters(filtersMap: Map<string, Set<string>>): Record<string, string[]> {
    return this._getSerializedFilters();
  }
  
  /**
   * Get the current state
   * @returns Current state
   */
  public getState(): SearchState {
    return { ...this.state };
  }
}

export default SearchCore;