-- DJ pool / monetizzazione — STRUTTURA con pagamenti SIMULATI (provider 'fake').
-- Da sostituire con Stripe in futuro: cambia solo l'API /api/billing/*.
-- Eseguire nel SQL Editor di Supabase. Idempotente.

-- Abbonamenti (uno per utente)
create table if not exists public.subscriptions (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  tier         text not null,                         -- 'dj-pool' | 'producer-pro' | 'label'
  status       text not null default 'active',        -- 'active' | 'canceled'
  provider     text not null default 'fake',
  activated_at timestamptz not null default now(),
  expires_at   timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "own subscription read" on public.subscriptions;
create policy "own subscription read" on public.subscriptions for select
  to authenticated using (auth.uid() = user_id);
-- Le scritture avvengono via API (service role): attivazione/cancellazione.

-- Cronologia download
create table if not exists public.downloads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  submission_id uuid references public.user_submissions(id) on delete set null,
  version_id    uuid references public.track_versions(id) on delete set null,
  label         text,
  created_at    timestamptz not null default now()
);
create index if not exists downloads_user_idx on public.downloads(user_id, created_at desc);
alter table public.downloads enable row level security;
drop policy if exists "own downloads read" on public.downloads;
create policy "own downloads read" on public.downloads for select
  to authenticated using (auth.uid() = user_id);
