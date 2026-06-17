-- FASE 1 — Layer di interazione tra utenti: follow tra artisti, salvataggi
-- ("in crate" / chi salverebbe la traccia), commenti, conteggi play/save/commenti.
-- I like esistono già (0004). Le letture pubbliche avvengono via SERVICE ROLE
-- lato server → niente policy di lettura pubblica, la RLS resta stretta.
--
-- Eseguire nel SQL Editor di Supabase. Idempotente.

-- 1) Contatori denormalizzati sulle tracce
alter table public.user_submissions
  add column if not exists play_count     integer not null default 0,
  add column if not exists saves_count    integer not null default 0,
  add column if not exists comments_count integer not null default 0;

-- 2) Follow tra artisti (social graph)
create table if not exists public.follows (
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists follows_follower_idx  on public.follows(follower_id);

alter table public.follows enable row level security;
drop policy if exists "own follows manageable" on public.follows;
create policy "own follows manageable"
  on public.follows for all
  to authenticated
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

-- 3) Salvataggi ("crate" del DJ — il segnale 'chi salverebbe/scaricherebbe')
create table if not exists public.track_saves (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.user_submissions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (submission_id, user_id)
);
create index if not exists track_saves_submission_idx on public.track_saves(submission_id);
create index if not exists track_saves_user_idx       on public.track_saves(user_id);

alter table public.track_saves enable row level security;
drop policy if exists "own saves manageable" on public.track_saves;
create policy "own saves manageable"
  on public.track_saves for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4) Commenti
create table if not exists public.track_comments (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.user_submissions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 600),
  created_at    timestamptz not null default now()
);
create index if not exists track_comments_submission_idx on public.track_comments(submission_id, created_at desc);

alter table public.track_comments enable row level security;
drop policy if exists "own comments manageable" on public.track_comments;
create policy "own comments manageable"
  on public.track_comments for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
