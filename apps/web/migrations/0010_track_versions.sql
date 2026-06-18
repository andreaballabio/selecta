-- Versioni multiple per traccia (Extended, Intro/Outro, Acapella, Clean, Dirty…).
-- Ogni versione è un file audio riproducibile. Mutazioni via API (service role +
-- verifica proprietà); letture pubbliche server-side via service role.
-- Eseguire nel SQL Editor di Supabase. Idempotente.

create table if not exists public.track_versions (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.user_submissions(id) on delete cascade,
  label         text not null check (char_length(label) between 1 and 60),
  file_url      text not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists track_versions_submission_idx on public.track_versions(submission_id, position);

alter table public.track_versions enable row level security;
-- Nessuna policy: accesso solo via service role (letture pubbliche server-side,
-- mutazioni dalle API con verifica di proprietà della traccia).
