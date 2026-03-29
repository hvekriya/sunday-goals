-- Optional cartoon avatar index (0..N-1) from app curated DiceBear presets; null = use deterministic default from player id.
alter table public.players add column if not exists avatar_pick integer;

comment on column public.players.avatar_pick is 'Index into curated cartoon presets; null means auto pick from player id.';
