-- URL-friendly profile paths: /player/<slug>. Run after 001_players.sql.

alter table public.players add column if not exists slug text;

-- One slug per player (multiple NULL allowed until backfill runs).
create unique index if not exists players_slug_unique on public.players (slug);

-- Slugs are filled by the API on first roster load (backfill) or on create/update.
