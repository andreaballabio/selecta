-- Segnalazioni tracce (copyright/abuso) + moderazione. Le scritture passano dalle
-- API (service role); lette solo dall'admin. Eseguire nel SQL Editor. Idempotente.

create table if not exists public.track_reports (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.user_submissions(id) on delete cascade,
  reporter_id   uuid references auth.users(id) on delete set null,
  reason        text not null,
  details       text,
  resolved      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists track_reports_open_idx on public.track_reports(resolved, created_at desc);
create index if not exists track_reports_submission_idx on public.track_reports(submission_id);

alter table public.track_reports enable row level security;
-- Nessuna policy: accesso solo via service role (insert via /api/report, lettura admin).
