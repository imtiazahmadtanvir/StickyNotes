'use client';

import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Cloud,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { authService, AuthUser } from '@/lib/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: AuthUser) => void;
  initialMode?: 'signin' | 'signup' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin',
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if ((mode === 'signup' || mode === 'forgot') && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await authService.login(email.trim(), password);
        if (!res.success) {
          setError(res.error || 'Failed to sign in.');
          setLoading(false);
          return;
        }

        setSuccessMsg('Signed in successfully! Local notes merged.');
        setTimeout(() => {
          setLoading(false);
          if (res.user && onSuccess) onSuccess(res.user);
          onClose();
        }, 600);
      } else if (mode === 'signup') {
        const res = await authService.signup(email.trim(), password, name.trim());
        if (!res.success) {
          setError(res.error || 'Failed to create account.');
          setLoading(false);
          return;
        }

        setSuccessMsg('Account created! Notes will now sync to cloud.');
        setTimeout(() => {
          setLoading(false);
          if (res.user && onSuccess) onSuccess(res.user);
          onClose();
        }, 600);
      } else {
        // Forgot / Reset password mode
        const res = await authService.resetPassword(email.trim(), password);
        if (!res.success) {
          setError(res.error || 'Failed to reset password.');
          setLoading(false);
          return;
        }

        setSuccessMsg('Password reset successfully! Signed in.');
        setTimeout(() => {
          setLoading(false);
          if (res.user && onSuccess) onSuccess(res.user);
          onClose();
        }, 600);
      }
    } catch (err) {
      setError((err as Error).message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog auth-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '400px', width: '92%' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="auth-icon-badge">
              {mode === 'forgot' ? (
                <KeyRound size={18} style={{ color: '#0078d4' }} />
              ) : (
                <Cloud size={18} style={{ color: '#0078d4' }} />
              )}
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                {mode === 'signin'
                  ? 'Sign in to Sticky Notes'
                  : mode === 'signup'
                  ? 'Create an Account'
                  : 'Reset Password'}
              </h3>
              <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.5)', margin: 0 }}>
                {mode === 'forgot'
                  ? 'Choose a new password for your account'
                  : 'Sync and back up notes to the cloud'}
              </p>
            </div>
          </div>
          <button className="note-btn close-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Tab switchers (only for signin/signup) */}
        {mode !== 'forgot' ? (
          <div className="auth-tab-group">
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => {
                setMode('signin');
                setError(null);
                setSuccessMsg(null);
              }}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccessMsg(null);
              }}
            >
              <UserPlus size={14} />
              <span>Sign Up</span>
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#666', background: 'rgba(0,120,212,0.06)', padding: '8px 12px', borderRadius: '6px' }}>
            Enter your registered email address and set your new password below.
          </div>
        )}

        {/* Status Alerts */}
        {error && (
          <div className="auth-alert error">
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert success">
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'signup' && (
            <div className="auth-input-group">
              <label>Your Name (Optional)</label>
              <div className="auth-input-wrapper">
                <User size={15} className="input-icon" />
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="auth-input-group">
            <label>Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={15} className="input-icon" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="auth-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>
                {mode === 'forgot' ? 'New Password' : 'Password'}
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0078d4',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="auth-input-wrapper">
              <Lock size={15} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={mode === 'forgot' ? 'Enter new password (min. 6 chars)' : 'At least 6 characters'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {(mode === 'signup' || mode === 'forgot') && (
            <div className="auth-input-group">
              <label>
                {mode === 'forgot' ? 'Confirm New Password' : 'Confirm Password'}
              </label>
              <div className="auth-input-wrapper">
                <Lock size={15} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span>Please wait...</span>
            ) : mode === 'signin' ? (
              <>
                <LogIn size={15} />
                <span>Sign In & Sync Notes</span>
              </>
            ) : mode === 'signup' ? (
              <>
                <UserPlus size={15} />
                <span>Create Account & Sync</span>
              </>
            ) : (
              <>
                <KeyRound size={15} />
                <span>Reset Password & Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Alternative Actions */}
        {mode === 'forgot' ? (
          <button
            type="button"
            className="auth-guest-btn"
            onClick={() => {
              setMode('signin');
              setError(null);
              setSuccessMsg(null);
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Sign In</span>
          </button>
        ) : (
          <>
            <div className="auth-or-divider">
              <span>OR</span>
            </div>

            <button
              type="button"
              className="auth-guest-btn"
              onClick={handleContinueAsGuest}
            >
              <span>Continue as Default (Guest Mode)</span>
            </button>

            <p className="auth-footnote">
              Guest mode keeps all notes saved offline on your PC. When you sign in, existing notes will be merged to your cloud account automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
