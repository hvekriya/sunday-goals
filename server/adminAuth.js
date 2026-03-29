/**
 * Mutations that change data require header X-Admin-Password matching ADMIN_PASSWORD.
 * (Same password as POST /api/admin/verify — stored client-side in sessionStorage after unlock.)
 */
export function requireAdmin(req, res, next) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD not configured on server' });
  }
  const sent =
    req.headers['x-admin-password'] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : '');
  if (sent !== configured) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  next();
}
