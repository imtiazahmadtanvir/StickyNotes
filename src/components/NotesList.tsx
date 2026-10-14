'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  Search,
  Pin,
  Trash2,
  ExternalLink,
  StickyNote,
  SlidersHorizontal,
  FolderArchive,
  RefreshCw,
} from 'lucide-react';
import { Note, NOTE_COLORS, NoteColorId } from '@/types';

interface NotesListProps {
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  onOpenNote: (id: string) => void;
  onNewNote: () => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
  onSyncNow?: () => void;
  isSyncing?: boolean;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes,
  isOpen,
  onClose,
  onOpenNote,
  onNewNote,
  onDeleteNote,
  onTogglePin,
  onSyncNow,
  isSyncing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColorFilter, setSelectedColorFilter] = useState<NoteColorId | 'all'>('all');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Position state for the Notes List Hub window
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({
    x: 0,
    y: 0,
    posX: 50,
    posY: 50,
  });

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      setPosition({
        x: Math.max(0, dragStartRef.current.posX + deltaX),
        y: Math.max(0, dragStartRef.current.posY + deltaY),
      });
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  // Strip HTML tags for clean card preview
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // Filter notes by search query and color
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        if (selectedColorFilter !== 'all' && note.color !== selectedColorFilter) {
          return false;
        }
        if (!searchQuery.trim()) return true;

        const q = searchQuery.toLowerCase();
        const plainContent = stripHtml(note.content).toLowerCase();
        const titleMatch = note.title.toLowerCase().includes(q);
        const contentMatch = plainContent.includes(q);
        return titleMatch || contentMatch;
      })
      .sort((a, b) => {
        // Pinned notes appear first
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [notes, searchQuery, selectedColorFilter]);

  if (!isOpen) return null;

  return (
    <div
      className="notes-hub-window"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {/* Header */}
      <div className="hub-header" onMouseDown={handleHeaderMouseDown}>
        <div className="hub-title">
          <StickyNote size={18} style={{ color: '#0284c7' }} />
          <span>Sticky Notes</span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '99px',
              background: 'rgba(0,0,0,0.06)',
              fontWeight: 500,
            }}
          >
            {notes.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {onSyncNow && (
            <button
              className="note-btn"
              title="Sync now"
              onClick={onSyncNow}
              disabled={isSyncing}
            >
              <RefreshCw
                size={14}
                style={{
                  animation: isSyncing ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>
          )}

          <button
            className="note-btn"
            title="New Note (Ctrl+N)"
            onClick={onNewNote}
          >
            <Plus size={16} />
          </button>

          <button
            className="note-btn close-btn"
            title="Close Hub"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="hub-search-container">
        <div className="search-box">
          <Search size={15} style={{ color: '#94a3b8' }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Color Filters */}
        <div className="color-filter-chips">
          <button
            className={`filter-chip ${selectedColorFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedColorFilter('all')}
          >
            All Colors
          </button>
          {(Object.keys(NOTE_COLORS) as NoteColorId[]).map((cid) => (
            <button
              key={cid}
              className={`filter-chip ${selectedColorFilter === cid ? 'active' : ''}`}
              onClick={() => setSelectedColorFilter(cid)}
              style={{
                borderLeft: `3px solid ${NOTE_COLORS[cid].accent}`,
              }}
            >
              {NOTE_COLORS[cid].name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List */}
      <div className="hub-notes-list">
        {filteredNotes.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              gap: '10px',
              padding: '30px 10px',
              textAlign: 'center',
            }}
          >
            <StickyNote size={36} strokeWidth={1.5} />
            <p style={{ fontSize: '13px' }}>
              {searchQuery ? 'No notes matched your search' : 'No notes yet. Create your first note!'}
            </p>
            {!searchQuery && (
              <button className="btn-primary" onClick={onNewNote}>
                <Plus size={14} /> Create Note
              </button>
            )}
          </div>
        ) : (
          filteredNotes.map((note) => {
            const colorCfg = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
            const plain = stripHtml(note.content);

            return (
              <div
                key={note.id}
                className="hub-note-card"
                style={{
                  backgroundColor: colorCfg.bgLight,
                  borderLeft: `4px solid ${colorCfg.accent}`,
                }}
                onClick={() => onOpenNote(note.id)}
              >
                <div className="hub-note-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {note.isPinned && (
                      <Pin size={12} style={{ color: '#d97706', fill: '#d97706' }} />
                    )}
                    {note.title || 'Untitled Note'}
                  </span>

                  <div className="hub-note-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="note-btn"
                      title={note.isPinned ? 'Unpin' : 'Pin to top'}
                      onClick={() => onTogglePin(note.id)}
                    >
                      <Pin size={13} style={{ color: note.isPinned ? '#d97706' : undefined }} />
                    </button>
                    <button
                      className="note-btn"
                      title="Open Note Window"
                      onClick={() => onOpenNote(note.id)}
                    >
                      <ExternalLink size={13} />
                    </button>
                    <button
                      className="note-btn close-btn"
                      title="Delete Note"
                      onClick={() => setNoteToDelete(note.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="hub-note-preview">
                  {plain || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Empty note</span>}
                </div>

                <div className="hub-note-footer">
                  <span>
                    {new Date(note.updatedAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {note.isOpen && (
                    <span
                      style={{
                        color: '#0284c7',
                        fontWeight: 600,
                        fontSize: '10px',
                      }}
                    >
                      ● Window open
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {noteToDelete && (
        <div
          className="modal-overlay"
          onClick={() => setNoteToDelete(null)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Delete this note?</h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Are you sure you want to delete this sticky note? This action will move it to the trash queue.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="format-btn"
                style={{ padding: '6px 14px', width: 'auto', border: '1px solid rgba(0,0,0,0.1)' }}
                onClick={() => setNoteToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ backgroundColor: '#ef4444' }}
                onClick={() => {
                  onDeleteNote(noteToDelete);
                  setNoteToDelete(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
