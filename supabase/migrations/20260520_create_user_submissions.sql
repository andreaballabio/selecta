CREATE TABLE IF NOT EXISTS user_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT,
  artist TEXT,
  file_url TEXT NOT NULL,
  track_status TEXT DEFAULT 'unknown',  -- 'demo'|'mixed'|'mastered'|'unknown'
  analysis_status TEXT DEFAULT 'pending', -- 'pending'|'analyzing'|'analyzed'|'failed'

  -- Audio features (same schema as label_ingestion_queue)
  bpm FLOAT,
  key TEXT,
  scale TEXT,
  energy FLOAT,
  lufs FLOAT,
  duration FLOAT,
  spectral_centroid FLOAT,
  spectral_rolloff FLOAT,
  zero_crossing_rate FLOAT,
  onset_strength FLOAT,
  sub_ratio FLOAT,
  mid_presence FLOAT,
  tempo_stability FLOAT,
  spectral_contrast FLOAT,
  audio_embedding VECTOR(64),

  -- Matching results: top 5 labels with score and feedback
  match_results JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_submissions_user_id_idx
  ON user_submissions (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_submissions_status_idx
  ON user_submissions (analysis_status);
