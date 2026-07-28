import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  LoaderCircle,
  RefreshCw,
  Save,
  UserRound
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Account.css';

const Account = () => {
  const {
    user,
    profile,
    syncStatus,
    updateProfile,
    retrySync
  } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [targetCriteria, setTargetCriteria] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setDisplayName(
      profile?.display_name || user?.user_metadata?.display_name || ''
    );
    setTargetCriteria(profile?.target_criteria || '');
    setTargetRole(profile?.target_role || '');
  }, [profile, user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await updateProfile({
      displayName: displayName.trim(),
      targetCriteria,
      targetRole: targetRole.trim()
    });

    setSaving(false);
    setMessage(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'Account preferences saved.' });
  };

  const syncCopy = {
    syncing: ['Synchronizing scores', 'Your training history is being updated.'],
    synced: ['Scores synchronized', 'Your training history is saved to this account.'],
    unavailable: ['Scores saved locally', 'Cloud synchronization is not ready. Your scores remain on this device.'],
    idle: ['Waiting to synchronize', 'Score synchronization will begin automatically.']
  }[syncStatus] || ['Waiting to synchronize', 'Score synchronization will begin automatically.'];

  return (
    <main className="account-page">
      <div className="account-content">
        <div className="account-heading">
          <div>
            <span className="account-kicker">CBAT Academy</span>
            <h1>Account</h1>
            <p>Manage your training profile and score synchronization.</p>
          </div>
          <div className="account-avatar" aria-hidden="true">
            <UserRound />
          </div>
        </div>

        <section className="account-panel" aria-labelledby="profile-heading">
          <div className="account-panel-title">
            <div>
              <h2 id="profile-heading">Training profile</h2>
              <p>{user?.email}</p>
            </div>
            <span className="account-verified">
              <CheckCircle2 aria-hidden="true" />
              {user?.email_confirmed_at ? 'Email verified' : 'Email active'}
            </span>
          </div>

          <form className="account-form" onSubmit={handleSubmit}>
            <div className="account-field">
              <label htmlFor="account-display-name">Display name</label>
              <input
                id="account-display-name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>

            <div className="account-field">
              <label htmlFor="account-target-criteria">Target selection process</label>
              <select
                id="account-target-criteria"
                value={targetCriteria}
                onChange={(event) => setTargetCriteria(event.target.value)}
              >
                <option value="">Not selected</option>
                <option value="raf-cbat">RAF CBAT</option>
                <option value="royal-navy-fat">Royal Navy FAT / CBAT</option>
                <option value="rcaf-cfast">RCAF CFAST</option>
                <option value="other">Other aviation selection</option>
              </select>
            </div>

            <div className="account-field account-field-wide">
              <label htmlFor="account-target-role">Target role</label>
              <input
                id="account-target-role"
                type="text"
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                placeholder="For example: Pilot"
              />
            </div>

            {message && (
              <div
                className={`account-message account-message-${message.type}`}
                role={message.type === 'error' ? 'alert' : 'status'}
              >
                {message.type === 'error' ? <AlertCircle /> : <CheckCircle2 />}
                <span>{message.text}</span>
              </div>
            )}

            <div className="account-actions">
              <button type="submit" className="account-primary-button" disabled={saving}>
                {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
                <span>{saving ? 'Saving' : 'Save profile'}</span>
              </button>
            </div>
          </form>
        </section>

        <section className="account-sync-panel" aria-labelledby="sync-heading">
          <div className={`account-sync-icon account-sync-${syncStatus}`}>
            {syncStatus === 'syncing' ? <LoaderCircle className="animate-spin" /> : <Cloud />}
          </div>
          <div>
            <h2 id="sync-heading">{syncCopy[0]}</h2>
            <p>{syncCopy[1]}</p>
          </div>
          {syncStatus === 'unavailable' && (
            <button
              type="button"
              className="account-icon-button"
              onClick={retrySync}
              title="Retry score synchronization"
              aria-label="Retry score synchronization"
            >
              <RefreshCw />
            </button>
          )}
        </section>
      </div>
    </main>
  );
};

export default Account;
