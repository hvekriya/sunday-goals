import { supabaseBrowser } from './supabaseBrowser';

/** Authorization header for mutating /api/* routes (Supabase Auth access token). */
export async function adminAuthHeaders() {
  if (!supabaseBrowser) return {};
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

/** Sync React state with /api/admin/me (user must be in public.app_admins). */
export async function refreshAdminFromApi(setIsAdmin) {
  if (!supabaseBrowser) {
    setIsAdmin(false);
    return;
  }
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  if (!session?.access_token) {
    setIsAdmin(false);
    return;
  }
  try {
    const r = await fetch('/api/admin/me', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const j = await r.json();
    setIsAdmin(!!j.admin);
  } catch {
    setIsAdmin(false);
  }
}

export async function signInAdmin(email, password) {
  if (!supabaseBrowser) {
    return {
      ok: false,
      error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check the client env.',
    };
  }
  const { data, error } = await supabaseBrowser.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, error: error.message };
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'No session returned.' };
  const r = await fetch('/api/admin/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.admin) {
    await supabaseBrowser.auth.signOut();
    return {
      ok: false,
      error:
        r.ok && !j.admin
          ? 'This account is not registered as an app admin.'
          : 'Could not verify admin status.',
    };
  }
  return { ok: true };
}

export async function signOutAdmin() {
  await supabaseBrowser?.auth.signOut();
}
