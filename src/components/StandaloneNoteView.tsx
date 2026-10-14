'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  X,
  MoreHorizontal,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  Image as ImageIcon,
  Trash2,
  Type,
  ChevronDown,
} from 'lucide-react';
import { Note, NOTE_COLORS, NoteColorId } from '@/types';
import { localDb } from '@/lib/storage';

interface StandaloneNoteViewProps {
  noteId: string;
}

const PRESET_FONT_SIZES = [
  { label: 'XS (12px)', size: 12 },
  { label: 'Small (14px)', size: 14 },
  { label: 'Normal (16px)', size: 16 },
  { label: 'Medium (20px)', size: 20 },
  { label: 'Large (26px)', size: 26 },
  { label: 'Huge (34px)', size: 34 },
  { label: 'Title (42px)', size: 42 },
];

const FONT_STEPS = [12, 14, 16, 18, 22, 26, 32, 40, 48, 56];

export const StandaloneNoteView: React.FC<StandaloneNoteViewProps> = ({ noteId }) => {
  const [note, setNote] = useState<Note | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);

  // Floating selection bubble state
  const [selectionBubble, setSelectionBubble] = useState<{
    x: number;
    y: number;
    currentSize: number;
  } | null>(null);

  // Active format state for toolbar highlights
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    list: false,
  });

  const contentAreaRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load note
  useEffect(() => {
    const loaded = localDb.getNoteById(noteId);
    if (loaded) {
      setNote(loaded);
    }

    const handleStorageUpdate = () => {
      const updated = localDb.getNoteById(noteId);
      if (updated) {
        setNote(updated);
      }
    };
    window.addEventListener('stickynotes:updated', handleStorageUpdate);

    return () => {
      window.removeEventListener('stickynotes:updated', handleStorageUpdate);
    };
  }, [noteId]);

  // Sync editor innerHTML on initial load
  useEffect(() => {
    if (note && editorRef.current && editorRef.current.innerHTML !== note.content) {
      editorRef.current.innerHTML = note.content;
    }
  }, [note?.id]);

  // Update active format buttons on selection change
  const updateActiveFormats = useCallback(() => {
    if (typeof document === 'undefined') return;
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        list: document.queryCommandState('insertUnorderedList'),
      });
    } catch {}
  }, []);

  // Check user text selection and show floating formatting bubble directly at the selected text
  const handleSelectionChange = useCallback(() => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();

    if (
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0 ||
      !editorRef.current ||
      !contentAreaRef.current
    ) {
      setSelectionBubble(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setSelectionBubble(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      setSelectionBubble(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const contentRect = contentAreaRef.current.getBoundingClientRect();

    const bubbleWidth = 275;
    const bubbleHeight = 36;

    // Centered above the selection
    const centerX = rect.left + rect.width / 2 - contentRect.left;
    let bubbleX = centerX - bubbleWidth / 2;
    bubbleX = Math.max(8, Math.min(bubbleX, contentRect.width - bubbleWidth - 8));

    // Place above if there is space, else below
    const topAbove = rect.top - contentRect.top - bubbleHeight - 8;
    const bottomBelow = rect.bottom - contentRect.top + 8;
    let bubbleY = topAbove >= 6 ? topAbove : bottomBelow;
    bubbleY = Math.max(4, Math.min(bubbleY, contentRect.height - bubbleHeight - 4));

    // Detect current font size
    let curSize = 15;
    let node: Node | null = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (node && node instanceof HTMLElement) {
      const parsed = parseFloat(window.getComputedStyle(node).fontSize);
      if (!isNaN(parsed) && parsed > 0) curSize = Math.round(parsed);
    }

    setSelectionBubble({
      x: bubbleX,
      y: bubbleY,
      currentSize: curSize,
    });

    updateActiveFormats();
  }, [updateActiveFormats]);

  // Hide bubble when selection is collapsed
  useEffect(() => {
    const handleDocSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelectionBubble(null);
      }
    };
    document.addEventListener('selectionchange', handleDocSelection);
    return () => {
      document.removeEventListener('selectionchange', handleDocSelection);
    };
  }, []);

  // Auto-save logic
  const handleContentInput = useCallback(() => {
    if (!editorRef.current || !note) return;
    const newContent = editorRef.current.innerHTML;
    const textContent = editorRef.current.innerText.trim();
    const firstLine = textContent.split('\n')[0] || '';
    const smartTitle = firstLine.slice(0, 40);

    const updatedNote: Note = {
      ...note,
      title: smartTitle,
      content: newContent,
    };

    setNote(updatedNote);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      localDb.saveNote(updatedNote);
      if (window.electronAPI?.broadcastNoteChange) {
        window.electronAPI.broadcastNoteChange();
      }
    }, 300);

    updateActiveFormats();
  }, [note, updateActiveFormats]);

  // Formatting execution
  const applyFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
    handleContentInput();
  };

  // Increase, Decrease, or Set Font Size for Selected Text (Preserves selection so user can click repeatedly!)
  const applyFontSize = (sizeOrDirection: 'increase' | 'decrease' | number) => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    // Detect current font size of selection
    let currentSize = 15;
    let node: Node | null = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (node && node instanceof HTMLElement) {
      const parsed = parseFloat(window.getComputedStyle(node).fontSize);
      if (!isNaN(parsed) && parsed > 0) currentSize = Math.round(parsed);
    }

    let targetSize: number;
    if (typeof sizeOrDirection === 'number') {
      targetSize = sizeOrDirection;
    } else if (sizeOrDirection === 'increase') {
      const next = FONT_STEPS.find((s) => s > currentSize);
      targetSize = next !== undefined ? next : Math.min(64, currentSize + 4);
    } else {
      const prev = [...FONT_STEPS].reverse().find((s) => s < currentSize);
      targetSize = prev !== undefined ? prev : Math.max(10, currentSize - 4);
    }

    if (!selection.isCollapsed) {
      let directlyUpdated = false;
      let targetSpan: HTMLElement | null = null;

      if (node && node instanceof HTMLElement && node !== editorRef.current) {
        if (node.tagName === 'SPAN' && node.style.fontSize) {
          targetSpan = node;
        } else {
          const closest = node.closest('span[style*="font-size"]');
          if (closest && editorRef.current.contains(closest)) {
            targetSpan = closest as HTMLElement;
          }
        }
      }

      if (targetSpan && targetSpan.innerText.trim() === range.toString().trim()) {
        targetSpan.style.fontSize = `${targetSize}px`;
        directlyUpdated = true;
      }

      if (!directlyUpdated) {
        try {
          document.execCommand('styleWithCSS', false, 'false');
        } catch {}
        document.execCommand('fontSize', false, '7');

        const modifiedSpans: HTMLElement[] = [];
        const fonts = editorRef.current.querySelectorAll('font[size="7"]');
        fonts.forEach((el) => {
          const span = document.createElement('span');
          span.style.fontSize = `${targetSize}px`;
          span.innerHTML = el.innerHTML;
          el.parentNode?.replaceChild(span, el);
          modifiedSpans.push(span);
        });

        const cssSpans = editorRef.current.querySelectorAll(
          'span[style*="-webkit-xxx-large"], span[style*="xxx-large"], span[style*="48px"]'
        );
        cssSpans.forEach((el) => {
          (el as HTMLElement).style.fontSize = `${targetSize}px`;
          modifiedSpans.push(el as HTMLElement);
        });

        // Restore and maintain selection across modified elements so user can click repeatedly!
        if (modifiedSpans.length > 0) {
          const newRange = document.createRange();
          newRange.setStartBefore(modifiedSpans[0]);
          newRange.setEndAfter(modifiedSpans[modifiedSpans.length - 1]);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
    } else {
      // If cursor is at a position without selection, insert a styled zero-width space
      document.execCommand('insertHTML', false, `<span style="font-size: ${targetSize}px">&#8203;</span>`);
    }

    handleContentInput();
    setShowSizeDropdown(false);

    // Refresh bubble position and detected font size immediately
    setTimeout(() => {
      handleSelectionChange();
    }, 40);
  };

  // Keyboard shortcut listener (Ctrl+Shift+> and Ctrl+Shift+<)
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.shiftKey && (e.key === '>' || e.key === '.')) {
        e.preventDefault();
        applyFontSize('increase');
      } else if (e.shiftKey && (e.key === '<' || e.key === ',')) {
        e.preventDefault();
        applyFontSize('decrease');
      }
    }
  };

  // Image insertion (Matching the image button in screenshot 1)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        if (editorRef.current) editorRef.current.focus();
        document.execCommand(
          'insertHTML',
          false,
          `<div style="margin: 8px 0;"><img src="${base64}" style="max-width: 100%; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.15);" /></div><div><br></div>`
        );
        handleContentInput();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleColorChange = (cid: NoteColorId) => {
    if (!note) return;
    const updated = { ...note, color: cid };
    setNote(updated);
    localDb.saveNote(updated);
    setShowColorPicker(false);
    if (window.electronAPI?.broadcastNoteChange) {
      window.electronAPI.broadcastNoteChange();
    }
  };

  const handleClose = () => {
    if (note) {
      localDb.saveNote({ ...note, isOpen: false });
    }
    if (window.electronAPI?.closeNoteWindow) {
      window.electronAPI.closeNoteWindow(noteId);
    } else if (typeof window !== 'undefined') {
      window.close();
    }
  };

  const handleDelete = () => {
    localDb.softDeleteNote(noteId);
    if (window.electronAPI?.closeNoteWindow) {
      window.electronAPI.closeNoteWindow(noteId);
    } else if (typeof window !== 'undefined') {
      window.close();
    }
  };

  const handleNewNote = () => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: '',
      content: '',
      color: note?.color || 'yellow',
      isPinned: false,
      isArchived: false,
      isOpen: true,
      isMinimized: false,
      positionX: 200,
      positionY: 200,
      width: 320,
      height: 340,
      zIndex: 10,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    localDb.saveNote(newNote);
    if (window.electronAPI?.openNoteWindow) {
      window.electronAPI.openNoteWindow(newNote.id);
    } else {
      window.open(`/note?id=${encodeURIComponent(newNote.id)}`, `note_${newNote.id}`, 'width=340,height=360');
    }
  };

  if (!note) {
    return (
      <div style={{ padding: '24px', color: '#666', background: '#fff9c4', height: '100vh' }}>
        Loading note...
      </div>
    );
  }

  const colorCfg = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const isDarkNote = note.color === 'charcoal';

  return (
    <div
      className={`ms-sticky-note-window ${isDarkNote ? 'theme-dark-note' : ''}`}
      style={{ backgroundColor: colorCfg.bgLight }}
    >
      {/* Top Header Bar (Matching Screenshot 1: '+' on left, '...' and 'X' on right) */}
      <div
        className="ms-note-header"
        style={{ backgroundColor: colorCfg.headerLight }}
      >
        <button
          className="ms-header-btn"
          title="New note (Ctrl+N)"
          onClick={handleNewNote}
        >
          <Plus size={18} strokeWidth={2} />
        </button>

        <div className="ms-header-actions">
          {/* Menu / Color Picker */}
          <button
            className="ms-header-btn"
            title="Menu"
            onClick={() => setShowColorPicker(!showColorPicker)}
          >
            <MoreHorizontal size={18} strokeWidth={2} />
          </button>

          {/* Close Note Window */}
          <button
            className="ms-header-btn close-btn"
            title="Close note"
            onClick={handleClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Color Palette Dropdown */}
        {showColorPicker && (
          <div
            className="ms-color-picker-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="ms-color-palette-row">
              {(Object.keys(NOTE_COLORS) as NoteColorId[]).map((cid) => (
                <div
                  key={cid}
                  className={`ms-color-circle ${note.color === cid ? 'selected' : ''}`}
                  style={{ backgroundColor: NOTE_COLORS[cid].accent }}
                  title={NOTE_COLORS[cid].name}
                  onClick={() => handleColorChange(cid)}
                />
              ))}
            </div>

            <div className="ms-dropdown-divider" />

            <button
              className="ms-delete-note-btn"
              title="Delete note"
              onClick={handleDelete}
            >
              <Trash2 size={14} />
              <span>Delete note</span>
            </button>
          </div>
        )}
      </div>

      {/* Note Content Area */}
      <div ref={contentAreaRef} className="ms-note-content-area">
        {/* Floating Quick Selection Bubble (Where text is selected) */}
        {selectionBubble && (
          <div
            className="ms-selection-bubble"
            style={{
              left: `${selectionBubble.x}px`,
              top: `${selectionBubble.y}px`,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* Increase Font Size (A+) Button */}
            <button
              className="bubble-btn highlight-btn"
              title="Increase Text Size (Ctrl+Shift+>)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize('increase')}
            >
              <span className="bubble-text-btn">
                A<sup className="bubble-sup">+</sup>
              </span>
            </button>

            {/* Current Font Size Indicator */}
            <span
              className="bubble-size-indicator"
              title={`Selected Font Size: ${selectionBubble.currentSize}px`}
            >
              {selectionBubble.currentSize}px
            </span>

            {/* Decrease Font Size (A-) Button */}
            <button
              className="bubble-btn"
              title="Decrease Text Size (Ctrl+Shift+<)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize('decrease')}
            >
              <span className="bubble-text-btn">
                A<sub className="bubble-sub">-</sub>
              </span>
            </button>

            <div className="bubble-divider" />

            {/* Quick Size Preset Pills */}
            <button
              className={`bubble-pill ${selectionBubble.currentSize === 14 ? 'active' : ''}`}
              title="Small (14px)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize(14)}
            >
              14
            </button>
            <button
              className={`bubble-pill ${selectionBubble.currentSize === 18 ? 'active' : ''}`}
              title="Medium (18px)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize(18)}
            >
              18
            </button>
            <button
              className={`bubble-pill ${selectionBubble.currentSize === 26 ? 'active' : ''}`}
              title="Large (26px)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize(26)}
            >
              26
            </button>
            <button
              className={`bubble-pill ${selectionBubble.currentSize === 34 ? 'active' : ''}`}
              title="Heading (34px)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize(34)}
            >
              34
            </button>

            <div className="bubble-divider" />

            {/* Quick Formatting Buttons */}
            <button
              className={`bubble-btn ${activeFormats.bold ? 'active' : ''}`}
              title="Bold (Ctrl+B)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat('bold')}
            >
              <span style={{ fontWeight: 800, fontSize: '13px' }}>B</span>
            </button>
            <button
              className={`bubble-btn ${activeFormats.italic ? 'active' : ''}`}
              title="Italic (Ctrl+I)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat('italic')}
            >
              <span style={{ fontStyle: 'italic', fontWeight: 600, fontSize: '13px', fontFamily: 'Georgia, serif' }}>I</span>
            </button>
            <button
              className={`bubble-btn ${activeFormats.underline ? 'active' : ''}`}
              title="Underline (Ctrl+U)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat('underline')}
            >
              <span style={{ textDecoration: 'underline', fontWeight: 600, fontSize: '13px' }}>U</span>
            </button>
            <button
              className={`bubble-btn ${activeFormats.strike ? 'active' : ''}`}
              title="Strikethrough"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat('strikeThrough')}
            >
              <span style={{ textDecoration: 'line-through', fontSize: '12px', fontWeight: 500 }}>ab</span>
            </button>
          </div>
        )}

        <div
          ref={editorRef}
          className="ms-note-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={handleContentInput}
          onMouseUp={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          onSelect={handleSelectionChange}
          onScroll={handleSelectionChange}
          onKeyDown={handleEditorKeyDown}
          spellCheck
        />
      </div>

      {/* Hidden file input for Image insertion */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      {/* Bottom Formatting Toolbar */}
      <div className="ms-note-toolbar">
        {/* Bold (B) */}
        <button
          className={`ms-tool-btn ${activeFormats.bold ? 'active' : ''}`}
          title="Bold (Ctrl+B)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat('bold')}
        >
          <span style={{ fontWeight: 800, fontSize: '14px', fontFamily: 'Segoe UI, sans-serif' }}>B</span>
        </button>

        {/* Italic (I) */}
        <button
          className={`ms-tool-btn ${activeFormats.italic ? 'active' : ''}`}
          title="Italic (Ctrl+I)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat('italic')}
        >
          <span style={{ fontStyle: 'italic', fontWeight: 600, fontSize: '14px', fontFamily: 'Georgia, serif' }}>I</span>
        </button>

        {/* Underline (U) */}
        <button
          className={`ms-tool-btn ${activeFormats.underline ? 'active' : ''}`}
          title="Underline (Ctrl+U)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat('underline')}
        >
          <span style={{ textDecoration: 'underline', fontWeight: 600, fontSize: '14px' }}>U</span>
        </button>

        {/* Strikethrough (ab with strike) */}
        <button
          className={`ms-tool-btn ${activeFormats.strike ? 'active' : ''}`}
          title="Strikethrough"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat('strikeThrough')}
        >
          <span style={{ textDecoration: 'line-through', fontSize: '13px', fontWeight: 500 }}>ab</span>
        </button>

        {/* Bulleted List */}
        <button
          className={`ms-tool-btn ${activeFormats.list ? 'active' : ''}`}
          title="Bulleted list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat('insertUnorderedList')}
        >
          <List size={16} />
        </button>

        {/* Add Image */}
        <button
          className="ms-tool-btn"
          title="Add image"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon size={16} />
        </button>

        {/* Divider before Font Size */}
        <div style={{ width: '1px', height: '18px', background: 'rgba(0,0,0,0.1)', margin: '0 4px' }} />

        {/* Increase Text Size (A⁺) Button */}
        <button
          className="ms-tool-btn font-size-btn"
          title="Increase Font Size (Ctrl+Shift+>)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFontSize('increase')}
        >
          <span style={{ fontWeight: 700, fontSize: '13px' }}>
            A<sup style={{ fontSize: '9px', fontWeight: 800 }}>+</sup>
          </span>
        </button>

        {/* Decrease Text Size (A⁻) Button */}
        <button
          className="ms-tool-btn font-size-btn"
          title="Decrease Font Size (Ctrl+Shift+<)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFontSize('decrease')}
        >
          <span style={{ fontWeight: 700, fontSize: '13px' }}>
            A<sub style={{ fontSize: '9px', fontWeight: 800 }}>-</sub>
          </span>
        </button>

        {/* Font Size Presets Dropdown */}
        <div className="size-dropdown-container">
          <button
            className="ms-tool-btn font-size-btn"
            title="Font Size Presets"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowSizeDropdown(!showSizeDropdown)}
            style={{ width: 'auto', padding: '0 4px', gap: '2px' }}
          >
            <Type size={14} />
            <ChevronDown size={11} />
          </button>

          {showSizeDropdown && (
            <div
              className="size-dropdown-menu"
              onMouseDown={(e) => e.preventDefault()}
            >
              {PRESET_FONT_SIZES.map((item) => (
                <button
                  key={item.size}
                  className="size-option-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyFontSize(item.size)}
                >
                  <span>{item.label}</span>
                  <span style={{ fontSize: `${Math.min(item.size, 18)}px`, opacity: 0.7 }}>Aa</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
