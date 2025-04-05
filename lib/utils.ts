/**
 * @fileoverview Utility functions
 * 
 * This module provides utility functions used throughout the application.
 *
 * @author Victor Chimenti
 * @version 1.1.0
 */

import SessionManager, { getSessionId } from './session-manager';

/**
 * Debounce a function call
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}

/**
 * Get session ID (using the centralized SessionManager)
 * @returns Session ID
 * @deprecated Use import { getSessionId } from './session-manager' directly
 */
export function getOrCreateSessionId(): string {
  return getSessionId();
}

/**
 * Extract result count from HTML response
 * @param html - HTML response from search
 * @returns Result count
 */
export function extractResultCount(html: string): number {
  try {
    const match = html.match(/totalMatching">([0-9,]+)</);
    if (match && match[1]) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
  } catch (error) {
    console.error('Error extracting result count:', error);
  }
  
  return 0;
}

/**
 * Create a function that executes only once
 * @param func - Function to execute once
 * @returns Function that executes only once
 */
export function once<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => ReturnType<T> {
  let result: ReturnType<T>;
  let called = false;
  
  return function(...args: Parameters<T>): ReturnType<T> {
    if (!called) {
      called = true;
      result = func(...args);
    }
    return result;
  };
}