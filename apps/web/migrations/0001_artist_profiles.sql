-- Press Kit / pagina artista — tabella profili
-- Eseguire nel SQL Editor di Supabase.
-- Ogni profilo è legato a un utente (auth.users). Lettura PUBBLICA (la press
-- kit è condivisibile), scrittura solo del proprietario.

create table if not exists public.artist_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  handle            text not null unique,          -- usato nell'URL /u/<handle>
  display_name      text not null default '',
  tagline           text default '',               -- es. "Melodic techno from Berlin"
  city              text default '',
  genres            text[] default '{}',           -- es. {techno, tech house}
  bpm_range         text default '',               -- es. "126-130"
  photo_url         text default '',
  bio               text default '',
  links             jsonb default '{}'::jsonb,     -- {spotify, soundcloud, beatport, instagram}
  contact_email     text default '',
  sound_descriptors text[] default '{}',           -- es. {ipnotico, percussivo, dark}
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists artist_profiles_user_id_idx on public.artist_profiles(user_id);

alter table public.artist_profiles enable row level security;

-- Chiunque può vedere una press kit (pagina pubblica)
drop policy if exists "artist_profiles public read" on public.artist_profiles;
create policy "artist_profiles public read"
  on public.artist_profiles for select
  using (true);

-- Solo il proprietario può creare/modificare/eliminare il proprio profilo
drop policy if exists "artist_profiles owner insert" on public.artist_profiles;
create policy "artist_profiles owner insert"
  on public.artist_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "artist_profiles owner update" on public.artist_profiles;
create policy "artist_profiles owner update"
  on public.artist_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "artist_profiles owner delete" on public.artist_profiles;
create policy "artist_profiles owner delete"
  on public.artist_profiles for delete
  using (auth.uid() = user_id);

-- handle: minuscolo, solo lettere/numeri/trattini (validazione lato app comunque)
