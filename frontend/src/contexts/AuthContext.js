import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchAttempts, syncAttempts } from '../services/cloudAttempts';
import { getHistory, mergeHistory } from '../utils/storage';

const AuthContext = createContext(null);

const authRedirect = (path) => `${window.location.origin}${path}`;

const configurationError = () => ({
  message: 'CBAT Academy authentication is not configured on this device.'
});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const lastSyncedUserId = useRef(null);

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error) setProfile(data);
    return { data, error };
  }, []);

  const synchronizeHistory = useCallback(async (userId) => {
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const upload = await syncAttempts(getHistory(), userId);
      if (upload.error) throw upload.error;

      const remote = await fetchAttempts(userId);
      if (remote.error) throw remote.error;

      mergeHistory(remote.attempts);
      setSyncStatus('synced');
    } catch (error) {
      setSyncStatus('unavailable');
      setSyncError(error.message);
    }
  }, []);

  const prepareUser = useCallback((currentUser) => {
    if (!currentUser) {
      setProfile(null);
      setSyncStatus('idle');
      setSyncError(null);
      lastSyncedUserId.current = null;
      return;
    }

    void loadProfile(currentUser.id);
    if (lastSyncedUserId.current !== currentUser.id) {
      lastSyncedUserId.current = currentUser.id;
      void synchronizeHistory(currentUser.id);
    }
  }, [loadProfile, synchronizeHistory]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setLoading(false);
        return;
      }

      setSession(data.session);
      setUser(data.session?.user || null);
      prepareUser(data.session?.user || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setUser(nextSession?.user || null);
        setLoading(false);

        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }

        prepareUser(nextSession?.user || null);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [prepareUser]);

  const signUp = useCallback(async ({ email, password, displayName }) => {
    if (!isSupabaseConfigured) return { data: null, error: configurationError() };
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authRedirect('/auth/verify'),
        data: { display_name: displayName }
      }
    });
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!isSupabaseConfigured) return { data: null, error: configurationError() };
    return supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return { error: configurationError() };
    const result = await supabase.auth.signOut();
    setIsPasswordRecovery(false);
    return result;
  }, []);

  const resendConfirmation = useCallback(async (email) => {
    if (!isSupabaseConfigured) return { data: null, error: configurationError() };
    return supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: authRedirect('/auth/verify')
      }
    });
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    if (!isSupabaseConfigured) return { data: null, error: configurationError() };
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirect('/auth/reset-password')
    });
  }, []);

  const updatePassword = useCallback(async (password) => {
    if (!isSupabaseConfigured) return { data: null, error: configurationError() };
    const result = await supabase.auth.updateUser({ password });
    if (!result.error) setIsPasswordRecovery(false);
    return result;
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) return { data: null, error: { message: 'You are not signed in.' } };

    const values = {
      id: user.id,
      display_name: updates.displayName || null,
      target_criteria: updates.targetCriteria || null,
      target_role: updates.targetRole || null
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(values)
      .select()
      .single();

    if (!error) {
      setProfile(data);
      await supabase.auth.updateUser({
        data: { display_name: values.display_name }
      });
    }

    return { data, error };
  }, [user]);

  const retrySync = useCallback(() => {
    if (user) void synchronizeHistory(user.id);
  }, [synchronizeHistory, user]);

  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    syncStatus,
    syncError,
    isPasswordRecovery,
    isConfigured: isSupabaseConfigured,
    signUp,
    signIn,
    signOut,
    resendConfirmation,
    requestPasswordReset,
    updatePassword,
    updateProfile,
    retrySync
  }), [
    session,
    user,
    profile,
    loading,
    syncStatus,
    syncError,
    isPasswordRecovery,
    signUp,
    signIn,
    signOut,
    resendConfirmation,
    requestPasswordReset,
    updatePassword,
    updateProfile,
    retrySync
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
