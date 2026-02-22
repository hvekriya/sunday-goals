-- Run this once in your Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists team_sessions (
  slug        text primary key,
  date        text not null,
  created_at  timestamptz not null default now(),
  teams       jsonb not null
  -- teams is an array of { id, name, players: [{ id, name, ranking, points, paid?, image? }] }
  -- paid status is stored directly inside each player object in the jsonb
);

-- Optional: auto-delete sessions older than 30 days to keep the table tidy
-- (requires pg_cron extension — enable it in Supabase Dashboard → Extensions)
-- select cron.schedule('delete-old-sessions', '0 3 * * *',
--   $$delete from team_sessions where created_at < now() - interval '30 days'$$);
