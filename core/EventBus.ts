/**
 * @fileoverview EventBus - Decoupled Component Communication
 * 
 * This module provides a simple event bus implementation for decoupling
 * components in the search application. Components can publish and subscribe
 * to events without direct dependencies on each other.
 * 
 * Features:
 * - Event subscription and publication
 * - Event unsubscription
 * - Support for namespaced events
 * - Once-only event handlers
 * - Debugging support
 * 
 * @author Victor Chimenti
 * @version 1.0.0
 * @namespace EventBus
 * @LastUpdated 2025-04-02
 */

// Type for event handler function
export type EventHandler = (data?: any) => void;

// Type for wildcard event handler function
export type WildcardEventHandler = (event: string, data?: any) => void;

/**
 * EventBus - Simple pub/sub implementation
 */
export class EventBus {
  private static instance: EventBus;
  private handlers: Map<string, (EventHandler | WildcardEventHandler)[]>;
  private debugMode: boolean;
  
  /**
   * Create a new EventBus instance (private constructor for singleton)
   */
  private constructor() {
    // Initialize handlers map
    this.handlers = new Map();
    this.debugMode = false;
  }
  
  /**
   * Get the singleton instance
   * @returns EventBus instance
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  /**
   * Enable debug mode to log events
   * @param enabled - Whether debug mode is enabled
   */
  public setDebugMode(enabled = true): void {
    this.debugMode = enabled;
  }
  
  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  public on(event: string, handler: EventHandler | WildcardEventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    
    const handlers = this.handlers.get(event)!;
    handlers.push(handler);
    
    // Return unsubscribe function
    return () => this.off(event, handler);
  }
  
  /**
   * Subscribe to an event for one-time execution
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  public once(event: string, handler: EventHandler): () => void {
    const onceHandler: EventHandler = (data?: any) => {
      this.off(event, onceHandler);
      handler(data);
    };
    
    return this.on(event, onceHandler);
  }
  
  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param handler - Event handler to remove
   */
  public off(event: string, handler: EventHandler | WildcardEventHandler): void {
    if (!this.handlers.has(event)) {
      return;
    }
    
    const handlers = this.handlers.get(event)!;
    const index = handlers.indexOf(handler);
    
    if (index !== -1) {
      handlers.splice(index, 1);
      
      // Clean up empty handler arrays
      if (handlers.length === 0) {
        this.handlers.delete(event);
      }
    }
  }
  
  /**
   * Publish an event with data
   * @param event - Event name
   * @param data - Event data
   */
  public emit(event: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[EventBus] Emit: ${event}`, data);
    }
    
    // Direct handlers
    if (this.handlers.has(event)) {
      const handlers = this.handlers.get(event)!;
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for '${event}':`, error);
        }
      });
    }
    
    // Handle namespaced events - events that match the pattern event:*
    const wildcardEvent = event.split(':')[0] + ':*';
    if (this.handlers.has(wildcardEvent)) {
      const handlers = this.handlers.get(wildcardEvent)!;
      handlers.forEach(handler => {
        try {
          (handler as WildcardEventHandler)(event, data);
        } catch (error) {
          console.error(`Error in wildcard event handler for '${wildcardEvent}':`, error);
        }
      });
    }
    
    // Handle global wildcards - subscribe to all events
    if (this.handlers.has('*')) {
      const handlers = this.handlers.get('*')!;
      handlers.forEach(handler => {
        try {
          (handler as WildcardEventHandler)(event, data);
        } catch (error) {
          console.error(`Error in global wildcard handler for '*':`, error);
        }
      });
    }
  }
  
  /**
   * Remove all handlers for a specific event
   * @param event - Event name
   */
  public clearEvent(event: string): void {
    this.handlers.delete(event);
  }
  
  /**
   * Remove all event handlers
   */
  public clear(): void {
    this.handlers.clear();
  }
  
  /**
   * Get all registered events
   * @returns Array of event names
   */
  public getEvents(): string[] {
    return Array.from(this.handlers.keys());
  }
  
  /**
   * Check if an event has handlers
   * @param event - Event name
   * @returns Whether the event has handlers
   */
  public hasHandlers(event: string): boolean {
    return this.handlers.has(event) && this.handlers.get(event)!.length > 0;
  }
}

// Export the class (we don't export a singleton instance directly to ensure proper initialization)
export default EventBus;