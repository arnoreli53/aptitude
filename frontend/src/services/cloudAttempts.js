import { supabase, isSupabaseConfigured } from '../lib/supabase';

const toCloudAttempt = (attempt, userId) => ({
  user_id: userId,
  client_attempt_id: String(attempt.id),
  module_name: attempt.moduleName,
  mode: attempt.mode || null,
  difficulty: attempt.difficulty || null,
  accuracy: attempt.accuracy !== null
    && attempt.accuracy !== undefined
    && Number.isFinite(Number(attempt.accuracy))
    ? Number(attempt.accuracy)
    : null,
  result: attempt,
  completed_at: attempt.timestamp || new Date().toISOString()
});

const fromCloudAttempt = (row) => ({
  ...(row.result || {}),
  id: row.client_attempt_id,
  moduleName: row.module_name,
  mode: row.mode,
  difficulty: row.difficulty,
  ...(row.accuracy !== null ? { accuracy: Number(row.accuracy) } : {}),
  timestamp: row.completed_at
});

const getSessionUser = async () => {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
};

export const syncAttempt = async (attempt, explicitUserId = null) => {
  const userId = explicitUserId || (await getSessionUser())?.id;
  if (!userId) return { skipped: true };

  const { error } = await supabase
    .from('attempts')
    .upsert(toCloudAttempt(attempt, userId), {
      onConflict: 'user_id,client_attempt_id'
    });

  return { error: error || null };
};

export const syncAttempts = async (attempts, userId) => {
  if (!userId || attempts.length === 0) return { error: null };

  const rows = attempts.map((attempt) => toCloudAttempt(attempt, userId));
  const { error } = await supabase
    .from('attempts')
    .upsert(rows, {
      onConflict: 'user_id,client_attempt_id'
    });

  return { error: error || null };
};

export const fetchAttempts = async (userId) => {
  if (!userId) return { attempts: [], error: null };

  const { data, error } = await supabase
    .from('attempts')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: true })
    .limit(5000);

  return {
    attempts: (data || []).map(fromCloudAttempt),
    error: error || null
  };
};

export const deleteAttempts = async (moduleName = null) => {
  const user = await getSessionUser();
  if (!user) return { skipped: true };

  let query = supabase
    .from('attempts')
    .delete()
    .eq('user_id', user.id);

  if (moduleName) {
    query = query.eq('module_name', moduleName);
  }

  const { error } = await query;
  return { error: error || null };
};
