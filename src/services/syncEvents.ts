/**
 * A simple, lightweight Event Emitter for React Native.
 * Replaces the Node.js 'events' module which is not available in mobile runtimes.
 */
type Callback = (data?: any) => void;

class SyncEventEmitter {
  private listeners: Map<string, Set<Callback>> = new Map();

  constructor() {
    this.listeners.set('sync_completed', new Set());
    this.listeners.set('mutation_detected', new Set());
    this.listeners.set('conflict_detected', new Set());
  }

  /**
   * Subscribe to events
   */
  on(event: 'sync_completed' | 'mutation_detected' | 'conflict_detected', callback: Callback) {
    this.listeners.get(event)?.add(callback);
  }

  /**
   * Unsubscribe from events
   */
  off(event: 'sync_completed' | 'mutation_detected' | 'conflict_detected', callback: Callback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Broadcast that sync has finished
   */
  emitSyncCompleted() {
    this.listeners.get('sync_completed')?.forEach(callback => callback());
  }

  /**
   * Broadcast that local data has changed and needs sync
   */
  emitMutation() {
    this.listeners.get('mutation_detected')?.forEach(callback => callback());
  }

  /**
   * Broadcast a data conflict that requires user resolution
   */
  emitConflict(data: { collection: string, local: any, cloud: any }) {
    this.listeners.get('conflict_detected')?.forEach(callback => callback(data));
  }
}

export const syncEvents = new SyncEventEmitter();
