'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Minus,
  X,
  Settings,
  Search,
  Trash2,
  User,
  LogOut,
  Cloud,
} from 'lucide-react';
import { Note, NOTE_COLORS, NoteColorId, AppSettings } from '@/types';
import { localDb } from '@/lib/storage';
import { syncManager } from '@/lib/sync';
import { authService, AuthUser } from '@/lib/auth';
import { SettingsModal } from './SettingsModal';
import { AuthModal } from './AuthModal';


interface WindowsHubViewProps {
  onOpenNote?: (id: string) => void;
}

export const WindowsHubView: React.FC<WindowsHubViewProps> = ({ onOpenNote }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(localDb.getSettings());
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Authentication state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const loadNotes = () => {
    setNotes(localDb.getAllNotes());
    setSettings(localDb.getSettings());
  };

  useEffect(() => {
    loadNotes();

    // Subscribe to authentication changes (Guest vs Signed In)
    const unsubscribeAuth = authService.subscribe((u) => {
      setCurrentUser(u);
      loadNotes();
    });

    // Background Supabase delta sync
    syncManager.startPeriodicSync(15000);
    syncManager.syncNow();

    const handleStorageUpdate = () => loadNotes();
    window.addEventListener('stickynotes:updated', handleStorageUpdate);

    let unsubscribeElectron: (() => void) | undefined;
    if (window.electronAPI?.onNotesUpdated) {
      unsubscribeElectron = window.electronAPI.onNotesUpdated(() => {
        loadNotes();
      });
    }

    let unsubscribeBounds: (() => void) | undefined;
    if (window.electronAPI?.onWindowBoundsUpdated) {
      unsubscribeBounds = window.electronAPI.onWindowBoundsUpdated((data) => {
        const cur = localDb.getNoteById(data.id);
        if (cur && (cur.width !== data.width || cur.height !== data.height || cur.positionX !== data.positionX || cur.positionY !== data.positionY)) {
          localDb.saveNote({
            ...cur,
            width: data.width,
            height: data.height,
            positionX: data.positionX,
            positionY: data.positionY,
          });
        }
      });
    }

    return () => {
      unsubscribeAuth();
      syncManager.stopPeriodicSync();
      window.removeEventListener('stickynotes:updated', handleStorageUpdate);
      if (unsubscribeElectron) unsubscribeElectron();
      if (unsubscribeBounds) unsubscribeBounds();
    };
  }, []);

  // Format date matching Screenshot 2: '8:48 PM' if today, else 'Oct 9', 'Oct 8'
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const stripHtml = (html: string) => {
    const formatted = html
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<div[^>]*>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<br\s*[\/]?>/gi, '\n');
    const tmp = document.createElement('DIV');
    tmp.innerHTML = formatted;
    return (tmp.textContent || tmp.innerText || '').trim();
  };

  // Extract first image in note if present (for card thumbnail preview like Screenshot 2)
  const extractFirstImage = (html: string): string | null => {
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : null;
  };

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const plain = stripHtml(note.content).toLowerCase();
        return (note.title && note.title.toLowerCase().includes(q)) || plain.includes(q);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [notes, searchQuery]);

  // Open Note Window with remembered size & position
  const handleCardClick = (id: string) => {
    const target = notes.find((n) => n.id === id) || localDb.getNoteById(id);
    const opts = target
      ? {
          width: target.width || 320,
          height: target.height || 340,
          x: target.positionX,
          y: target.positionY,
          isPinned: target.isPinned,
        }
      : undefined;

    if (window.electronAPI?.openNoteWindow) {
      window.electronAPI.openNoteWindow(id, opts);
    } else if (onOpenNote) {
      onOpenNote(id);
    } else {
      const w = target?.width || 340;
      const h = target?.height || 360;
      window.open(`/note?id=${encodeURIComponent(id)}`, `note_${id}`, `width=${w},height=${h},menubar=no,toolbar=no,location=no`);
    }
  };

  // Create New Note
  const handleNewNote = () => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: '',
      content: '',
      color: settings.defaultColor || 'yellow',
      isPinned: false,
      isArchived: false,
      isOpen: true,
      isMinimized: false,
      positionX: 160,
      positionY: 160,
      width: 320,
      height: 340,
      zIndex: 10,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    localDb.saveNote(newNote);
    loadNotes();
    handleCardClick(newNote.id);
  };

  // Delete Note
  const handleDelete = (id: string) => {
    localDb.softDeleteNote(id);
    if (window.electronAPI?.closeNoteWindow) {
      window.electronAPI.closeNoteWindow(id);
    }
    loadNotes();
    setNoteToDelete(null);
  };

  // Automatically show latest notes on app startup
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    hasAutoOpenedRef.current = true;

    const timer = setTimeout(() => {
      const all = localDb.getAllNotes().filter((n) => !n.deletedAt);
      if (all.length === 0) {
        handleNewNote();
        return;
      }

      const openNotes = all.filter((n) => n.isOpen);
      if (openNotes.length > 0) {
        // Open any notes that were left open, ordered so newest note gains top focus
        const sortedOpen = [...openNotes].sort(
          (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        );
        sortedOpen.forEach((n) => {
          handleCardClick(n.id);
        });
      } else {
        // If all notes were closed, automatically show the latest note
        const sorted = [...all].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        if (sorted[0]) {
          handleCardClick(sorted[0].id);
        }
      }
    }, 120);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="windows-hub-container">
      {/* Top Header Bar (Matching Screenshot 2) */}
      <div className="hub-top-bar">
        <button
          className="hub-icon-btn"
          title="New note (Ctrl+N)"
          onClick={handleNewNote}
        >
          <Plus size={20} strokeWidth={2} />
        </button>

        <div className="hub-top-right-actions">
          {/* Account Widget (Default / Guest vs Signed In) */}
          {currentUser ? (
            <div className="hub-user-menu-container">
              <button
                className="hub-avatar-btn"
                title={`Signed in as ${currentUser.email}`}
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <span>{currentUser.name ? currentUser.name[0].toUpperCase() : currentUser.email[0].toUpperCase()}</span>
              </button>

              {showUserMenu && (
                <div className="hub-user-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="hub-user-info">
                    <div className="hub-user-avatar-large">
                      {currentUser.name ? currentUser.name[0].toUpperCase() : currentUser.email[0].toUpperCase()}
                    </div>
                    <div className="hub-user-text">
                      <strong>{currentUser.name || 'Sticky Notes User'}</strong>
                      <span>{currentUser.email}</span>
                    </div>
                  </div>
                  <div className="hub-user-sync-status">
                    <Cloud size={13} />
                    <span>Cloud Sync Active (PostgreSQL)</span>
                  </div>
                  <div className="ms-dropdown-divider" />
                  <button
                    className="hub-signout-btn"
                    onClick={() => {
                      setShowUserMenu(false);
                      authService.logout();
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out (Use as Default)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="hub-auth-pill-btn"
              title="Sign in to sync notes across devices"
              onClick={() => {
                setAuthMode('signin');
                setIsAuthOpen(true);
              }}
            >
              <User size={13} />
              <span>Sign in</span>
            </button>
          )}

          <button
            className="hub-icon-btn"
            title="Settings"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={18} strokeWidth={1.8} />
          </button>
          <button
            className="hub-icon-btn"
            title="Minimize"
            onClick={() => {
              if (window.electronAPI?.minimizeWindow) {
                window.electronAPI.minimizeWindow();
              }
            }}
          >
            <Minus size={16} strokeWidth={1.8} />
          </button>
          <button
            className="hub-icon-btn close-btn"
            title="Close"
            onClick={() => {
              if (window.electronAPI?.closeWindow) {
                window.electronAPI.closeWindow();
              } else if (typeof window !== 'undefined') {
                window.close();
              }
            }}
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Main Title (Matching Screenshot 2 & App Logo) */}
      <div className="hub-title-section" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img
          src="/app-logo.png"
          alt="Sticky Notes"
          style={{
            width: '28px',
            height: '28px',
            objectFit: 'contain',
            borderRadius: '7px',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
            flexShrink: 0,
          }}
        />
        <h1 className="hub-main-title" style={{ margin: 0 }}>Sticky Notes</h1>
      </div>

      {/* Search Input Box */}
      <div className="hub-search-section">
        <div className="hub-search-bar">
          <input
            type="text"
            className="hub-search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={16} className="hub-search-icon" />
        </div>
      </div>

      {/* Notes Cards List (Matching Screenshot 2) */}
      <div className="hub-cards-scroll">
        {filteredNotes.length === 0 ? (
          <div className="hub-empty-state">
            <p style={{ fontSize: '13px', color: '#888' }}>
              {searchQuery ? 'No notes matched your search.' : 'No notes yet. Click + to create one!'}
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const colorCfg = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
            const plainText = stripHtml(note.content);
            const cardImage = extractFirstImage(note.content);

            return (
              <div
                key={note.id}
                className="hub-card-item"
                style={{ backgroundColor: colorCfg.bgLight }}
                onClick={() => handleCardClick(note.id)}
              >
                {/* Date on top right */}
                <div className="hub-card-header">
                  <span className="hub-card-date">{formatDate(note.updatedAt)}</span>
                  <button
                    className="hub-card-delete-btn"
                    title="Delete Note"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNoteToDelete(note.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Card Body */}
                <div className="hub-card-body">
                  {note.title && (
                    <div className="hub-card-title-preview">{note.title}</div>
                  )}

                  {/* Image Thumbnail Preview (like Screenshot 2) */}
                  {cardImage && (
                    <div style={{ margin: '4px 0', maxHeight: '110px', overflow: 'hidden', borderRadius: '3px' }}>
                      <img
                        src={cardImage}
                        alt="thumbnail"
                        style={{ width: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  )}

                  <div className="hub-card-text-preview">
                    {plainText || (cardImage ? '' : <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Take a note...</span>)}
                  </div>
                </div>

                {/* Folded Dog-Ear Corner */}
                <div className="hub-dog-ear" />
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {noteToDelete && (
        <div className="modal-overlay" onClick={() => setNoteToDelete(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Delete this note?</h3>
            <p style={{ fontSize: '12px', color: '#666' }}>
              Are you sure you want to delete this note?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="format-btn"
                style={{ width: 'auto', padding: '6px 12px', border: '1px solid #ccc' }}
                onClick={() => setNoteToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ backgroundColor: '#ef4444' }}
                onClick={() => handleDelete(noteToDelete)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSettings={(newSettings) => {
          const updated = localDb.saveSettings(newSettings);
          setSettings(updated);
        }}
        onExportNotes={() => {
          const allNotes = localDb.getAllNotes(true);
          const blob = new Blob([JSON.stringify(allNotes, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `sticky-notes-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
        }}
        onImportNotes={(content) => {
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              parsed.forEach((n) => localDb.saveNote(n));
              loadNotes();
            }
          } catch {
            alert('Failed to parse notes');
          }
        }}
        notesCount={notes.length}
        onOpenAuth={(mode) => {
          setAuthMode(mode);
          setIsAuthOpen(true);
        }}
      />

      {/* Sign In / Sign Up / Guest Mode Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onSuccess={() => {
          loadNotes();
        }}
      />
    </div>
  );
};
