import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createBalancedTeams } from './teams.js';
import { fetchPlayersFromSheet } from './sheets.js';
import { getSessionBySlug, saveSession, getRecentSessions, updatePaidStatus, updateTeams, getSessionForToday } from './sessions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
const distPath = join(__dirname, '../client/dist');
try {
  const { accessSync } = await import('fs');
  accessSync(distPath);
  app.use(express.static(distPath));
} catch {
  // dev mode: no dist yet
}

// API: verify admin password
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD not configured on server' });
  }
  if (password === process.env.ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// API: fetch players from Google Sheet (proxy to avoid CORS)
app.get('/api/players', async (req, res) => {
  const { spreadsheetId, sheetName = 'Sheet1' } = req.query;
  if (!spreadsheetId) {
    return res.status(400).json({ error: 'spreadsheetId is required' });
  }
  try {
    const players = await fetchPlayersFromSheet(spreadsheetId, sheetName);
    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch sheet' });
  }
});

// API: generate teams and create shareable session
app.post('/api/teams', async (req, res) => {
  const { players, numTeams: raw } = req.body;
  const numTeams = Math.max(1, Math.min(20, parseInt(raw, 10) || 2));
  if (!Array.isArray(players)) {
    return res.status(400).json({ error: 'players array required' });
  }
  try {
    const teams = createBalancedTeams(players, numTeams);
    const { slug, replaced } = await saveSession(teams);
    res.json({ teams, slug, replaced });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to generate teams' });
  }
});

// API: today's session (if any)
app.get('/api/sessions/today', async (req, res) => {
  try {
    const session = await getSessionForToday();
    res.json(session || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load today\'s session' });
  }
});

// API: recent sessions (history)
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await getRecentSessions(20);
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load sessions' });
  }
});

// API: update full teams array after drag-and-drop reorder
app.patch('/api/teams/:slug/players', async (req, res) => {
  const { teams } = req.body;
  if (!Array.isArray(teams)) {
    return res.status(400).json({ error: 'teams array required' });
  }
  try {
    await updateTeams(req.params.slug, teams);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update teams' });
  }
});

// API: update paid status for a player in a session
app.patch('/api/teams/:slug/paid', async (req, res) => {
  const { teamId, playerId, paid } = req.body;
  if (!teamId || !playerId || typeof paid !== 'boolean') {
    return res.status(400).json({ error: 'teamId, playerId and paid (boolean) required' });
  }
  try {
    await updatePaidStatus(req.params.slug, teamId, playerId, paid);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update paid status' });
  }
});

// API: get session by slug (for shared URL)
app.get('/api/teams/:slug', async (req, res) => {
  try {
    const session = await getSessionBySlug(req.params.slug);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load session' });
  }
});

// SPA fallback (only if we're serving static)
try {
  const { accessSync } = await import('fs');
  accessSync(join(distPath, 'index.html'));
  app.get('*', (_, res) => {
    res.sendFile(join(__dirname, '../client/dist/index.html'));
  });
} catch {}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
