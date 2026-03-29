-- Run in Supabase SQL Editor (or supabase db push). Requires pgcrypto for gen_random_uuid() (enabled by default on Supabase).

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ranking text not null default 'Unranked',
  image_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_name_idx on public.players (name);

-- team_sessions: if you do not have it yet, uncomment:
-- create table if not exists public.team_sessions (
--   slug text primary key,
--   date text not null,
--   created_at timestamptz not null default now(),
--   teams jsonb not null,
--   player_pool jsonb not null default '[]'
-- );
