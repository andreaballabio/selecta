-- 0015 — Loop di esito degli invii (invio → risposta → firma).
-- Ogni evento è dato proprietario: nel tempo permette di predire l'accettazione
-- REALE, non solo l'affinità di suono. Additiva: nessun impatto sull'esistente.
-- Eseguire nel SQL Editor di Supabase. Idempotente.

create table if not exists public.submission_outcomes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  submission_id uuid references public.user_submissions(id) on delete set null, -- la traccia analizzata
  label_id      uuid,        -- label nel nostro DB (se presente)
  label_name    text,        -- nome label (denormalizzato; anche per label fuori dal nostro DB)
  status        text not null default 'sent'
                check (status in ('sent','no_reply','rejected','interested','signed')),
  note          text check (note is null or char_length(note) <= 600),
  sent_at       timestamptz not null default now(),
  responded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists submission_outcomes_user_idx   on public.submission_outcomes(user_id, created_at desc);
create index if not exists submission_outcomes_sub_idx    on public.submission_outcomes(submission_id);
create index if not exists submission_outcomes_status_idx on public.submission_outcomes(status);

alter table public.submission_outcomes enable row level security;
drop policy if exists "own outcomes manageable" on public.submission_outcomes;
create policy "own outcomes manageable"
  on public.submission_outcomes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
