'use client';

import { localDb } from './storage';
import { syncManager } from './sync';
import { Note } from '@/types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

const AUTH_STORAGE_KEY = 'sticky_notes_auth_user';

type AuthListener = (user: AuthUser | null) => void;

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: Set<AuthListener> = new Set();
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    if (this.isInitialized) return;
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch {
      this.currentUser = null;
    }
    this.isInitialized = true;

    // Listen across multi-windows / tabs in Electron or browser
    window.addEventListener('storage', (e) => {
      if (e.key === AUTH_STORAGE_KEY) {
        try {
          this.currentUser = e.newValue ? JSON.parse(e.newValue) : null;
          this.notify();
        } catch {}
      }
    });

    window.addEventListener('stickynotes:auth_changed', () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        this.currentUser = stored ? JSON.parse(stored) : null;
        this.notify();
      } catch {}
    });
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.currentUser));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('stickynotes:auth_updated'));
    }
  }

  public getCurrentUser(): AuthUser | null {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.init();
    }
    return this.currentUser;
  }

  public isGuest(): boolean {
    return this.getCurrentUser() === null;
  }

  public getUserId(): string {
    const user = this.getCurrentUser();
    return user ? user.id : 'default-user';
  }

  public async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: AuthUser }> {
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to sign in.' };
      }

      const user: AuthUser = data.user;
      this.setCurrentUser(user);

      // Automatically migrate local/default notes to this user account
      await this.migrateLocalNotes(user.id);

      return { success: true, user };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message || 'Network error occurred.',
      };
    }
  }

  public async signup(
    email: string,
    password: string,
    name?: string
  ): Promise<{ success: boolean; error?: string; user?: AuthUser }> {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create account.' };
      }

      const user: AuthUser = data.user;
      this.setCurrentUser(user);

      // Automatically migrate local/default notes to this user account
      await this.migrateLocalNotes(user.id);

      return { success: true, user };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message || 'Network error occurred.',
      };
    }
  }

  public logout(): void {
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.dispatchEvent(new Event('stickynotes:auth_changed'));
    }
    this.notify();
  }

  private setCurrentUser(user: AuthUser) {
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      window.dispatchEvent(new Event('stickynotes:auth_changed'));
    }
    this.notify();
  }

  private async migrateLocalNotes(userId: string): Promise<void> {
    try {
      const localNotes = localDb.getAllNotes(false);
      const res = await fetch('/api/auth/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, localNotes }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.notes && Array.isArray(data.notes)) {
          // Merge remote notes with local notes cleanly
          const noteMap = new Map<string, Note>();
          localNotes.forEach((n) => noteMap.set(n.id, n));

          data.notes.forEach((remote: Partial<Note> & { id: string }) => {
            const existing = noteMap.get(remote.id);
            if (!existing || new Date(remote.updatedAt || '').getTime() >= new Date(existing.updatedAt).getTime()) {
              noteMap.set(remote.id, {
                id: remote.id,
                title: remote.title || '',
                content: remote.content || '',
                color: remote.color || 'yellow',
                isPinned: !!remote.isPinned,
                isArchived: !!remote.isArchived,
                isOpen: existing?.isOpen ?? true,
                isMinimized: existing?.isMinimized ?? false,
                positionX: remote.positionX ?? 100,
                positionY: remote.positionY ?? 100,
                width: remote.width ?? 320,
                height: remote.height ?? 340,
                zIndex: existing?.zIndex ?? 10,
                revision: remote.revision ?? 1,
                createdAt: remote.createdAt ? new Date(remote.createdAt).toISOString() : new Date().toISOString(),
                updatedAt: remote.updatedAt ? new Date(remote.updatedAt).toISOString() : new Date().toISOString(),
                deletedAt: remote.deletedAt ? new Date(remote.deletedAt).toISOString() : null,
              });
            }
          });

          localDb.saveNotes(Array.from(noteMap.values()));
        }
      }

      // Trigger delta sync right away
      syncManager.syncNow();
    } catch (e) {
      console.warn('Note migration failed or will retry on next sync:', e);
    }
  }
}

export const authService = new AuthService();
