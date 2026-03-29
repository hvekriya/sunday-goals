/**
 * Vercel: route all /api/* (and /api) to Express. Stops SPA rewrites from returning HTML for JSON endpoints.
 * @see https://vercel.com/docs/functions/routing
 */
import serverless from 'serverless-http';
import app from '../server/app.js';

export const config = {
  maxDuration: 60,
};

export default serverless(app);
