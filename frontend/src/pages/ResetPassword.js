import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../contexts/AuthContext';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { user, loading, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Use at least 8 characters for your password.' });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'The passwords do not match.' });
      return;
    }

    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    setMessage(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'Your password has been updated.' });
  };

  return (
    <AuthShell>
      <div className="auth-form-wrap">
        <div className="auth-form-heading">
          <h2>Choose a new password</h2>
          <p>Set a new password for your CBAT Academy account.</p>
        </div>

        {!loading && !user ? (
          <div className="auth-message auth-message-error" role="alert">
            <AlertCircle />
            <span>This reset link is no longer active. Request a new link from sign in.</span>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="reset-password">New password</label>
              <div className="auth-input-wrap">
                <LockKeyhole aria-hidden="true" />
                <input
                  id="reset-password"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reset-password-confirm">Confirm new password</label>
              <div className="auth-input-wrap">
                <LockKeyhole aria-hidden="true" />
                <input
                  id="reset-password-confirm"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            </div>

            {message && (
              <div
                className={`auth-message auth-message-${message.type}`}
                role={message.type === 'error' ? 'alert' : 'status'}
              >
                {message.type === 'error' ? <AlertCircle /> : <CheckCircle2 />}
                <span>{message.text}</span>
              </div>
            )}

            {message?.type === 'success' ? (
              <button
                type="button"
                className="auth-submit"
                onClick={() => navigate('/', { replace: true })}
              >
                Continue to dashboard
              </button>
            ) : (
              <button type="submit" className="auth-submit" disabled={submitting || loading}>
                {submitting ? <LoaderCircle className="animate-spin" /> : 'Update password'}
              </button>
            )}
          </form>
        )}
      </div>
    </AuthShell>
  );
};

export default ResetPassword;
