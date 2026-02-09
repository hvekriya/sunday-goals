import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createBalancedTeams } from './teams.js';
import { fetchPlayersFromSheet } from './sheets.js';
import { getSessionBySlug, saveSession } from './sessions.js';

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
    const slug = await saveSession(teams);
    res.json({ teams, slug });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to generate teams' });
  }
});

// API: get session by slug (for shared URL)
app.get('/api/teams/:slug', (req, res) => {
  const session = getSessionBySlug(req.params.slug);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
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
