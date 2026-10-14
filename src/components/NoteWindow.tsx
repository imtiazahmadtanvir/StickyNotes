'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  X,
  Pin,
  MoreHorizontal,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  CheckSquare,
  Trash2,
  ChevronDown,
  Type,
} from 'lucide-react';
import { Note, NOTE_COLORS, NoteColorId } from '@/types';

interface NoteWindowProps {
  note: Note;
  isActive: boolean;
  onFocus: (id: string) => void;
  onUpdate: (note: Note) => void;
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
  onNewNote: () => void;
}

const PRESET_FONT_SIZES = [
  { label: 'XS (12px)', size: 12 },
  { label: 'Small (14px)', size: 14 },
  { label: 'Normal (16px)', size: 16 },
  { label: 'Medium (20px)', size: 20 },
  { label: 'Large (26px)', size: 26 },
  { label: 'Huge (34px)', size: 34 },
];

export const NoteWindow: React.FC<NoteWindowProps> = ({
  note,
  isActive,
  onFocus,
  onUpdate,
  onClose,
  onDelete,
  onNewNote,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPinned, setIsPinned] = useState(note.isPinned);

  // Floating selection bubble state
  const [selectionBubble, setSelectionBubble] = useState<{
    x: number;
    y: number;
    currentSize: number;
  } | null>(null);

  const windowRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({
    x: 0,
    y: 0,
    posX: note.positionX,
    posY: note.positionY,
  });
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: note.width,
    h: note.height,
  });

  const colorConfig = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const isDarkNote = note.color === 'charcoal';

  // Keep editor content in sync when opening
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== note.content) {
      editorRef.current.innerHTML = note.content;
    }
  }, [note.id]);

  // Debounced auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleContentInput = useCallback(() => {
    if (!editorRef.current) return;
    const newContent = editorRef.current.innerHTML;

    // Generate smart title from first line of text
    const textContent = editorRef.current.innerText.trim();
    const firstLine = textContent.split('\n')[0] || 'Untitled Note';
    const smartTitle = firstLine.slice(0, 40) + (firstLine.length > 40 ? '...' : '');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      onUpdate({
        ...note,
        title: smartTitle || 'Untitled Note',
        content: newContent,
      });
    }, 300);
  }, [note, onUpdate]);

  // Check user text selection and show floating formatting bubble
  const handleSelectionChange = useCallback(() => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();

    if (
      !selection ||
      selection.isCollapsed ||
      !editorRef.current ||
      !windowRef.current
    ) {
      setSelectionBubble(null);
      return;
    }

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (!editorRef.current.contains(range.commonAncestorContainer)) {
        setSelectionBubble(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      const windowRect = windowRef.current.getBoundingClientRect();

      // Relative coordinates within the Sticky Note window
      const relativeX = rect.left + rect.width / 2 - windowRect.left;
      const relativeY = rect.top - windowRect.top - 44; // Above the selection

      // Determine current font size
      let curSize = 15;
      let node: Node | null = range.commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (node && node instanceof HTMLElement) {
        const parsed = parseFloat(window.getComputedStyle(node).fontSize);
        if (!isNaN(parsed) && parsed > 0) curSize = Math.round(parsed);
      }

      setSelectionBubble({
        x: Math.max(10, Math.min(relativeX - 110, windowRect.width - 240)),
        y: Math.max(40, relativeY),
        currentSize: curSize,
      });
    }
  }, []);

  // Window Dragging Logic
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onFocus(note.id);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: note.positionX,
      posY: note.positionY,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        const newX = Math.max(0, dragStartRef.current.posX + deltaX);
        const newY = Math.max(0, dragStartRef.current.posY + deltaY);

        if (windowRef.current) {
          windowRef.current.style.left = `${newX}px`;
          windowRef.current.style.top = `${newY}px`;
        }
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        const newW = Math.max(260, resizeStartRef.current.w + deltaX);
        const newH = Math.max(220, resizeStartRef.current.h + deltaY);

        if (windowRef.current) {
          windowRef.current.style.width = `${newW}px`;
          windowRef.current.style.height = `${newH}px`;
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isDragging) {
        setIsDragging(false);
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        const finalX = Math.max(0, dragStartRef.current.posX + deltaX);
        const finalY = Math.max(0, dragStartRef.current.posY + deltaY);
        onUpdate({
          ...note,
          positionX: finalX,
          positionY: finalY,
        });
      } else if (isResizing) {
        setIsResizing(false);
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        const finalW = Math.max(260, resizeStartRef.current.w + deltaX);
        const finalH = Math.max(220, resizeStartRef.current.h + deltaY);
        onUpdate({
          ...note,
          width: finalW,
          height: finalH,
        });
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, note, onUpdate]);

  // Window Resize Logic
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocus(note.id);
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: note.width,
      h: note.height,
    };
  };

  // Standard Rich Text Execution
  const applyFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
    handleContentInput();
  };

  // Increase, Decrease, or Set Font Size for Selected Text
  const applyFontSize = (sizeOrDirection: 'increase' | 'decrease' | number) => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    // Detect current size
    let currentSize = 15;
    let node: Node | null = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (node && node instanceof HTMLElement) {
      const parsed = parseFloat(window.getComputedStyle(node).fontSize);
      if (!isNaN(parsed) && parsed > 0) currentSize = Math.round(parsed);
    }

    const SIZES = [12, 14, 16, 18, 22, 26, 32, 40];
    let targetSize: number;

    if (typeof sizeOrDirection === 'number') {
      targetSize = sizeOrDirection;
    } else if (sizeOrDirection === 'increase') {
      const next = SIZES.find((s) => s > currentSize);
      targetSize = next !== undefined ? next : Math.min(64, currentSize + 4);
    } else {
      const prev = [...SIZES].reverse().find((s) => s < currentSize);
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

    // Recheck selection after DOM mutation
    setTimeout(() => {
      handleSelectionChange();
    }, 40);
  };

  // Keyboard shortcut listener for text formatting inside editor
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

  const handleColorChange = (colorId: NoteColorId) => {
    setShowColorPicker(false);
    onUpdate({ ...note, color: colorId });
  };

  const togglePin = () => {
    const nextPin = !isPinned;
    setIsPinned(nextPin);
    onUpdate({ ...note, isPinned: nextPin });
  };

  return (
    <div
      ref={windowRef}
      className={`sticky-note-window ${isActive ? 'active' : ''} ${isPinned ? 'pinned' : ''} ${
        isDarkNote ? 'theme-dark-note' : ''
      }`}
      style={{
        left: `${note.positionX}px`,
        top: `${note.positionY}px`,
        width: `${note.width}px`,
        height: `${note.height}px`,
        zIndex: isPinned ? 900 : note.zIndex,
        backgroundColor: colorConfig.bgLight,
      }}
      onMouseDown={() => onFocus(note.id)}
    >
      {/* Header Bar */}
      <div
        className="note-header"
        style={{ backgroundColor: colorConfig.headerLight }}
        onMouseDown={handleHeaderMouseDown}
      >
        <button
          className="note-btn"
          title="New Note (Ctrl+N)"
          onClick={(e) => {
            e.stopPropagation();
            onNewNote();
          }}
        >
          <Plus size={16} />
        </button>

        <div className="note-header-actions">
          {/* Always on top / Pin */}
          <button
            className={`note-btn ${isPinned ? 'pinned-active' : ''}`}
            title={isPinned ? 'Unpin note' : 'Pin to top'}
            onClick={(e) => {
              e.stopPropagation();
              togglePin();
            }}
          >
            <Pin size={15} />
          </button>

          {/* Color & Options Menu */}
          <button
            className="note-btn"
            title="Note Color & Options"
            onClick={(e) => {
              e.stopPropagation();
              setShowColorPicker(!showColorPicker);
            }}
          >
            <MoreHorizontal size={16} />
          </button>

          {/* Close Window */}
          <button
            className="note-btn close-btn"
            title="Close Note (Ctrl+W)"
            onClick={(e) => {
              e.stopPropagation();
              onClose(note.id);
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Color Palette Dropdown */}
        {showColorPicker && (
          <div
            className="color-picker-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {(Object.keys(NOTE_COLORS) as NoteColorId[]).map((cid) => (
              <div
                key={cid}
                className={`color-swatch ${note.color === cid ? 'selected' : ''}`}
                style={{ backgroundColor: NOTE_COLORS[cid].accent }}
                title={NOTE_COLORS[cid].name}
                onClick={() => handleColorChange(cid)}
              />
            ))}
            <div
              style={{
                width: '1px',
                height: '24px',
                background: 'rgba(0,0,0,0.1)',
                margin: '0 2px',
              }}
            />
            <button
              className="note-btn close-btn"
              title="Delete Note"
              onClick={() => {
                setShowColorPicker(false);
                onDelete(note.id);
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Note Body */}
      <div className="note-body">
        {/* Floating Quick Selection Bubble */}
        {selectionBubble && (
          <div
            className="floating-selection-bubble"
            style={{
              left: `${selectionBubble.x}px`,
              top: `${selectionBubble.y}px`,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* Increase Font Size */}
            <button
              className="format-btn"
              title="Increase Font Size (Ctrl+Shift+>)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize('increase')}
            >
              <span className="font-size-badge">
                A<sup style={{ fontSize: '9px', fontWeight: 800 }}>+</sup>
              </span>
            </button>

            {/* Decrease Font Size */}
            <button
              className="format-btn"
              title="Decrease Font Size (Ctrl+Shift+<)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize('decrease')}
            >
              <span className="font-size-badge">
                A<sub style={{ fontSize: '9px', fontWeight: 800 }}>-</sub>
              </span>
            </button>

            <div
              style={{
                width: '1px',
                height: '16px',
                background: 'rgba(0,0,0,0.15)',
                margin: '0 2px',
              }}
            />

            {/* Quick Size Preset Pills */}
            <button
              className="font-size-pill"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize(14)}
              title="Small (14px)"
            >
              14
            </button>
            <button
              className="font-size-pill"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize(18)}
              title="Medium (18px)"
            >
              18
            </button>
            <button
              className="font-size-pill"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize(24)}
              title="Large (24px)"
            >
              24
            </button>
            <button
              className="font-size-pill"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFontSize(32)}
              title="Heading (32px)"
            >
              32
            </button>

            <div
              style={{
                width: '1px',
                height: '16px',
                background: 'rgba(0,0,0,0.15)',
                margin: '0 2px',
              }}
            />

            {/* Quick Bold & Italic */}
            <button
              className="format-btn"
              title="Bold"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat('bold')}
            >
              <Bold size={13} />
            </button>
            <button
              className="format-btn"
              title="Italic"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat('italic')}
            >
              <Italic size={13} />
            </button>
          </div>
        )}

        <div
          ref={editorRef}
          className="note-editable"
          contentEditable
          suppressContentEditableWarning
          onInput={handleContentInput}
          onMouseUp={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          onKeyDown={handleEditorKeyDown}
          spellCheck
        />
      </div>

      {/* Formatting Toolbar */}
      <div className="note-toolbar">
        <div className="format-btn-group">
          {/* Bold */}
          <button
            className="format-btn"
            title="Bold (Ctrl+B)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('bold')}
          >
            <Bold size={14} />
          </button>

          {/* Italic */}
          <button
            className="format-btn"
            title="Italic (Ctrl+I)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('italic')}
          >
            <Italic size={14} />
          </button>

          {/* Underline */}
          <button
            className="format-btn"
            title="Underline (Ctrl+U)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('underline')}
          >
            <Underline size={14} />
          </button>

          {/* Strikethrough */}
          <button
            className="format-btn"
            title="Strikethrough (Ctrl+T)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('strikeThrough')}
          >
            <Strikethrough size={14} />
          </button>

          <div
            style={{
              width: '1px',
              height: '16px',
              background: 'rgba(0,0,0,0.12)',
              margin: '0 2px',
            }}
          />

          {/* Increase Font Size (A+) */}
          <button
            className="format-btn"
            title="Increase Text Size (Ctrl+Shift+>)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFontSize('increase')}
          >
            <span className="font-size-badge">
              A<sup style={{ fontSize: '9px', fontWeight: 800 }}>+</sup>
            </span>
          </button>

          {/* Decrease Font Size (A-) */}
          <button
            className="format-btn"
            title="Decrease Text Size (Ctrl+Shift+<)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFontSize('decrease')}
          >
            <span className="font-size-badge">
              A<sub style={{ fontSize: '9px', fontWeight: 800 }}>-</sub>
            </span>
          </button>

          {/* Font Size Presets Dropdown */}
          <div className="size-dropdown-container">
            <button
              className="format-btn"
              title="Font Size Presets"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowSizeDropdown(!showSizeDropdown)}
              style={{ width: 'auto', padding: '0 4px', gap: '1px' }}
            >
              <Type size={13} />
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
                    <span style={{ fontSize: `${item.size}px`, opacity: 0.7 }}>Aa</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              width: '1px',
              height: '16px',
              background: 'rgba(0,0,0,0.12)',
              margin: '0 2px',
            }}
          />

          {/* Bulleted List */}
          <button
            className="format-btn"
            title="Bulleted List"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('insertUnorderedList')}
          >
            <List size={14} />
          </button>

          {/* Checklist / Task Item */}
          <button
            className="format-btn"
            title="Insert Task Item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              applyFormat('insertHTML', '<div>☐ &nbsp;</div>');
            }}
          >
            <CheckSquare size={14} />
          </button>
        </div>
      </div>

      {/* Resizing Corner Handle */}
      <div
        className="resize-handle bottom-right"
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};
