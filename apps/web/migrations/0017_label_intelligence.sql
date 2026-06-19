-- 0017 — Label Intelligence (derivata dai dati, ricalcolata in automatico).
-- Additiva e nullable: zero impatto. Valorizzata dal job notturno.

-- Valori correnti per label (usati dal match e dal report).
ALTER TABLE labels ADD COLUMN IF NOT EXISTS generic_weight    real;     -- [0.6..1] smorza le label "generiche/centrali"
ALTER TABLE labels ADD COLUMN IF NOT EXISTS distinctiveness   real;     -- 0..1, quanto il suono è distinto dai vicini
ALTER TABLE labels ADD COLUMN IF NOT EXISTS match_reliable    boolean;  -- false = suono sfocato → match meno affidabile
ALTER TABLE labels ADD COLUMN IF NOT EXISTS nearest_label_id  uuid;     -- label più simile (info, NON fusione)
ALTER TABLE labels ADD COLUMN IF NOT EXISTS sound_family      text;     -- nome della famiglia di suono
ALTER TABLE labels ADD COLUMN IF NOT EXISTS intel_updated_at  timestamptz;

-- Storico: una "fotografia" per ogni run → in insights si vede come variano le cose.
CREATE TABLE IF NOT EXISTS label_intel_snapshots (
  id       uuid primary key default gen_random_uuid(),
  run_at   timestamptz not null default now(),
  payload  jsonb not null
);
CREATE INDEX IF NOT EXISTS label_intel_snapshots_run_idx ON label_intel_snapshots (run_at desc);
