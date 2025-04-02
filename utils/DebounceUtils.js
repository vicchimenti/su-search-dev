/**
 * @fileoverview DebounceUtils - Input handling optimization utilities
 * 
 * This module provides utilities for optimizing input handling,
 * including debouncing and throttling functions.
 * 
 * Features:
 * - Debounce function execution
 * - Throttle function execution
 * - Immediate and trailing options
 * - Leading edge execution
 * - Context and arguments preservation
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace DebounceUtils
 * @lastUpdated 2025-04-02
 */

/**
 * Debounce a function to limit how often it can be called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.leading=false] - Execute on leading edge
 * @param {boolean} [options.trailing=true] - Execute on trailing edge
 * @returns {Function} Debounced function
 */
export function debounce(func, wait, options = {}) {
    let timeout;
    let result;
    let lastArgs = null;
    let lastThis = null;
    let lastCallTime = 0;
    let lastInvokeTime = 0;
    
    const leading = options.leading === true;
    const trailing = options.trailing !== false;
    
    // Convert to milliseconds for consistency
    wait = Number(wait) || 0;
    
    function invokeFunc() {
      const args = lastArgs;
      const thisArg = lastThis;
      
      lastArgs = lastThis = null;
      lastInvokeTime = Date.now();
      
      result = func.apply(thisArg, args);
      return result;
    }
    
    function leadingEdge() {
      lastInvokeTime = Date.now();
      // Set timeout for trailing edge
      timeout = setTimeout(timerExpired, wait);
      // Invoke function at leading edge if requested
      return leading ? invokeFunc() : result;
    }
    
    function remainingWait(time) {
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;
      const timeWaiting = wait - timeSinceLastCall;
      
      return trailing ? Math.min(timeWaiting, wait - timeSinceLastInvoke) : timeWaiting;
    }
    
    function shouldInvoke(time) {
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;
      
      // First call, last call happened more than wait time ago, or
      // system time changed (e.g. laptop went to sleep)
      return (
        lastCallTime === 0 ||
        timeSinceLastCall >= wait ||
        timeSinceLastCall < 0 ||
        timeSinceLastInvoke >= wait
      );
    }
    
    function timerExpired() {
      const time = Date.now();
      
      if (shouldInvoke(time)) {
        return trailingEdge();
      }
      
      // Restart timer for remaining time
      timeout = setTimeout(timerExpired, remainingWait(time));
    }
    
    function trailingEdge() {
      timeout = undefined;
      
      // Only invoke if there have been calls since the last invocation
      if (trailing && lastArgs) {
        return invokeFunc();
      }
      
      lastArgs = lastThis = null;
      return result;
    }
    
    function cancel() {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      
      lastInvokeTime = 0;
      lastArgs = lastCallTime = lastThis = timeout = undefined;
    }
    
    function flush() {
      return timeout === undefined ? result : trailingEdge();
    }
    
    function debounced(...args) {
      const time = Date.now();
      const isInvoking = shouldInvoke(time);
      
      lastArgs = args;
      lastThis = this;
      lastCallTime = time;
      
      if (isInvoking) {
        if (timeout === undefined) {
          return leadingEdge();
        }
        
        // Handle multiple calls in quick succession
        if (leading) {
          // Reset timeout to ensure trailing edge is triggered
          clearTimeout(timeout);
          timeout = setTimeout(timerExpired, wait);
          return invokeFunc();
        }
      }
      
      if (timeout === undefined) {
        timeout = setTimeout(timerExpired, wait);
      }
      
      return result;
    }
    
    // Attach methods to debounced function
    debounced.cancel = cancel;
    debounced.flush = flush;
    
    return debounced;
  }
  
  /**
   * Throttle a function to limit how often it can be called
   * @param {Function} func - Function to throttle
   * @param {number} wait - Wait time in milliseconds
   * @param {Object} [options] - Configuration options
   * @param {boolean} [options.leading=true] - Execute on leading edge
   * @param {boolean} [options.trailing=true] - Execute on trailing edge
   * @returns {Function} Throttled function
   */
  export function throttle(func, wait, options = {}) {
    // Throttle is just a debounce with different defaults
    return debounce(func, wait, {
      leading: options.leading !== false,
      trailing: options.trailing !== false
    });
  }
  
  /**
   * Create a function that only executes once
   * @param {Function} func - Function to execute once
   * @returns {Function} Function that will only execute the first time it's called
   */
  export function once(func) {
    let result;
    let called = false;
    
    return function(...args) {
      if (!called) {
        called = true;
        result = func.apply(this, args);
      }
      
      return result;
    };
  }
  
  /**
   * Delay execution of a function
   * @param {Function} func - Function to delay
   * @param {number} wait - Wait time in milliseconds
   * @param {...*} args - Arguments to pass to function
   * @returns {number} Timeout ID
   */
  export function delay(func, wait, ...args) {
    return setTimeout(() => func(...args), wait);
  }
  
  /**
   * Create a function that executes after a number of calls
   * @param {number} count - Number of calls before execution
   * @param {Function} func - Function to execute
   * @returns {Function} Function that executes after count calls
   */
  export function after(count, func) {
    let counter = count;
    
    return function(...args) {
      if (--counter < 1) {
        return func.apply(this, args);
      }
    };
  }
  
  /**
   * Create a function that executes before a number of calls
   * @param {number} count - Number of calls before function stops executing
   * @param {Function} func - Function to execute
   * @returns {Function} Function that executes before count calls
   */
  export function before(count, func) {
    let counter = count;
    let result;
    
    return function(...args) {
      if (--counter >= 0) {
        result = func.apply(this, args);
      }
      
      if (counter < 1) {
        func = undefined;
      }
      
      return result;
    };
  }