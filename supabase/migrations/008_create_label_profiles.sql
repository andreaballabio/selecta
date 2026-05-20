CREATE TABLE IF NOT EXISTS label_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Audio aggregato
  avg_energy FLOAT,
  avg_lufs FLOAT,
  avg_spectral_centroid FLOAT,
  avg_spectral_rolloff FLOAT,
  avg_zero_crossing_rate FLOAT,
  avg_onset_strength FLOAT,
  avg_sub_ratio FLOAT,
  avg_mid_presence FLOAT,
  avg_tempo_stability FLOAT,

  -- Deviazione standard (coerenza stilistica della label)
  std_sub_ratio FLOAT,
  std_onset_strength FLOAT,
  std_spectral_centroid FLOAT,

  -- Embedding medio (per cosine similarity)
  avg_embedding VECTOR(64),

  -- Metadati
  analyzed_tracks_count INT DEFAULT 0,
  confidence_score FLOAT DEFAULT 0.0, -- 0.0 → 1.0

  UNIQUE(label_id)
);

-- Indice per cosine similarity
CREATE INDEX IF NOT EXISTS label_profiles_embedding_idx
  ON label_profiles
  USING ivfflat (avg_embedding vector_cosine_ops)
  WITH (lists = 10);
