import { syncEvents } from './syncEvents';
import { logger } from '../utils/logger';

export type EntityType = 'TRANSACTION' | 'CATEGORY' | 'ACCOUNT' | 'BUDGET' | 'GOAL' | 'RECURRING' | 'SETTINGS';
export type Operation = 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC';

export interface SyncTask {
  id: string;
  type: EntityType;
  operation: Operation;
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
}

class SyncQueueService {
  private queue: SyncTask[] = [];

  /**
   * ENQUEUE A NEW TASK
   * This is called by the Change Engine after every local update.
   */
  async enqueue(type: EntityType, operation: Operation, payload: any) {
    const task: SyncTask = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      operation,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    logger.sync(`[QUEUE]: Enqueueing ${operation} for ${type}`);
    this.queue.push(task);
    
    // Broadcast mutation to trigger the Background Processor (SyncEngine)
    syncEvents.emitMutation();
    return task;
  }

  /**
   * GET PENDING TASKS
   */
  getPendingTasks(): SyncTask[] {
    return this.queue.filter(t => t.status === 'pending' || t.status === 'failed');
  }

  /**
   * MARK AS SYNCING
   */
  markSyncing(taskIds: string[]) {
    this.queue = this.queue.map(t => 
      taskIds.includes(t.id) ? { ...t, status: 'syncing' } : t
    );
  }

  /**
   * MARK AS SUCCESS
   */
  markSynced(taskIds: string[]) {
    // We remove synced tasks from memory, they are persisted in cloud and local DB anyway
    this.queue = this.queue.filter(t => !taskIds.includes(t.id));
    logger.sync(`[QUEUE]: Cleared ${taskIds.length} synced tasks.`);
  }

  /**
   * MARK AS FAILED (with retry logic)
   */
  markFailed(taskIds: string[]) {
    this.queue = this.queue.map(t => {
      if (taskIds.includes(t.id)) {
        return { 
          ...t, 
          status: 'failed', 
          retryCount: t.retryCount + 1,
          timestamp: Date.now() // Update timestamp for backoff
        };
      }
      return t;
    });
  }
}

export const syncQueueService = new SyncQueueService();
