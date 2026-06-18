-- Commenti temporizzati (ancorati a un punto della traccia) + Messaggi diretti.
-- Eseguire nel SQL Editor di Supabase. Idempotente.

-- 1) Posizione (secondi) per i commenti sulla waveform
alter table public.track_comments
  add column if not exists position_sec numeric;

-- 2) Messaggi diretti (DM)
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists messages_pair_idx on public.messages(sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_idx on public.messages(recipient_id, created_at desc);
create index if not exists messages_unread_idx on public.messages(recipient_id) where read_at is null;

alter table public.messages enable row level security;

-- Lettura: solo le conversazioni a cui partecipi.
drop policy if exists "read own messages" on public.messages;
create policy "read own messages" on public.messages for select
  to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Aggiornamento: il destinatario può segnare come letto.
drop policy if exists "recipient marks read" on public.messages;
create policy "recipient marks read" on public.messages for update
  to authenticated using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- L'invio avviene via API (service role) per generare anche la notifica.
