/**
 * Vercel: default-exported Express app handles any path that is not a static file in `public/`.
 * Prefer this over `api/[[...slug]]` + serverless-http — those often mis-handle `req.url` → 404 on nested routes.
 * @see https://vercel.com/guides/using-express-with-vercel
 */
import app from './server/app.js';

export default app;
