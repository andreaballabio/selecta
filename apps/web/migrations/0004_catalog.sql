-- FASE 0 — "Vetrina curata": catalogo pubblico delle tracce che il producer
-- sceglie di pubblicare (solo originali, consenso esplicito). Stream + like.
-- Niente download/pagamenti (quelli sono Fase 2, vedi SOCIAL_CATALOG_PLAN.md).
--
-- Le letture pubbliche del catalogo avvengono via SERVICE ROLE lato server
-- (server components / API), quindi NON serve una policy di lettura pubblica su
-- user_submissions: la RLS resta "owner-only" (migration 0003) + qui aggiungiamo
-- solo i campi di pubblicazione e la tabella dei like.
--
-- Eseguire nel SQL Editor di Supabase. Idempotente.

-- 1) Campi di pubblicazione sulle analisi
alter table public.user_submissions
  add column if not exists published      boolean     not null default false,
  add column if not exists published_at   timestamptz,
  add column if not exists display_title  text,
  add column if not exists display_artist text,
  add column if not exists cover_url      text,
  add column if not exists genre          text,
  add column if not exists sound_bucket   text,
  add column if not exists likes_count    integer     not null default 0;

create index if not exists user_submissions_published_idx
  on public.user_submissions(published, published_at desc);
create index if not exists user_submissions_bucket_idx
  on public.user_submissions(sound_bucket) where published = true;

-- 2) Like (uno per utente per traccia)
create table if not exists public.track_likes (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.user_submissions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (submission_id, user_id)
);

create index if not exists track_likes_submission_idx on public.track_likes(submission_id);
create index if not exists track_likes_user_idx       on public.track_likes(user_id);

-- RLS: ognuno gestisce SOLO i propri like (il conteggio pubblico è denormalizzato
-- in user_submissions.likes_count e aggiornato via service role).
alter table public.track_likes enable row level security;

drop policy if exists "own likes manageable" on public.track_likes;
create policy "own likes manageable"
  on public.track_likes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
