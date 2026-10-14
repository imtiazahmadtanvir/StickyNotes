export type NoteColorId = 'yellow' | 'green' | 'pink' | 'purple' | 'blue' | 'gray' | 'charcoal';

export interface NoteColorConfig {
  id: NoteColorId;
  name: string;
  bgLight: string;
  headerLight: string;
  bgDark: string;
  headerDark: string;
  accent: string;
  border: string;
}

export const NOTE_COLORS: Record<NoteColorId, NoteColorConfig> = {
  yellow: {
    id: 'yellow',
    name: 'Butter Yellow',
    bgLight: '#fff9c4',
    headerLight: '#fff59d',
    bgDark: '#423d24',
    headerDark: '#524b2b',
    accent: '#fff275',
    border: '#f0e68c',
  },
  green: {
    id: 'green',
    name: 'Mint Green',
    bgLight: '#dcedc8',
    headerLight: '#c5e1a5',
    bgDark: '#233d28',
    headerDark: '#2e4d34',
    accent: '#a1ef9b',
    border: '#b5d792',
  },
  pink: {
    id: 'pink',
    name: 'Blush Pink',
    bgLight: '#f8bbd0',
    headerLight: '#f48fb1',
    bgDark: '#4a2533',
    headerDark: '#592e3f',
    accent: '#fbcfe8',
    border: '#e69ab4',
  },
  purple: {
    id: 'purple',
    name: 'Lilac Purple',
    bgLight: '#e1bee7',
    headerLight: '#ce93d8',
    bgDark: '#382547',
    headerDark: '#473059',
    accent: '#d8b4fe',
    border: '#c28bc9',
  },
  blue: {
    id: 'blue',
    name: 'Sky Blue',
    bgLight: '#b3e5fc',
    headerLight: '#81d4fa',
    bgDark: '#1c3647',
    headerDark: '#24455a',
    accent: '#93c5fd',
    border: '#74c2e8',
  },
  gray: {
    id: 'gray',
    name: 'Slate Gray',
    bgLight: '#e0e0e0',
    headerLight: '#bdbdbd',
    bgDark: '#333333',
    headerDark: '#424242',
    accent: '#e0e0e0',
    border: '#aeaeae',
  },
  charcoal: {
    id: 'charcoal',
    name: 'Obsidian Dark',
    bgLight: '#2d3238',
    headerLight: '#212529',
    bgDark: '#1e2023',
    headerDark: '#15171a',
    accent: '#52525b',
    border: '#3c4148',
  },
};

export interface Note {
  id: string;
  title: string;
  content: string;
  color: NoteColorId;
  isPinned: boolean;
  isArchived: boolean;
  isOpen: boolean;
  isMinimized: boolean;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zIndex: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncQueueItem {
  id: string;
  noteId: string;
  action: 'UPSERT' | 'DELETE';
  payload: Partial<Note>;
  timestamp: number;
  attempts: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingChangesCount: number;
  error?: string | null;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultColor: NoteColorId;
  fontSize: 'small' | 'medium' | 'large';
  autoSaveDelay: number;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  userId?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      openNoteWindow: (id: string) => void;
      closeNoteWindow: (id: string) => void;
      openHubWindow?: () => void;
      setAlwaysOnTop: (id: string, isPinned: boolean) => void;
      createNewNote: () => void;
      broadcastNoteChange: () => void;
      onNotesUpdated: (callback: () => void) => () => void;
    };
  }
}

