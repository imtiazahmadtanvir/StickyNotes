import { Note, SyncQueueItem, AppSettings } from '@/types';

const STORAGE_KEYS = {
  NOTES: 'sticky_notes_local_db',
  SYNC_QUEUE: 'sticky_notes_sync_queue',
  SETTINGS: 'sticky_notes_settings',
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  defaultColor: 'yellow',
  fontSize: 'medium',
  autoSaveDelay: 300,
};

// No dummy seed notes - starts clean like native Windows Sticky Notes
const SEED_NOTES: Note[] = [];

class LocalDatabase {
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  // --- NOTES CRUD ---

  public getAllNotes(includeDeleted = false): Note[] {
    if (!this.isBrowser()) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.NOTES);
      if (!raw) {
        return [];
      }
      const notes: Note[] = JSON.parse(raw);
      // Filter out any legacy dummy seed notes
      const cleaned = notes.filter((n) => !n.id.startsWith('note-welcome-') && !n.id.startsWith('note-roadmap-') && !n.id.startsWith('note-todo-'));
      if (cleaned.length !== notes.length) {
        this.saveNotes(cleaned);
      }
      if (includeDeleted) return cleaned;
      return cleaned.filter((n) => !n.deletedAt);
    } catch (e) {
      console.error('Failed to read notes from storage:', e);
      return [];
    }
  }

  public getNoteById(id: string): Note | null {
    const notes = this.getAllNotes(true);
    return notes.find((n) => n.id === id) || null;
  }

  public saveNote(note: Note): void {
    const notes = this.getAllNotes(true);
    const index = notes.findIndex((n) => n.id === note.id);

    const updatedNote: Note = {
      ...note,
      updatedAt: new Date().toISOString(),
      revision: (note.revision || 1) + 1,
    };

    if (index >= 0) {
      notes[index] = updatedNote;
    } else {
      notes.push(updatedNote);
    }

    this.saveNotes(notes);
    this.enqueueSync(updatedNote.id, 'UPSERT', updatedNote);
  }

  public softDeleteNote(id: string): void {
    const notes = this.getAllNotes(true);
    const index = notes.findIndex((n) => n.id === id);
    if (index >= 0) {
      notes[index].deletedAt = new Date().toISOString();
      notes[index].isOpen = false;
      this.saveNotes(notes);
      this.enqueueSync(id, 'DELETE', { id, deletedAt: notes[index].deletedAt });
    }
  }

  public hardDeleteNote(id: string): void {
    const notes = this.getAllNotes(true);
    const filtered = notes.filter((n) => n.id !== id);
    this.saveNotes(filtered);
    this.enqueueSync(id, 'DELETE', { id });
  }

  public clearAllNotes(): void {
    if (!this.isBrowser()) return;
    localStorage.removeItem(STORAGE_KEYS.NOTES);
    localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
    window.dispatchEvent(new CustomEvent('stickynotes:updated', { detail: { notes: [] } }));
  }

  public restoreNote(id: string): void {
    const notes = this.getAllNotes(true);
    const note = notes.find((n) => n.id === id);
    if (note) {
      note.deletedAt = null;
      note.isOpen = true;
      note.updatedAt = new Date().toISOString();
      this.saveNotes(notes);
      this.enqueueSync(id, 'UPSERT', note);
    }
  }

  public saveNotes(notes: Note[]): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
      window.dispatchEvent(new CustomEvent('stickynotes:updated', { detail: { notes } }));
    } catch (e) {
      console.error('Failed to write notes to storage:', e);
    }
  }

  // --- SYNC QUEUE ---

  public getSyncQueue(): SyncQueueItem[] {
    if (!this.isBrowser()) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public enqueueSync(noteId: string, action: 'UPSERT' | 'DELETE', payload: Partial<Note>): void {
    if (!this.isBrowser()) return;
    const queue = this.getSyncQueue();
    const filtered = queue.filter((item) => item.noteId !== noteId);
    filtered.push({
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      noteId,
      action,
      payload,
      timestamp: Date.now(),
      attempts: 0,
    });
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(filtered));
  }

  public dequeueSync(itemIds: string[]): void {
    if (!this.isBrowser()) return;
    const queue = this.getSyncQueue();
    const remaining = queue.filter((item) => !itemIds.includes(item.id));
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(remaining));
  }

  // --- SETTINGS ---

  public getSettings(): AppSettings {
    if (!this.isBrowser()) return DEFAULT_SETTINGS;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    }
    return updated;
  }
}

export const localDb = new LocalDatabase();
