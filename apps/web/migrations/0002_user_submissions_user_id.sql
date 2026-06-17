-- Lega le analisi (user_submissions) all'utente loggato, così la Press Kit può
-- auto-popolarsi col "sound DNA" reale dell'artista.
-- Eseguire nel SQL Editor di Supabase.
-- Additivo e sicuro: la colonna è nullable → le analisi anonime restano possibili
-- (il match resta il gancio gratuito, senza login obbligatorio).

alter table public.user_submissions
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists user_submissions_user_id_idx
  on public.user_submissions(user_id);
