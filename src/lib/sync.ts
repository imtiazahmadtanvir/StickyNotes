import { localDb } from './storage';
import { SyncStatus } from '@/types';

type SyncListener = (status: SyncStatus) => void;

class SyncManager {
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastSyncedAt: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  public getStatus(): SyncStatus {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const queue = localDb.getSyncQueue();
    return {
      isOnline,
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      pendingChangesCount: queue.length,
    };
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach((fn) => fn(status));
  }

  private handleNetworkChange(): void {
    this.notify();
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.syncNow();
    }
  }

  public startPeriodicSync(intervalMs = 15000): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.syncNow();
    }, intervalMs);
  }

  public stopPeriodicSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public async syncNow(): Promise<void> {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notify();
      return;
    }

    const queue = localDb.getSyncQueue();
    if (queue.length === 0) {
      this.notify();
      return;
    }

    this.isSyncing = true;
    this.notify();

    try {
      const storedAuth = typeof localStorage !== 'undefined' ? localStorage.getItem('sticky_notes_auth_user') : null;
      let userId = 'default-user';
      if (storedAuth) {
        try {
          const user = JSON.parse(storedAuth);
          if (user && user.id) userId = user.id;
        } catch {}
      }

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: queue, userId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.syncedOperationIds && data.syncedOperationIds.length > 0) {
          localDb.dequeueSync(data.syncedOperationIds);
          this.lastSyncedAt = new Date().toLocaleTimeString();
        }
      }
    } catch (e) {
      console.warn('Sync attempt failed, will retry next interval:', e);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const syncManager = new SyncManager();
