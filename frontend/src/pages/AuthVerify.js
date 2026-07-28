import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, LogIn } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../contexts/AuthContext';

const AuthVerify = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  return (
    <AuthShell>
      <div className="auth-status-block">
        <div className="auth-status-icon">
          <CheckCircle2 aria-hidden="true" />
        </div>
        <h2>{user ? 'Email confirmed' : 'Check your email'}</h2>
        <p>
          {loading
            ? 'Confirming your account...'
            : user
              ? 'Your CBAT Academy account is active and ready.'
              : 'Use the confirmation link in your inbox, then return here to sign in.'}
        </p>
        {!loading && (
          <div className="auth-status-actions">
            <button
              type="button"
              className="auth-submit"
              onClick={() => navigate(user ? '/' : '/auth', { replace: true })}
            >
              <span>{user ? 'Continue to dashboard' : 'Go to sign in'}</span>
              <LogIn aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </AuthShell>
  );
};

export default AuthVerify;
