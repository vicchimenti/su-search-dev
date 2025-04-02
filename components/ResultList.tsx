/**
 * @fileoverview Search results display
 * 
 * This component displays search results from the Funnelback backend,
 * with support for result tracking, pagination, and facet filtering.
 *
 * @author Victor Chimenti
 * @version 1.0.0
 */

import React, { useEffect, useRef } from 'react';

interface ResultsListProps {
  html: string;
  query: string;
  isLoading: boolean;
  error?: string;
  sessionId?: string;
  onResultClick?: (url: string, title: string, position: number) => void;
}

export default function ResultsList({
  html,
  query,
  isLoading,
  error,
  sessionId,
  onResultClick
}: ResultsListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Update container with HTML content
  useEffect(() => {
    if (containerRef.current && html) {
      containerRef.current.innerHTML = html;
      
      // Add click tracking to results
      attachClickHandlers();
    }
  }, [html]);
  
  // Attach click handlers to results
  const attachClickHandlers = () => {
    if (!containerRef.current || !onResultClick) return;
    
    // Find all result links
    const resultLinks = containerRef.current.querySelectorAll(
      '.fb-result h3 a, .search-result-item h3 a, .listing-item__title a'
    );
    
    resultLinks.forEach((link, index) => {
      link.addEventListener('click', function(e) {
        // Don't prevent default navigation
        const linkElement = e.currentTarget as HTMLAnchorElement;
        
        // Get link details
        const url = linkElement.getAttribute('data-live-url') || linkElement.getAttribute('href') || '';
        const title = linkElement.textContent?.trim() || '';
        
        // Track click
        onResultClick(url, title, index + 1);
      });
    });
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="results-loading">
        <div className="spinner"></div>
        <p>Loading search results...</p>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="results-error">
        <h3>Error Loading Results</h3>
        <p>{error}</p>
      </div>
    );
  }
  
  // Render empty state
  if (!html) {
    return (
      <div className="results-empty">
        <p>Enter a search query to see results.</p>
      </div>
    );
  }
  
  return (
    <div className="search-results-container">
      <div ref={containerRef} className="funnelback-search-container"></div>
    </div>
  );
}