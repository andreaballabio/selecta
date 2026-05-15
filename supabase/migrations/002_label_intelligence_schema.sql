-- ============================================================
-- SELECTA DATABASE SCHEMA v1.0
-- Production-grade schema for Label Intelligence System
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. LABELS TABLE
-- Core label profiles with temporal evolution tracking
-- ============================================================
CREATE TABLE labels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic info
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    genre_focus text[] DEFAULT '{}',
    
    -- Temporal evolution parameters
    temporal_weight float NOT NULL DEFAULT 0.85,  -- Decay factor (0.5 = 6mo half-life)
    stylistic_variance float NOT NULL DEFAULT 0.3, -- How much the label varies
    
    -- Current state (updated nightly)
    current_centroid vector(64),                    -- 64-dim embedding centroid
    trend_direction vector(64),                     -- Movement vector
    trend_magnitude float DEFAULT 0.0,              -- Speed of change
    
    -- Metadata
    total_tracks int DEFAULT 0,
    first_release_date date,
    last_release_date date,
    
    -- Analysis timestamps
    centroid_last_computed timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_labels_slug ON labels(slug);
CREATE INDEX idx_labels_updated ON labels(updated_at);

-- ============================================================
-- 2. REFERENCE TRACKS
-- Catalog tracks from labels (Spotify + other sources)
-- ============================================================
CREATE TABLE reference_tracks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    
    -- External IDs (source of truth hierarchy)
    spotify_id text UNIQUE,
    youtube_id text,
    discogs_id text,
    
    -- Core metadata
    title text NOT NULL,
    artist text NOT NULL,
    album text,
    
    -- Release info
    release_date date NOT NULL,
    release_year int GENERATED ALWAYS AS (EXTRACT(YEAR FROM release_date)) STORED,
    
    -- Audio features (extracted from preview)
    bpm float,
    key text,           -- C, C#, D, etc.
    scale text,         -- major, minor
    energy float,       -- 0-1 normalized
    
    -- Embeddings & features
    embedding vector(64),
    features jsonb DEFAULT '{}',  -- {spectral_centroid, rolloff, zcr, mfcc_mean, etc.}
    
    -- Temporal weighting (computed)
    time_weight float DEFAULT 1.0,
    
    -- Sub-cluster assignment
    cluster_id text,    -- 'peak_time', 'groovy', 'minimal', 'vocal', 'experimental'
    
    -- Source tracking
    source text DEFAULT 'spotify',  -- spotify, youtube, manual
    preview_url text,               -- 30s preview URL
    preview_available boolean DEFAULT true,
    
    -- Processing status
    analysis_status text DEFAULT 'pending',  -- pending, processing, completed, failed
    analysis_error text,
    
    -- Timestamps
    analyzed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ref_tracks_label ON reference_tracks(label_id);
CREATE INDEX idx_ref_tracks_release ON reference_tracks(release_date);
CREATE INDEX idx_ref_tracks_year ON reference_tracks(release_year);
CREATE INDEX idx_ref_tracks_cluster ON reference_tracks(label_id, cluster_id);
CREATE INDEX idx_ref_tracks_status ON reference_tracks(analysis_status);
CREATE INDEX idx_ref_tracks_spotify ON reference_tracks(spotify_id) WHERE spotify_id IS NOT NULL;

-- Vector similarity index (IVFFlat for 10k-100k vectors)
CREATE INDEX idx_ref_tracks_embedding ON reference_tracks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================================
-- 3. LABEL CLUSTERS
-- Sub-cluster centroids per label (peak-time, groovy, etc.)
-- ============================================================
CREATE TABLE label_clusters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    cluster_id text NOT NULL,  -- 'peak_time', 'groovy', 'minimal', 'vocal', 'experimental'
    
    -- Cluster stats
    centroid vector(64),
    track_count int DEFAULT 0,
    percentage float,  -- % of label catalog in this cluster
    
    -- Characteristic features of this cluster
    avg_bpm float,
    avg_energy float,
    dominant_key text,
    
    -- Temporal
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(label_id, cluster_id)
);

CREATE INDEX idx_label_clusters_label ON label_clusters(label_id);

-- ============================================================
-- 4. LABEL SNAPSHOTS
-- Historical snapshots for trend analysis
-- ============================================================
CREATE TABLE label_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    snapshot_date date NOT NULL,
    
    -- State at this point in time
    centroid vector(64),
    dominant_clusters text[],
    
    -- Feature distributions
    bpm_range jsonb,           -- {min, max, mean, std}
    key_distribution jsonb,    -- {C: 0.15, G: 0.20, ...}
    energy_stats jsonb,        -- {mean, variance}
    
    -- Trend classification
    trend_direction text,      -- 'stable', 'evolving', 'shifting'
    trend_magnitude float,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_label_snapshots_label ON label_snapshots(label_id, snapshot_date);

-- ============================================================
-- 5. USER TRACKS
-- Tracks uploaded by users for analysis
-- ============================================================
CREATE TABLE user_tracks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User (nullable for anonymous)
    user_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    
    -- Upload info
    title text NOT NULL,
    original_filename text,
    storage_path text NOT NULL,
    file_size_bytes bigint,
    file_format text,  -- mp3, wav, etc.
    
    -- Audio features (extracted)
    embedding vector(64),
    bpm float,
    key text,
    scale text,
    lufs float,              -- Loudness
    duration_seconds float,
    
    -- Detailed features
    energy_curve float[],    -- 100 points, normalized
    features jsonb DEFAULT '{}',  -- {spectral_centroid, rolloff, zcr, mfcc}
    
    -- Processing
    analysis_status text DEFAULT 'pending',  -- pending, processing, completed, failed
    analysis_error text,
    worker_job_id text,      -- For tracking async jobs
    
    -- Timestamps
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    analyzed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_tracks_user ON user_tracks(user_id);
CREATE INDEX idx_user_tracks_status ON user_tracks(analysis_status);
CREATE INDEX idx_user_tracks_uploaded ON user_tracks(uploaded_at);

-- Vector index for similarity search
CREATE INDEX idx_user_tracks_embedding ON user_tracks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);

-- ============================================================
-- 6. LABEL MATCHES
-- Results of matching user tracks against labels
-- ============================================================
CREATE TABLE label_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    track_id uuid NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
    label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    
    -- Scores (0-100)
    sound_match_score float NOT NULL,        -- Similarità embedding
    trend_alignment_score float NOT NULL,    -- Compatibilità direzione
    accessibility_score float NOT NULL,      -- Quanto è "pronta" la traccia
    novelty_score float NOT NULL,            -- Quanto è nuova ma non troppo
    saturation_penalty float NOT NULL,       -- Penalità se catalogo saturo
    recency_boost float NOT NULL,            -- Boost se label cerca questo sound
    
    -- Final score
    final_probability float NOT NULL,        -- 0-100
    rank int NOT NULL,                       -- 1, 2, 3...
    
    -- Detailed reasoning
    match_reasoning text,                    -- Spiegazione leggibile
    strengths text[],                        -- Array di punti di forza
    weaknesses text[],                       -- Array di criticità
    improvement_suggestions text[],          -- Consigli miglioramento
    
    -- Temporal
    computed_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(track_id, label_id)
);

CREATE INDEX idx_label_matches_track ON label_matches(track_id);
CREATE INDEX idx_label_matches_label ON label_matches(label_id);
CREATE INDEX idx_label_matches_rank ON label_matches(track_id, rank);

-- ============================================================
-- 7. INGESTION QUEUE
-- Pending ingestion jobs (Spotify, etc.)
-- ============================================================
CREATE TABLE ingestion_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Job info
    job_type text NOT NULL,        -- 'spotify_fetch', 'youtube_fetch', 'analysis'
    status text DEFAULT 'pending', -- pending, processing, completed, failed, retry
    
    -- Target
    label_id uuid REFERENCES labels(id),
    spotify_id text,
    
    -- Payload
    payload jsonb DEFAULT '{}',
    
    -- Retry logic
    attempts int DEFAULT 0,
    max_attempts int DEFAULT 3,
    last_error text,
    next_retry_at timestamptz,
    
    -- Processing
    worker_id text,                -- ID del worker che processa
    started_at timestamptz,
    completed_at timestamptz,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingestion_queue_status ON ingestion_queue(status, next_retry_at);
CREATE INDEX idx_ingestion_queue_label ON ingestion_queue(label_id) WHERE status = 'pending';

-- ============================================================
-- 8. SYSTEM CONFIG
-- Configuration and feature flags
-- ============================================================
CREATE TABLE system_config (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    description text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Default config
INSERT INTO system_config (key, value, description) VALUES
('matching_weights', '{"sound_similarity": 0.35, "trend_alignment": 0.25, "accessibility": 0.10, "novelty": 0.10, "saturation": 0.10, "recency": 0.05, "artist_overlap": 0.05}', 'Pesi per il matching engine'),
('temporal_decay_half_life_days', '180', 'Giorni per half-life del decay temporale'),
('outlier_contamination', '0.05', 'Percentuale outlier da rimuovere'),
('min_preview_duration', '15', 'Secondi minimi preview valida'),
('max_preview_duration', '35', 'Secondi massimi preview valida');

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
CREATE TRIGGER update_labels_updated_at BEFORE UPDATE ON labels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reference_tracks_updated_at BEFORE UPDATE ON reference_tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_label_clusters_updated_at BEFORE UPDATE ON label_clusters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tracks_updated_at BEFORE UPDATE ON user_tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_label_matches_updated_at BEFORE UPDATE ON label_matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingestion_queue_updated_at BEFORE UPDATE ON ingestion_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on sensitive tables
ALTER TABLE user_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_matches ENABLE ROW LEVEL SECURITY;

-- Policies (per ora aperte per testing)
CREATE POLICY "Allow all" ON user_tracks FOR ALL USING (true);
CREATE POLICY "Allow all" ON label_matches FOR ALL USING (true);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert sample labels (to be expanded)
INSERT INTO labels (name, slug, genre_focus) VALUES
('Solid Grooves Records', 'solid-grooves', ARRAY['tech house', 'groovy house']),
('Hot Creations', 'hot-creations', ARRAY['tech house', 'deep house']),
('Black Book Records', 'black-book', ARRAY['tech house', 'underground']),
('Toolroom', 'toolroom', ARRAY['tech house', 'house']),
('Defected', 'defected', ARRAY['house', 'tech house'])
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE labels IS 'Record label profiles with temporal evolution tracking';
COMMENT ON TABLE reference_tracks IS 'Catalog tracks from labels used for training the model';
COMMENT ON TABLE label_clusters IS 'Sub-cluster centroids (peak-time, groovy, minimal, etc.)';
COMMENT ON TABLE label_snapshots IS 'Historical snapshots for trend analysis';
COMMENT ON TABLE user_tracks IS 'Tracks uploaded by users for analysis';
COMMENT ON TABLE label_matches IS 'Results of matching user tracks against labels';
COMMENT ON TABLE ingestion_queue IS 'Pending jobs for data ingestion';
