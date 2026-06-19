-- 0016 — Check tecnici "da A&R" sulle tracce analizzate (Report v2).
-- Additiva e nullable: zero impatto. Valorizzati dal worker (campo per campo)
-- dalle prossime analisi; le tracce vecchie restano NULL (report mostra "in arrivo").

ALTER TABLE user_submissions ADD COLUMN IF NOT EXISTS true_peak_dbtp     real; -- >0 = clipping inter-sample
ALTER TABLE user_submissions ADD COLUMN IF NOT EXISTS crest_db           real; -- punch / compressione
ALTER TABLE user_submissions ADD COLUMN IF NOT EXISTS stereo_correlation real; -- compatibilità mono (1=mono, <0=cancella)
ALTER TABLE user_submissions ADD COLUMN IF NOT EXISTS loopiness          real; -- 0..1, alto = "loop che non evolve"
ALTER TABLE user_submissions ADD COLUMN IF NOT EXISTS intro_build        real; -- l'energia sale nei primi ~30s?
