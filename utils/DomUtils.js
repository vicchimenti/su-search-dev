/**
 * @fileoverview DomUtils - DOM manipulation utilities
 * 
 * This module provides utility functions for DOM manipulation,
 * element creation, and managing DOM attributes and properties.
 * 
 * Features:
 * - Element creation and attribute management
 * - Element querying and traversal
 * - DOM event handling
 * - CSS class manipulation
 * - Document fragment creation
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace DomUtils
 * @lastUpdated 2025-04-02
 */

/**
 * Create a new DOM element with attributes and properties
 * @param {string} tagName - HTML tag name
 * @param {Object} options - Element options
 * @param {string} [options.className] - CSS class name(s)
 * @param {string} [options.id] - Element ID
 * @param {string|Node} [options.textContent] - Text content
 * @param {string|Node} [options.innerHTML] - Inner HTML
 * @param {Object} [options.attributes] - HTML attributes
 * @param {Object} [options.dataset] - Dataset attributes
 * @param {Object} [options.style] - CSS styles
 * @param {Array<Node>} [options.children] - Child nodes
 * @returns {HTMLElement} The created element
 */
export function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    
    // Set class
    if (options.className) {
      if (Array.isArray(options.className)) {
        element.className = options.className.join(' ');
      } else {
        element.className = options.className;
      }
    }
    
    // Set ID
    if (options.id) {
      element.id = options.id;
    }
    
    // Set text content
    if (options.textContent !== undefined) {
      element.textContent = options.textContent;
    }
    
    // Set inner HTML
    if (options.innerHTML !== undefined) {
      element.innerHTML = options.innerHTML;
    }
    
    // Set attributes
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([name, value]) => {
        if (value !== null && value !== undefined) {
          element.setAttribute(name, value);
        }
      });
    }
    
    // Set dataset
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([name, value]) => {
        if (value !== null && value !== undefined) {
          element.dataset[name] = value;
        }
      });
    }
    
    // Set style
    if (options.style) {
      Object.entries(options.style).forEach(([prop, value]) => {
        if (value !== null && value !== undefined) {
          element.style[prop] = value;
        }
      });
    }
    
    // Add children
    if (options.children) {
      options.children.forEach(child => {
        if (child) {
          element.appendChild(child);
        }
      });
    }
    
    return element;
  }
  
  /**
   * Create a document fragment
   * @param {Array<Node>} [children] - Child nodes to add
   * @returns {DocumentFragment} The created fragment
   */
  export function createFragment(children = []) {
    const fragment = document.createDocumentFragment();
    
    children.forEach(child => {
      if (child) {
        fragment.appendChild(child);
      }
    });
    
    return fragment;
  }
  
  /**
   * Query an element by selector
   * @param {string} selector - CSS selector
   * @param {Element|Document} [context=document] - Context element
   * @returns {Element|null} The found element or null
   */
  export function query(selector, context = document) {
    return context.querySelector(selector);
  }
  
  /**
   * Query all elements matching selector
   * @param {string} selector - CSS selector
   * @param {Element|Document} [context=document] - Context element
   * @returns {Array<Element>} Array of matching elements
   */
  export function queryAll(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
  }
  
  /**
   * Find closest ancestor matching selector
   * @param {Element} element - Starting element
   * @param {string} selector - CSS selector
   * @returns {Element|null} Matching ancestor or null
   */
  export function closest(element, selector) {
    if (element.closest) {
      return element.closest(selector);
    }
    
    // Fallback for older browsers
    let current = element;
    
    while (current) {
      if (matches(current, selector)) {
        return current;
      }
      current = current.parentElement;
    }
    
    return null;
  }
  
  /**
   * Check if element matches selector
   * @param {Element} element - Element to check
   * @param {string} selector - CSS selector
   * @returns {boolean} Whether element matches selector
   */
  export function matches(element, selector) {
    const matchesMethod = element.matches || 
                          element.matchesSelector || 
                          element.msMatchesSelector || 
                          element.mozMatchesSelector || 
                          element.webkitMatchesSelector || 
                          element.oMatchesSelector;
    
    if (matchesMethod) {
      return matchesMethod.call(element, selector);
    }
    
    // Fallback
    const allElements = queryAll(selector, element.parentNode);
    return allElements.includes(element);
  }
  
  /**
   * Add event listener with options
   * @param {Element|Window|Document} element - Target element
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler
   * @param {Object|boolean} [options] - Event options
   * @returns {Function} Function to remove the listener
   */
  export function addEvent(element, eventType, handler, options) {
    element.addEventListener(eventType, handler, options);
    
    // Return function to remove the listener
    return () => {
      element.removeEventListener(eventType, handler, options);
    };
  }
  
  /**
   * Add multiple event listeners
   * @param {Element|Window|Document} element - Target element
   * @param {Object<string, Function>} events - Event map (type: handler)
   * @param {Object|boolean} [options] - Event options
   * @returns {Function} Function to remove all listeners
   */
  export function addEvents(element, events, options) {
    const removers = Object.entries(events).map(([type, handler]) => {
      return addEvent(element, type, handler, options);
    });
    
    // Return function to remove all listeners
    return () => {
      removers.forEach(remove => remove());
    };
  }
  
  /**
   * Add or remove class from element
   * @param {Element} element - Target element
   * @param {string} className - CSS class name
   * @param {boolean} [add=true] - Whether to add or remove
   * @returns {boolean} Whether class was added
   */
  export function toggleClass(element, className, add = true) {
    if (add) {
      element.classList.add(className);
      return true;
    } else {
      element.classList.remove(className);
      return false;
    }
  }
  
  /**
   * Check if element has class
   * @param {Element} element - Target element
   * @param {string} className - CSS class name
   * @returns {boolean} Whether element has class
   */
  export function hasClass(element, className) {
    return element.classList.contains(className);
  }
  
  /**
   * Set multiple attributes on element
   * @param {Element} element - Target element
   * @param {Object<string, string>} attributes - Attribute map (name: value)
   */
  export function setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([name, value]) => {
      if (value === null || value === undefined) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value);
      }
    });
  }
  
  /**
   * Set multiple dataset properties on element
   * @param {Element} element - Target element
   * @param {Object<string, string>} dataset - Dataset map (name: value)
   */
  export function setDataset(element, dataset) {
    Object.entries(dataset).forEach(([name, value]) => {
      if (value === null || value === undefined) {
        delete element.dataset[name];
      } else {
        element.dataset[name] = value;
      }
    });
  }
  
  /**
   * Set multiple styles on element
   * @param {Element} element - Target element
   * @param {Object<string, string>} styles - Style map (property: value)
   */
  export function setStyles(element, styles) {
    Object.entries(styles).forEach(([prop, value]) => {
      if (value === null || value === undefined) {
        element.style.removeProperty(prop);
      } else {
        element.style[prop] = value;
      }
    });
  }
  
  /**
   * Empty an element (remove all children)
   * @param {Element} element - Target element
   */
  export function empty(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }
  
  /**
   * Insert element after reference element
   * @param {Element} newElement - Element to insert
   * @param {Element} referenceElement - Reference element
   * @returns {Element} The inserted element
   */
  export function insertAfter(newElement, referenceElement) {
    referenceElement.parentNode.insertBefore(newElement, referenceElement.nextSibling);
    return newElement;
  }
  
  /**
   * Replace an element with another
   * @param {Element} oldElement - Element to replace
   * @param {Element} newElement - New element
   * @returns {Element} The new element
   */
  export function replace(oldElement, newElement) {
    oldElement.parentNode.replaceChild(newElement, oldElement);
    return newElement;
  }
  
  /**
   * Check if element is visible
   * @param {Element} element - Target element
   * @returns {boolean} Whether element is visible
   */
  export function isVisible(element) {
    return !!(
      element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length
    ) && window.getComputedStyle(element).visibility !== 'hidden';
  }
  
  /**
   * Find siblings of element
   * @param {Element} element - Target element
   * @param {string} [selector] - Filter selector
   * @returns {Array<Element>} Array of siblings
   */
  export function siblings(element, selector) {
    const siblings = [];
    let sibling = element.parentNode.firstChild;
    
    while (sibling) {
      if (sibling.nodeType === 1 && sibling !== element) {
        if (!selector || matches(sibling, selector)) {
          siblings.push(sibling);
        }
      }
      sibling = sibling.nextSibling;
    }
    
    return siblings;
  }
  
  /**
   * Get position of element relative to document
   * @param {Element} element - Target element
   * @returns {Object} Position object with top and left properties
   */
  export function getPosition(element) {
    const rect = element.getBoundingClientRect();
    
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    };
  }
  
  /**
   * Check if element is in viewport
   * @param {Element} element - Target element
   * @param {number} [threshold=0] - Threshold percentage (0-1)
   * @returns {boolean} Whether element is in viewport
   */
  export function isInViewport(element, threshold = 0) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    
    const thresholdPixelsY = windowHeight * threshold;
    const thresholdPixelsX = windowWidth * threshold;
    
    return (
      rect.top >= -thresholdPixelsY &&
      rect.left >= -thresholdPixelsX &&
      rect.bottom <= windowHeight + thresholdPixelsY &&
      rect.right <= windowWidth + thresholdPixelsX
    );
  }
  
  /**
   * Scroll element into view
   * @param {Element} element - Target element
   * @param {Object} [options] - Scroll options
   * @param {string} [options.block='start'] - Vertical alignment
   * @param {string} [options.behavior='smooth'] - Scroll behavior
   */
  export function scrollIntoView(element, options = {}) {
    const defaultOptions = {
      block: 'start',
      behavior: 'smooth'
    };
    
    const scrollOptions = { ...defaultOptions, ...options };
    
    if (element.scrollIntoView) {
      element.scrollIntoView(scrollOptions);
    } else {
      // Fallback for older browsers
      const rect = element.getBoundingClientRect();
      const targetTop = rect.top + window.scrollY;
      
      window.scrollTo({
        top: targetTop,
        behavior: scrollOptions.behavior
      });
    }
  }