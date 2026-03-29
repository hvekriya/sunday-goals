-- Optional DiceBear seed override (same curated style as avatar_pick, different face from text).
alter table public.players add column if not exists avatar_seed text;

comment on column public.players.avatar_seed is 'Optional DiceBear seed; null uses preset seed for the resolved style index.';
