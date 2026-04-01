/**
 * Standalone check: can this machine reach Supabase with your .env?
 * Run from project root: npm run check:supabase
 */
import './load-env.js';
import { Agent, fetch as undiciFetch } from 'undici';

const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
const key = process.env.SUPABASE_ANON_KEY?.trim();

function chain(err, indent = '') {
  if (!err) return '';
  let s = `${indent}${err.message || err}${err.code ? ` [${err.code}]` : ''}${err.syscall ? ` syscall=${err.syscall}` : ''}\n`;
  if (err.cause) s += chain(err.cause, `${indent}  cause: `);
  return s;
}

async function tryFetch(name, doFetch) {
  const testUrl = `${url}/rest/v1/team_sessions?select=slug&limit=1`;
  process.stdout.write(`\n--- ${name} ---\nGET ${testUrl}\n`);
  try {
    const res = await doFetch(testUrl);
    const text = await res.text();
    process.stdout.write(`Status: ${res.status} ${res.statusText}\n`);
    if (!res.ok) process.stdout.write(`Body (first 500 chars): ${text.slice(0, 500)}\n`);
    else process.stdout.write('OK — Supabase REST responded.\n');
  } catch (err) {
    process.stdout.write(`FAILED:\n${chain(err)}`);
  }
}

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env (project root).');
  process.exit(1);
}

console.log('SUPABASE_URL host:', new URL(url).host);

const ipv4Agent = new Agent({ connect: { family: 4 } });
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
};

await tryFetch('Undici fetch + IPv4 agent', (u) =>
  undiciFetch(u, { headers, dispatcher: ipv4Agent }),
);

await tryFetch('Node global fetch (default DNS / stack)', (u) => globalThis.fetch(u, { headers }));
