import { nanoid } from 'nanoid';

const sessions = new Map();

export function saveSession(teams) {
  const slug = nanoid(10);
  const session = {
    slug,
    date: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    teams,
  };
  sessions.set(slug, session);
  return slug;
}

export function getSessionBySlug(slug) {
  return sessions.get(slug) || null;
}
