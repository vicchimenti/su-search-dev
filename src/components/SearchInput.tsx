/**
 * @fileoverview Search input with suggestions
 * 
 * This component provides a search input field with real-time suggestions
 * as the user types. It supports three types of suggestions: general,
 * staff/faculty, and programs.
 *
 * @author Victor Chimenti
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { debounce } from '../lib/utils';

interface SearchInputProps {
  initialQuery?: string;
  onSearch: (query: string) => void;
  placeholder?: string;
  minQueryLength?: number;
  debounceTime?: number;
  sessionId?: string;
}

interface Suggestion {
  display: string;
  metadata?: any;
}

interface StaffSuggestion {
  title: string;
  affiliation?: string;
  position?: string;
  department?: string;
  college?: string;
  url: string;
  image?: string;
}

interface ProgramSuggestion {
  title: string;
  url: string;
  details?: {
    type?: string;
    school?: string;
    credits?: string;
    area?: string;
    level?: string;
    mode?: string;
  };
  image?: string;
  description?: string;
}

interface SuggestionResults {
  general: Suggestion[];
  staff: StaffSuggestion[];
  programs: ProgramSuggestion[];
}

export default function SearchInput({
  initialQuery = '',
  onSearch,
  placeholder = 'Search Seattle University',
  minQueryLength = 3,
  debounceTime = 200,
  sessionId
}: SearchInputProps) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SuggestionResults>({
    general: [],
    staff: [],
    programs: []
  });
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Debounced fetch suggestions function
  const debouncedFetch = useRef(
    debounce(async (query: string) => {
      if (query.length < minQueryLength) return;
      
      try {
        setIsLoading(true);
        
        const params = new URLSearchParams({
          query,
          sessionId: sessionId || ''
        });
        
        const response = await fetch(`/api/suggestions?${params}`);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    }, debounceTime)
  ).current;
  
  // Effect to fetch suggestions when query changes
  useEffect(() => {
    if (query.length >= minQueryLength) {
      debouncedFetch(query);
    } else {
      setSuggestions({ general: [], staff: [], programs: [] });
    }
  }, [query, minQueryLength, debouncedFetch]);
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };
  
  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };
  
  // Handle suggestion selection
  const handleSelectSuggestion = (text: string, type: string, url?: string) => {
    setQuery(text);
    setSuggestions({ general: [], staff: [], programs: [] });
    
    // Track click (could be done through API)
    console.log('Selected suggestion:', { text, type, url });
    
    // For staff and programs with URLs, open in new tab
    if ((type === 'staff' || type === 'program') && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    
    // Always trigger search with the selected text
    onSearch(text);
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle if suggestions are shown
    if (!hasSuggestions) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        navigateNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigatePrevious();
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateNextColumn();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigatePreviousColumn();
        break;
      case 'Enter':
        if (activeType && activeIndex >= 0) {
          e.preventDefault();
          const item = getActiveSuggestion();
          if (item) {
            handleSelectSuggestion(
              item.title || item.display,
              activeType,
              'url' in item ? item.url : undefined
            );
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSuggestions({ general: [], staff: [], programs: [] });
        inputRef.current?.blur();
        break;
    }
  };
  
  // Helper for keyboard navigation
  const navigateNext = () => {
    if (!activeType) {
      // Set first column with suggestions
      if (suggestions.general.length > 0) {
        setActiveType('general');
        setActiveIndex(0);
      } else if (suggestions.staff.length > 0) {
        setActiveType('staff');
        setActiveIndex(0);
      } else if (suggestions.programs.length > 0) {
        setActiveType('programs');
        setActiveIndex(0);
      }
      return;
    }
    
    const items = getColumnItems(activeType);
    if (activeIndex < items.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      setActiveIndex(0); // Wrap around
    }
  };
  
  const navigatePrevious = () => {
    if (!activeType) return;
    
    const items = getColumnItems(activeType);
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    } else {
      setActiveIndex(items.length - 1); // Wrap around
    }
  };
  
  const navigateNextColumn = () => {
    if (!activeType) return;
    
    const columnOrder = ['general', 'staff', 'programs'];
    const currentIndex = columnOrder.indexOf(activeType);
    
    if (currentIndex < columnOrder.length - 1) {
      // Try each column to the right
      for (let i = currentIndex + 1; i < columnOrder.length; i++) {
        const nextType = columnOrder[i];
        const items = getColumnItems(nextType);
        
        if (items.length > 0) {
          const nextIndex = Math.min(activeIndex, items.length - 1);
          setActiveType(nextType);
          setActiveIndex(nextIndex);
          break;
        }
      }
    }
  };
  
  const navigatePreviousColumn = () => {
    if (!activeType) return;
    
    const columnOrder = ['general', 'staff', 'programs'];
    const currentIndex = columnOrder.indexOf(activeType);
    
    if (currentIndex > 0) {
      // Try each column to the left
      for (let i = currentIndex - 1; i >= 0; i--) {
        const prevType = columnOrder[i];
        const items = getColumnItems(prevType);
        
        if (items.length > 0) {
          const prevIndex = Math.min(activeIndex, items.length - 1);
          setActiveType(prevType);
          setActiveIndex(prevIndex);
          break;
        }
      }
    }
  };
  
  // Helper to get items in a column
  const getColumnItems = (type: string) => {
    switch (type) {
      case 'general':
        return suggestions.general;
      case 'staff':
        return suggestions.staff;
      case 'programs':
        return suggestions.programs;
      default:
        return [];
    }
  };
  
  // Helper to get active suggestion
  const getActiveSuggestion = () => {
    if (!activeType || activeIndex < 0) return null;
    
    const items = getColumnItems(activeType);
    return items[activeIndex] || null;
  };
  
  // Check if we have any suggestions
  const hasSuggestions = 
    suggestions.general.length > 0 ||
    suggestions.staff.length > 0 ||
    suggestions.programs.length > 0;
  
  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setSuggestions({ general: [], staff: [], programs: [] });
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
  return (
    <div className="search-input-container">
      <form onSubmit={handleSubmit} role="search">
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Search query"
            className={isLoading ? 'loading' : ''}
          />
          <button 
            type="submit" 
            aria-label="Submit search"
            disabled={isLoading}
          >
            <svg className="search-icon" aria-hidden="true">
              <use href="#search"></use>
            </svg>
          </button>
        </div>
        
        {isFocused && hasSuggestions && (
          <div 
            ref={suggestionsRef}
            className="suggestions-container" 
            role="listbox" 
            aria-label="Search suggestions"
          >
            <div className="suggestions-columns">
              {/* General suggestions column */}
              {suggestions.general.length > 0 && (
                <div className="suggestions-column">
                  <div className="column-header">Suggestions</div>
                  {suggestions.general.map((suggestion, index) => (
                    <div
                      key={`general-${index}`}
                      className={`suggestion-item ${activeType === 'general' && activeIndex === index ? 'active' : ''}`}
                      role="option"
                      aria-selected={activeType === 'general' && activeIndex === index}
                      onClick={() => handleSelectSuggestion(suggestion.display, 'general')}
                    >
                      <span className="suggestion-text">{suggestion.display}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Staff suggestions column */}
              {suggestions.staff.length > 0 && (
                <div className="suggestions-column">
                  <div className="column-header">Faculty & Staff</div>
                  {suggestions.staff.map((staff, index) => (
                    <div
                      key={`staff-${index}`}
                      className={`suggestion-item staff-item ${activeType === 'staff' && activeIndex === index ? 'active' : ''}`}
                      role="option"
                      aria-selected={activeType === 'staff' && activeIndex === index}
                      onClick={() => handleSelectSuggestion(staff.title, 'staff', staff.url)}
                    >
                      <a href={staff.url} target="_blank" rel="noopener noreferrer" className="staff-link">
                        <div className="staff-suggestion">
                          {staff.image && (
                            <div className="staff-image">
                              <img src={staff.image} alt={staff.title} className="staff-thumbnail" loading="lazy" />
                            </div>
                          )}
                          <div className="staff-info">
                            <span className="suggestion-text">{staff.title}</span>
                            {staff.position && <span className="staff-role">{staff.position}</span>}
                            {staff.department && <span className="staff-department">{staff.department}</span>}
                          </div>
                        </div>
                      </a>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Program suggestions column */}
              {suggestions.programs.length > 0 && (
                <div className="suggestions-column">
                  <div className="column-header">Programs</div>
                  {suggestions.programs.map((program, index) => (
                    <div
                      key={`program-${index}`}
                      className={`suggestion-item program-item ${activeType === 'programs' && activeIndex === index ? 'active' : ''}`}
                      role="option"
                      aria-selected={activeType === 'programs' && activeIndex === index}
                      onClick={() => handleSelectSuggestion(program.title, 'program', program.url)}
                    >
                      <a href={program.url} target="_blank" rel="noopener noreferrer" className="program-link">
                        <div className="program-suggestion">
                          <span className="suggestion-text">{program.title}</span>
                          {program.details?.school && <span className="suggestion-type">{program.details.school}</span>}
                          {program.description && <span className="program-description">{program.description}</span>}
                        </div>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}