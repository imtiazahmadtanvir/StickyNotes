'use client';

import React, { useState } from 'react';
import {
  X,
  Cloud,
  Moon,
  Sun,
  Palette,
  Download,
  Upload,
  Database,
  Check,
  AlertCircle,
  User,
  LogIn,
  LogOut,
  UserPlus,
} from 'lucide-react';
import { AppSettings, NoteColorId, NOTE_COLORS } from '@/types';
import { authService, AuthUser } from '@/lib/auth';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSaveSettings: (settings: Partial<AppSettings>) => void;
  onExportNotes: () => void;
  onImportNotes: (jsonContent: string) => void;
  notesCount: number;
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSaveSettings,
  onExportNotes,
  onImportNotes,
  notesCount,
  onOpenAuth,
}) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authService.getCurrentUser());
  const [theme, setTheme] = useState(settings.theme);
  const [defaultColor, setDefaultColor] = useState<NoteColorId>(settings.defaultColor);
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings.supabaseAnonKey || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings({
      theme,
      defaultColor,
      supabaseUrl,
      supabaseAnonKey,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) onImportNotes(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} style={{ color: '#0284c7' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Sticky Notes Settings</h3>
          </div>
          <button className="note-btn close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Account & Sync Mode Section */}
        <div className="settings-account-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: currentUser
                    ? 'linear-gradient(135deg, #0078d4, #00bcf2)'
                    : 'rgba(0,0,0,0.08)',
                  color: currentUser ? '#fff' : '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                {currentUser ? (
                  currentUser.name ? currentUser.name[0].toUpperCase() : currentUser.email[0].toUpperCase()
                ) : (
                  <User size={16} />
                )}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {currentUser ? currentUser.name || 'User Account' : 'Default Mode (Guest)'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {currentUser ? currentUser.email : 'Notes stored locally on this PC'}
                </div>
              </div>
            </div>

            {currentUser ? (
              <button
                type="button"
                className="settings-auth-btn signout"
                onClick={() => {
                  authService.logout();
                  setCurrentUser(null);
                }}
                title="Sign out and return to default guest mode"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                className="settings-auth-btn signin"
                onClick={() => {
                  onClose();
                  if (onOpenAuth) onOpenAuth('signin');
                }}
                title="Sign in to sync notes"
              >
                <LogIn size={13} />
                <span>Sign In / Sign Up</span>
              </button>
            )}
          </div>
        </div>

        {/* Theme Preference */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
            Appearance Theme
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                className={`filter-chip ${theme === t ? 'active' : ''}`}
                style={{ flex: 1, padding: '8px 12px', textTransform: 'capitalize' }}
                onClick={() => setTheme(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Default Note Color */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
            Default Note Color
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(Object.keys(NOTE_COLORS) as NoteColorId[]).map((cid) => (
              <div
                key={cid}
                className={`color-swatch ${defaultColor === cid ? 'selected' : ''}`}
                style={{ backgroundColor: NOTE_COLORS[cid].accent }}
                title={NOTE_COLORS[cid].name}
                onClick={() => setDefaultColor(cid)}
              />
            ))}
          </div>
        </div>

        {/* Cloud Sync (Supabase) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'rgba(0,0,0,0.03)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cloud size={16} style={{ color: '#0284c7' }} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Cloud Sync (Supabase PostgreSQL)</span>
          </div>
          <p style={{ fontSize: '11px', color: '#64748b' }}>
            Notes are always stored locally first in SQLite. Connect Supabase to sync across devices.
          </p>
          <input
            type="text"
            className="search-input"
            style={{
              background: '#fff',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
            }}
            placeholder="Supabase Project URL (https://xyz.supabase.co)"
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
          />
          <input
            type="password"
            className="search-input"
            style={{
              background: '#fff',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
            }}
            placeholder="Supabase Anon / Public Key"
            value={supabaseAnonKey}
            onChange={(e) => setSupabaseAnonKey(e.target.value)}
          />
        </div>

        {/* Backup & Restore */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
            Backup &amp; Data ({notesCount} notes)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="filter-chip"
              style={{ flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={onExportNotes}
            >
              <Download size={14} /> Export Backup (JSON)
            </button>
            <label
              className="filter-chip"
              style={{
                flex: 1,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Upload size={14} /> Import Notes
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileImport}
              />
            </label>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
          <button
            className="format-btn"
            style={{ padding: '6px 14px', width: 'auto', border: '1px solid rgba(0,0,0,0.1)' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
          >
            {saveSuccess ? (
              <>
                <Check size={14} /> Saved!
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
