-- 0014 — versione dello spazio embedding (correttezza del matching)
-- Additiva e nullable: zero impatto su dati/analisi esistenti.
-- Serve a confrontare col coseno SOLO vettori dello stesso modello: EffNet
-- (neurale) e "v6" (hand-crafted) vivono in spazi diversi e non sono confrontabili.
-- Il worker la valorizza dalle prossime analisi ('effnet' | 'v6' | 'librosa').
-- Le righe vecchie restano NULL → trattate come compatibili (nessuna regressione).

ALTER TABLE label_ingestion_queue ADD COLUMN IF NOT EXISTS embedding_version text;
ALTER TABLE user_submissions       ADD COLUMN IF NOT EXISTS embedding_version text;

CREATE INDEX IF NOT EXISTS label_ingestion_queue_embver_idx
  ON label_ingestion_queue (embedding_version);
