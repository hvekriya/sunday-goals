import { getAnonClient, createUserClient } from './supabaseClient.js';

export function extractBearer(req) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7).trim();
  return '';
}

/**
 * Validate JWT and that the user is listed in public.app_admins.
 * @returns {Promise<{ user: import('@supabase/supabase-js').User, supabaseAdmin: import('@supabase/supabase-js').SupabaseClient }>}
 */
export async function verifySupabaseAdmin(accessToken) {
  if (!accessToken) {
    const err = new Error('Missing token');
    err.statusCode = 401;
    throw err;
  }

  const anon = getAnonClient();
  const { data: userData, error: userErr } = await anon.auth.getUser(accessToken);
  if (userErr || !userData?.user) {
    const err = new Error(userErr?.message || 'Invalid session');
    err.statusCode = 401;
    throw err;
  }

  const user = userData.user;
  const supabaseAdmin = createUserClient(accessToken);
  const { data: row, error: adminErr } = await supabaseAdmin
    .from('app_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminErr) {
    const err = new Error(adminErr.message || 'Admin check failed');
    err.statusCode = 403;
    throw err;
  }
  if (!row) {
    const err = new Error('Not an administrator');
    err.statusCode = 403;
    throw err;
  }

  return { user, supabaseAdmin };
}

/**
 * Express middleware: requires Authorization: Bearer <access_token> for a user in app_admins.
 * Sets req.adminUser and req.supabaseAdmin.
 */
export function requireSupabaseAdmin(req, res, next) {
  (async () => {
    try {
      const token = extractBearer(req);
      const { user, supabaseAdmin } = await verifySupabaseAdmin(token);
      req.adminUser = user;
      req.supabaseAdmin = supabaseAdmin;
      next();
    } catch (e) {
      const code = e.statusCode || 401;
      if (code === 403) {
        res.status(403).json({ error: e.message || 'Forbidden' });
        return;
      }
      res.status(401).json({ error: e.message || 'Authentication required' });
    }
  })();
}
