-- Spotlight (tracce in evidenza sul profilo) + metadata estesi della traccia.
-- Eseguire nel SQL Editor di Supabase. Idempotente.

alter table public.artist_profiles
  add column if not exists spotlight uuid[] not null default '{}';

alter table public.user_submissions
  add column if not exists track_label  text,
  add column if not exists release_year integer,
  add column if not exists buy_url      text;
