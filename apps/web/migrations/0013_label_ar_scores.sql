-- 0013 — A&R: punteggi calcolati per label (reachability/openness) + metadati derivati
-- Additiva e nullable: nessun impatto su tabelle esistenti né sull'analisi in corso.

ALTER TABLE labels ADD COLUMN IF NOT EXISTS reference_artists   text[];      -- artisti più rappresentati (derivato)
ALTER TABLE labels ADD COLUMN IF NOT EXISTS last_release_date   date;        -- ultima uscita (derivato dal catalogo)
ALTER TABLE labels ADD COLUMN IF NOT EXISTS reachability_score  int;         -- 0-100, quanto è realistico farsi firmare
ALTER TABLE labels ADD COLUMN IF NOT EXISTS openness_score      int;         -- 0-100, quanto firma gente nuova
ALTER TABLE labels ADD COLUMN IF NOT EXISTS release_cadence_12mo int;        -- uscite negli ultimi 12 mesi
ALTER TABLE labels ADD COLUMN IF NOT EXISTS scores_updated_at   timestamptz; -- ultimo ricalcolo

-- Nota: i campi "curati a mano" esistono già su labels:
--   accepts_unsolicited_demos (bool) · demo_submission_url · website_url
--   target_artist_level · response_time_days_avg · estimated_monthly_releases
