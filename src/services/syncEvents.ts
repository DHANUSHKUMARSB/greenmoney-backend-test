/**
 * A simple, lightweight Event Emitter for React Native.
 * Replaces the Node.js 'events' module which is not available in mobile runtimes.
 */
type Callback = () => void;

class SyncEventEmitter {
  private listeners: Set<Callback> = new Set();

  /**
   * Subscribe to sync completion events
   */
  on(event: 'sync_completed', callback: Callback) {
    this.listeners.add(callback);
  }

  /**
   * Unsubscribe from sync completion events
   */
  off(event: 'sync_completed', callback: Callback) {
    this.listeners.delete(callback);
  }

  /**
   * Broadcast that sync has finished
   */
  emitSyncCompleted() {
    console.log('SyncEventEmitter: Broadcasting sync_completed to all screens...');
    this.listeners.forEach((callback) => {
      try {
        callback();
      } catch (err) {
        console.error('SyncEventEmitter: Listener error:', err);
      }
    });
  }
}

export const syncEvents = new SyncEventEmitter();
