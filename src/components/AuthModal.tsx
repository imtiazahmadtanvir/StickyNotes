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
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(
    initialMode === 'forgot' ? 'signin' : initialMode
  );
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); // 1 = request code, 2 = enter code & reset
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendVerificationCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid registered email address.');
      return;
    }

    setLoading(true);

    try {
      const res = await authService.sendPasswordResetCode(email.trim());
      setLoading(false);

      if (!res.success) {
        setError(res.error || 'Failed to send verification code.');
        return;
      }

      setForgotStep(2);
      if (res.verificationCode) {
        setVerificationCode(res.verificationCode);
        setSuccessMsg(`Verification code generated: ${res.verificationCode}. Please enter your new password below.`);
      } else {
        setSuccessMsg('Verification code sent to your email! Please enter it below.');
      }
    } catch (err) {
      setLoading(false);
      setError((err as Error).message || 'Failed to request verification code.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (mode === 'forgot' && forgotStep === 1) {
      await handleSendVerificationCode();
      return;
    }

    if (mode === 'forgot' && (!verificationCode || verificationCode.trim().length < 6)) {
      setError('Please enter the 6-digit verification code.');
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
        // Mode === 'forgot' Step 2: Verify code and update password
        const res = await authService.verifyAndResetPassword(email.trim(), verificationCode.trim(), password);
        if (!res.success) {
          setError(res.error || 'Failed to reset password. Please check your verification code.');
          setLoading(false);
          return;
        }

        setSuccessMsg('Password verified & reset successfully! Signed in.');
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
                setForgotStep(1);
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
                setForgotStep(1);
                setError(null);
                setSuccessMsg(null);
              }}
            >
              <UserPlus size={14} />
              <span>Sign Up</span>
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#555', background: 'rgba(0,120,212,0.06)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(0,120,212,0.15)' }}>
            {forgotStep === 1 ? (
              <span>Step 1 of 2: Enter your registered email to receive a secure 6-digit verification code.</span>
            ) : (
              <span>Step 2 of 2: Enter the 6-digit code sent to your email and choose a new password.</span>
            )}
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

          {/* Email field */}
          <div className="auth-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>Email Address</label>
              {mode === 'forgot' && forgotStep === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotStep(1);
                    setError(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0078d4',
                    fontSize: '11px',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Change email
                </button>
              )}
            </div>
            <div className="auth-input-wrapper">
              <Mail size={15} className="input-icon" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || (mode === 'forgot' && forgotStep === 2)}
              />
            </div>
          </div>

          {/* Verification Code field (Only in forgot step 2) */}
          {mode === 'forgot' && forgotStep === 2 && (
            <div className="auth-input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0, fontWeight: 700, color: '#0078d4' }}>
                  6-Digit Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => handleSendVerificationCode()}
                  disabled={loading}
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
                  Resend code
                </button>
              </div>
              <div className="auth-input-wrapper">
                <KeyRound size={15} className="input-icon" style={{ color: '#0078d4' }} />
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  style={{
                    letterSpacing: '4px',
                    fontWeight: 700,
                    fontSize: '15px',
                  }}
                />
              </div>
            </div>
          )}

          {/* Password field: shown in signin, signup, or forgot step 2 */}
          {(mode !== 'forgot' || forgotStep === 2) && (
            <div className="auth-input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>
                  {mode === 'forgot' ? 'New Password' : 'Password'}
                </label>
                {/* Forgot / Reset password option hidden for now */}
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
          )}

          {/* Confirm Password field: shown in signup or forgot step 2 */}
          {((mode === 'signup') || (mode === 'forgot' && forgotStep === 2)) && (
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
            ) : forgotStep === 1 ? (
              <>
                <KeyRound size={15} />
                <span>Send Verification Code</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>Verify Code & Reset Password</span>
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
              setForgotStep(1);
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
