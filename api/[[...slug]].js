/**
 * Vercel: all /api/* hits this function. The platform often forwards `req.url` without the `/api`
 * prefix (e.g. `/sessions/today`), while Express routes are registered as `/api/...` — fix before handling.
 */
import serverless from 'serverless-http';
import app from '../server/app.js';

export const config = {
  maxDuration: 60,
};

const handler = serverless(app);

function ensureExpressApiPath(req) {
  const raw = req.url || '/';
  const q = raw.indexOf('?');
  const pathOnly = q === -1 ? raw : raw.slice(0, q);
  const search = q === -1 ? '' : raw.slice(q);
  if (pathOnly === '/' || pathOnly.startsWith('/api')) return;
  const next = `/api${pathOnly}${search}`;
  req.url = next;
  if (typeof req.originalUrl === 'string' && !req.originalUrl.startsWith('/api')) {
    req.originalUrl = next;
  }
}

export default function vercelApi(req, res) {
  ensureExpressApiPath(req);
  return handler(req, res);
}
