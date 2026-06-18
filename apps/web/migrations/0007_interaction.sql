-- Repost, feed e notifiche. Eseguire nel SQL Editor di Supabase. Idempotente.

alter table public.user_submissions
  add column if not exists reposts_count integer not null default 0;

-- Repost (ricondividi ai tuoi follower → alimenta il feed)
create table if not exists public.reposts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  submission_id uuid not null references public.user_submissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (user_id, submission_id)
);
create index if not exists reposts_user_idx on public.reposts(user_id, created_at desc);
create index if not exists reposts_submission_idx on public.reposts(submission_id);

alter table public.reposts enable row level security;
drop policy if exists "own reposts" on public.reposts;
create policy "own reposts" on public.reposts for all
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notifiche (like / follow / comment / repost). Inserite via service role dalle API.
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  actor_id      uuid references auth.users(id) on delete set null,
  type          text not null,
  submission_id uuid references public.user_submissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(recipient_id) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications for select
  to authenticated using (auth.uid() = recipient_id);
drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications update" on public.notifications for update
  to authenticated using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
