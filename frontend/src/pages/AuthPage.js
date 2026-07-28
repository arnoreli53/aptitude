import React, { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound
} from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../contexts/AuthContext';
import { LOGIN, REGISTER } from '../constants/testIds/auth';

const passwordScore = (password) => [
  password.length >= 8,
  /[a-z]/.test(password) && /[A-Z]/.test(password),
  /\d/.test(password),
  /[^A-Za-z0-9]/.test(password)
].filter(Boolean).length;

const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    loading,
    isConfigured,
    signUp,
    signIn,
    requestPasswordReset
  } = useAuth();
  const [view, setView] = useState('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const strength = useMemo(() => passwordScore(password), [password]);
  const returnTo = location.state?.from?.pathname || '/';

  if (loading) {
    return (
      <AuthShell>
        <div className="auth-status-block">
          <div className="auth-status-icon">
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          </div>
          <h2>Loading your account</h2>
          <p>Restoring your CBAT Academy session...</p>
        </div>
      </AuthShell>
    );
  }

  if (!loading && user) {
    return <Navigate to={returnTo} replace />;
  }

  const changeView = (nextView) => {
    setView(nextView);
    setMessage(null);
    setPassword('');
    setPasswordConfirm('');
  };

  const validateSignUp = () => {
    if (!displayName.trim()) return 'Enter your name.';
    if (password.length < 8) return 'Use at least 8 characters for your password.';
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return 'Include uppercase, lowercase, and a number in your password.';
    }
    if (password !== passwordConfirm) return 'The passwords do not match.';
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!isConfigured) {
      setMessage({ type: 'error', text: 'Supabase is not configured for this build.' });
      return;
    }

    if (view === 'signup') {
      const validationError = validateSignUp();
      if (validationError) {
        setMessage({ type: 'error', text: validationError });
        return;
      }
    }

    setSubmitting(true);

    if (view === 'forgot') {
      const { error } = await requestPasswordReset(email.trim());
      setSubmitting(false);
      setMessage(error
        ? { type: 'error', text: error.message }
        : {
            type: 'success',
            text: 'Check your inbox for a secure password reset link.'
          });
      return;
    }

    if (view === 'signup') {
      const { data, error } = await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim()
      });
      setSubmitting(false);

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else if (data.session) {
        navigate('/', { replace: true });
      } else {
        setMessage({
          type: 'success',
          text: `We sent a confirmation link to ${email.trim()}. Confirm your email to activate your account.`
        });
      }
      return;
    }

    const { error } = await signIn({
      email: email.trim(),
      password
    });
    setSubmitting(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      navigate(returnTo, { replace: true });
    }
  };

  const isSignup = view === 'signup';
  const isForgot = view === 'forgot';

  return (
    <AuthShell>
      <div className="auth-form-wrap">
        <div className="auth-form-heading">
          <h2>
            {isForgot ? 'Reset your password' : isSignup ? 'Create your account' : 'Welcome back'}
          </h2>
          <p>
            {isForgot
              ? 'Enter the email address connected to your account.'
              : isSignup
                ? 'Create a private training record for CBAT Academy.'
                : 'Sign in to continue your training record.'}
          </p>
        </div>

        {!isForgot && (
          <div className="auth-segmented" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              data-testid={REGISTER.registerLink}
              onClick={() => changeView('signup')}
            >
              Create account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              data-testid={LOGIN.registerLink}
              onClick={() => changeView('signin')}
            >
              Sign in
            </button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <div className="auth-field">
              <label htmlFor="auth-name">Name</label>
              <div className="auth-input-wrap">
                <UserRound aria-hidden="true" />
                <input
                  id="auth-name"
                  className="auth-input"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  data-testid={REGISTER.nameInput}
                  required
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <div className="auth-input-wrap">
              <Mail aria-hidden="true" />
              <input
                id="auth-email"
                className="auth-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                data-testid={isSignup ? REGISTER.emailInput : LOGIN.emailInput}
                required
              />
            </div>
          </div>

          {!isForgot && (
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-input-wrap">
                <LockKeyhole aria-hidden="true" />
                <input
                  id="auth-password"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  data-testid={isSignup ? REGISTER.passwordInput : LOGIN.passwordInput}
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
              {isSignup && (
                <>
                  <div className="auth-password-meter" aria-hidden="true">
                    {[1, 2, 3, 4].map((level) => (
                      <span key={level} className={strength >= level ? 'is-active' : ''} />
                    ))}
                  </div>
                  <p className="auth-field-hint">
                    Use 8 or more characters with uppercase, lowercase, and a number.
                  </p>
                </>
              )}
            </div>
          )}

          {isSignup && (
            <div className="auth-field">
              <label htmlFor="auth-password-confirm">Confirm password</label>
              <div className="auth-input-wrap">
                <LockKeyhole aria-hidden="true" />
                <input
                  id="auth-password-confirm"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  data-testid={REGISTER.passwordConfirmInput}
                  required
                />
              </div>
            </div>
          )}

          {!isSignup && !isForgot && (
            <div className="auth-form-row">
              <button
                type="button"
                className="auth-text-button"
                data-testid={LOGIN.forgotPasswordLink}
                onClick={() => changeView('forgot')}
              >
                Forgot password?
              </button>
            </div>
          )}

          {message && (
            <div
              className={`auth-message auth-message-${message.type}`}
              role={message.type === 'error' ? 'alert' : 'status'}
            >
              {message.type === 'error' ? <AlertCircle /> : <CheckCircle2 />}
              <span>{message.text}</span>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={submitting}
            data-testid={isSignup ? REGISTER.submitButton : LOGIN.submitButton}
          >
            {submitting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <>
                <span>
                  {isForgot ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in'}
                </span>
                <ArrowRight />
              </>
            )}
          </button>

          {isForgot && (
            <button
              type="button"
              className="auth-text-button"
              onClick={() => changeView('signin')}
            >
              Return to sign in
            </button>
          )}
        </form>
      </div>
    </AuthShell>
  );
};

export default AuthPage;
