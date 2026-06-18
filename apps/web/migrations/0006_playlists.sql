-- Playlist (raccolte di tracce del catalogo). Le mutazioni passano dalle API
-- (service role + verifica proprietà); le letture pubbliche avvengono server-side
-- via service role. Eseguire nel SQL Editor di Supabase. Idempotente.

create table if not exists public.playlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  description text,
  cover_url   text,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists playlists_user_idx on public.playlists(user_id);
create index if not exists playlists_public_idx on public.playlists(is_public, updated_at desc);

create table if not exists public.playlist_tracks (
  playlist_id   uuid not null references public.playlists(id) on delete cascade,
  submission_id uuid not null references public.user_submissions(id) on delete cascade,
  position      integer not null default 0,
  added_at      timestamptz not null default now(),
  primary key (playlist_id, submission_id)
);
create index if not exists playlist_tracks_playlist_idx on public.playlist_tracks(playlist_id, position);

-- RLS: il proprietario gestisce/legge le proprie playlist; le tracce della
-- playlist sono accessibili solo via service role (mutazioni dalle API).
alter table public.playlists enable row level security;
drop policy if exists "own playlists" on public.playlists;
create policy "own playlists" on public.playlists for all
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.playlist_tracks enable row level security;
