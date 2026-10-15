'use client';

import React, { useState, useEffect } from 'react';
import {
  StickyNote,
  Plus,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { SyncStatus } from '@/types';

interface DesktopTaskbarProps {
  isHubOpen: boolean;
  activeNotesCount: number;
  totalNotesCount: number;
  syncStatus: SyncStatus;
  onToggleHub: () => void;
  onNewNote: () => void;
  onOpenSettings: () => void;
  onSyncNow: () => void;
}

export const DesktopTaskbar: React.FC<DesktopTaskbarProps> = ({
  isHubOpen,
  activeNotesCount,
  totalNotesCount,
  syncStatus,
  onToggleHub,
  onNewNote,
  onOpenSettings,
  onSyncNow,
}) => {
  const [mounted, setMounted] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
      setDateStr(
        now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute status values with stable fallback for SSR
  const isOnline = mounted ? syncStatus.isOnline : true;
  const isSyncing = mounted ? syncStatus.isSyncing : false;
  const pendingCount = mounted ? syncStatus.pendingChangesCount : 0;

  const badgeTitle = isSyncing
    ? 'Syncing changes to cloud...'
    : isOnline
    ? `Cloud synced. ${pendingCount} pending items.`
    : 'Offline. Notes are saved to local SQLite.';

  const badgeText = isSyncing
    ? 'Syncing...'
    : isOnline
    ? 'Local + Cloud'
    : 'Local (Offline)';

  return (
    <footer className="taskbar">
      {/* Left side: Windows Start Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="taskbar-item"
          title="Windows Start"
          onClick={onToggleHub}
        >
          {/* Windows 11 4-square Grid Logo */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 6px)',
              gap: '2px',
            }}
          >
            <div style={{ width: '6px', height: '6px', background: '#38bdf8', borderRadius: '1px' }} />
            <div style={{ width: '6px', height: '6px', background: '#38bdf8', borderRadius: '1px' }} />
            <div style={{ width: '6px', height: '6px', background: '#38bdf8', borderRadius: '1px' }} />
            <div style={{ width: '6px', height: '6px', background: '#38bdf8', borderRadius: '1px' }} />
          </div>
        </button>
      </div>

      {/* Center: Pinned & Running Apps */}
      <div className="taskbar-center">
        {/* Sticky Notes Hub App Icon */}
        <button
          className={`taskbar-item ${isHubOpen ? 'active' : ''}`}
          title="Sticky Notes Hub (Manage all notes)"
          onClick={onToggleHub}
        >
          <img
            src="/app-logo.png"
            alt="Sticky Notes"
            style={{ width: '22px', height: '22px', objectFit: 'contain', borderRadius: '4px' }}
          />
        </button>

        {/* Quick New Note Shortcut */}
        <button
          className="taskbar-item"
          title="Create New Note (Ctrl+N)"
          onClick={onNewNote}
        >
          <Plus size={18} />
        </button>

        {/* Settings */}
        <button
          className="taskbar-item"
          title="Sticky Notes Settings & Cloud Sync"
          onClick={onOpenSettings}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Right side: System Tray */}
      <div className="taskbar-tray">
        {/* Sync Status Badge */}
        <div
          className="tray-badge"
          suppressHydrationWarning
          title={badgeTitle}
          onClick={onSyncNow}
          style={{ cursor: 'pointer' }}
        >
          <div
            suppressHydrationWarning
            className={`tray-status-dot ${
              isSyncing ? 'syncing' : isOnline ? 'online' : 'offline'
            }`}
          />
          <span suppressHydrationWarning>{badgeText}</span>
          {isOnline ? (
            <Wifi size={12} style={{ color: '#10b981' }} />
          ) : (
            <WifiOff size={12} style={{ color: '#ef4444' }} />
          )}
        </div>

        {/* Clock & Calendar */}
        <div
          suppressHydrationWarning
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            lineHeight: 1.2,
            padding: '2px 6px',
            borderRadius: '4px',
            cursor: 'default',
          }}
        >
          <span suppressHydrationWarning style={{ fontSize: '11px', fontWeight: 600 }}>
            {timeStr}
          </span>
          <span suppressHydrationWarning style={{ fontSize: '10px', opacity: 0.75 }}>
            {dateStr}
          </span>
        </div>
      </div>
    </footer>
  );
};
