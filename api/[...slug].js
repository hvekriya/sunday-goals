/**
 * Dedicated Vercel function for /api/* (required catch-all: at least one segment after /api/).
 * Root `index.mjs` + static output often returns SPA HTML for /api → JSON parse errors.
 */
import serverless from 'serverless-http';
import app from '../server/app.js';

export const config = {
  maxDuration: 30,
};

const handler = serverless(app);

function ensureExpressApiPath(req) {
  let raw = req.url || '/';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      raw = u.pathname + u.search;
    } catch {
      /* keep raw */
    }
  }
  const q = raw.indexOf('?');
  const pathOnly = q === -1 ? raw : raw.slice(0, q);
  const search = q === -1 ? '' : raw.slice(q);

  if (pathOnly.startsWith('/api')) {
    req.url = pathOnly + search;
  } else if (pathOnly === '/' || pathOnly === '') {
    req.url = `/api${search}`;
  } else {
    const p = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    req.url = `/api${p}${search}`;
  }

  if (typeof req.originalUrl === 'string') {
    req.originalUrl = req.url;
  }
}

export default function vercelApi(req, res) {
  ensureExpressApiPath(req);
  return handler(req, res);
}
