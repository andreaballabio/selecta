-- 0018 — Founding Members + impostazioni app configurabili dall'admin.
-- Eseguire nel SQL Editor di Supabase. Idempotente.

-- Config generiche key/value (riusabile). Solo service role (niente policy).
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

-- Chi è Founding Member (per conteggio + badge). Gestita via service role.
create table if not exists public.founding_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.founding_members enable row level security;
