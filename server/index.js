import './load-env.js';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createBalancedTeams } from './teams.js';
import {
  getSessionBySlug,
  saveSession,
  getRecentSessions,
  updatePaidStatus,
  updateTeams,
  getSessionForToday,
  listAllSessions,
  getAppearancesForPlayer,
} from './sessions.js';
import {
  listRosterPlayers,
  getRosterPlayerBySlugOrId,
  createRosterPlayer,
  updateRosterPlayer,
  deleteRosterPlayer,
  updateRosterPlayerCartoon,
} from './playersRepo.js';
import { requireAdmin } from './adminAuth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const distPath = join(__dirname, '../client/dist');
let distExists = false;
try {
  const { accessSync } = await import('fs');
  accessSync(distPath);
  accessSync(join(distPath, 'index.html'));
  distExists = true;
} catch {
  // dev mode: no dist yet
}

// Register all /api routes BEFORE static + SPA fallback so HTML is never served for API paths.
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

/** Roster from database (public read). */
app.get('/api/roster', async (req, res) => {
  try {
    const players = await listRosterPlayers();
    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load roster' });
  }
});

app.get('/api/roster/:key/history', async (req, res) => {
  try {
    const player = await getRosterPlayerBySlugOrId(req.params.key);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    const appearances = await getAppearancesForPlayer(player.id);
    res.json({ player, appearances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load history' });
  }
});

app.get('/api/roster/:key', async (req, res) => {
  try {
    const player = await getRosterPlayerBySlugOrId(req.params.key);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load player' });
  }
});

/** Curated cartoon (preset index) and/or DiceBear seed; no auth — same as public roster semantics. */
app.patch('/api/roster/:id/cartoon', async (req, res) => {
  try {
    if (!('pick' in req.body) && !('seed' in req.body)) {
      return res.status(400).json({
        error: 'JSON body must include pick (number or null) and/or seed (string or null)',
      });
    }
    const player = await updateRosterPlayerCartoon(req.params.id, req.body);
    res.json(player);
  } catch (err) {
    console.error(err);
    const status = /not found/i.test(err.message) ? 404 : 400;
    res.status(status).json({ error: err.message || 'Failed to update cartoon' });
  }
});

app.post('/api/roster', requireAdmin, async (req, res) => {
  try {
    const { name, ranking, notes } = req.body;
    const player = await createRosterPlayer({ name, ranking, notes });
    res.status(201).json(player);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to create player' });
  }
});

app.patch('/api/roster/:id', requireAdmin, async (req, res) => {
  try {
    const player = await updateRosterPlayer(req.params.id, req.body);
    res.json(player);
  } catch (err) {
    console.error(err);
    const status = /not found/i.test(err.message) ? 404 : 400;
    res.status(status).json({ error: err.message || 'Failed to update player' });
  }
});

app.delete('/api/roster/:id', requireAdmin, async (req, res) => {
  try {
    await deleteRosterPlayer(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to delete player' });
  }
});

app.post('/api/teams', requireAdmin, async (req, res) => {
  const { players, numTeams: raw, playerPool } = req.body;
  const numTeams = Math.max(1, Math.min(20, parseInt(raw, 10) || 2));
  if (!Array.isArray(players)) {
    return res.status(400).json({ error: 'players array required' });
  }
  try {
    const teams = createBalancedTeams(players, numTeams);
    const { slug, replaced } = await saveSession(teams, playerPool);
    res.json({ teams, slug, replaced, playerPool: Array.isArray(playerPool) ? playerPool : [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to generate teams' });
  }
});

app.get('/api/sessions/today', async (req, res) => {
  try {
    const session = await getSessionForToday();
    res.json(session || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load today\'s session' });
  }
});

/** All sessions including today (newest first) — must be before /api/sessions so "browse" is not captured as a filter. */
app.get('/api/sessions/browse', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const sessions = await listAllSessions(limit);
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load sessions' });
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await getRecentSessions(20);
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load sessions' });
  }
});

app.patch('/api/teams/:slug/players', requireAdmin, async (req, res) => {
  const { teams, playerPool } = req.body;
  if (!Array.isArray(teams)) {
    return res.status(400).json({ error: 'teams array required' });
  }
  try {
    await updateTeams(req.params.slug, teams, playerPool);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update teams' });
  }
});

app.patch('/api/teams/:slug/paid', requireAdmin, async (req, res) => {
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

if (distExists) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(404).type('text').send('Not found');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
