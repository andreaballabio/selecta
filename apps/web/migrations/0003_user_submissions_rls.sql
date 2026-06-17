-- Sicurezza: abilita Row Level Security su user_submissions.
--
-- Stato attuale: senza RLS, chiunque abbia la anon key può leggere TUTTE le
-- analisi (incluse le demo anonime e quelle di altri utenti) → leak di privacy.
--
-- Modello dopo questa migration:
--   • Lettura: solo l'utente proprietario vede le PROPRIE analisi (Dashboard).
--   • Scritture e letture di sistema (match flow, status endpoint): avvengono con
--     la SERVICE ROLE key, che bypassa RLS → nessuna policy di insert necessaria.
--   • Press Kit pubblica: legge l'aggregato "Sound DNA" via service role lato
--     server (vedi src/app/u/[handle]/page.tsx), quindi NON serve lettura pubblica.
--
-- Eseguire nel SQL Editor di Supabase. Idempotente e sicuro: le analisi anonime
-- (user_id null) restano inseribili dal flusso match (service role).

alter table public.user_submissions enable row level security;

-- Lettura: solo le proprie analisi (alimenta la Dashboard utente).
drop policy if exists "own submissions readable" on public.user_submissions;
create policy "own submissions readable"
  on public.user_submissions for select
  to authenticated
  using (auth.uid() = user_id);
