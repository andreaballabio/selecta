ALTER TABLE label_ingestion_queue
  ADD COLUMN IF NOT EXISTS onset_strength FLOAT,
  ADD COLUMN IF NOT EXISTS sub_ratio FLOAT,
  ADD COLUMN IF NOT EXISTS mid_presence FLOAT,
  ADD COLUMN IF NOT EXISTS tempo_stability FLOAT;
