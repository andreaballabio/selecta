-- ============================================================
-- SELECTA DATABASE SCHEMA v1.0 - Migration Safe
-- Production-grade schema for Label Intelligence System
-- Handles existing tables gracefully
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. LABELS TABLE
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'labels') THEN
        CREATE TABLE labels (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            slug text UNIQUE NOT NULL,
            genre_focus text[] DEFAULT '{}',
            temporal_weight float NOT NULL DEFAULT 0.85,
            stylistic_variance float NOT NULL DEFAULT 0.3,
            current_centroid vector(64),
            trend_direction vector(64),
            trend_magnitude float DEFAULT 0.0,
            total_tracks int DEFAULT 0,
            first_release_date date,
            last_release_date date,
            centroid_last_computed timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
    ELSE
        -- Add missing columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'genre_focus') THEN
            ALTER TABLE labels ADD COLUMN genre_focus text[] DEFAULT '{}';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'temporal_weight') THEN
            ALTER TABLE labels ADD COLUMN temporal_weight float NOT NULL DEFAULT 0.85;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'stylistic_variance') THEN
            ALTER TABLE labels ADD COLUMN stylistic_variance float NOT NULL DEFAULT 0.3;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'current_centroid') THEN
            ALTER TABLE labels ADD COLUMN current_centroid vector(64);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'trend_direction') THEN
            ALTER TABLE labels ADD COLUMN trend_direction vector(64);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'trend_magnitude') THEN
            ALTER TABLE labels ADD COLUMN trend_magnitude float DEFAULT 0.0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'total_tracks') THEN
            ALTER TABLE labels ADD COLUMN total_tracks int DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'first_release_date') THEN
            ALTER TABLE labels ADD COLUMN first_release_date date;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'last_release_date') THEN
            ALTER TABLE labels ADD COLUMN last_release_date date;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'centroid_last_computed') THEN
            ALTER TABLE labels ADD COLUMN centroid_last_computed timestamptz;
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_labels_slug ON labels(slug);
CREATE INDEX IF NOT EXISTS idx_labels_updated ON labels(updated_at);

-- ============================================================
-- 2. REFERENCE TRACKS
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reference_tracks') THEN
        CREATE TABLE reference_tracks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
            spotify_id text UNIQUE,
            youtube_id text,
            discogs_id text,
            title text NOT NULL,
            artist text NOT NULL,
            album text,
            release_date date NOT NULL,
            release_year int GENERATED ALWAYS AS (EXTRACT(YEAR FROM release_date)) STORED,
            bpm float,
            key text,
            scale text,
            energy float,
            embedding vector(64),
            features jsonb DEFAULT '{}',
            time_weight float DEFAULT 1.0,
            cluster_id text,
            source text DEFAULT 'spotify',
            preview_url text,
            preview_available boolean DEFAULT true,
            analysis_status text DEFAULT 'pending',
            analysis_error text,
            analyzed_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ref_tracks_label ON reference_tracks(label_id);
CREATE INDEX IF NOT EXISTS idx_ref_tracks_release ON reference_tracks(release_date);
CREATE INDEX IF NOT EXISTS idx_ref_tracks_year ON reference_tracks(release_year);
CREATE INDEX IF NOT EXISTS idx_ref_tracks_cluster ON reference_tracks(label_id, cluster_id);
CREATE INDEX IF NOT EXISTS idx_ref_tracks_status ON reference_tracks(analysis_status);
CREATE INDEX IF NOT EXISTS idx_ref_tracks_spotify ON reference_tracks(spotify_id) WHERE spotify_id IS NOT NULL;

-- Vector index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_ref_tracks_embedding'
    ) THEN
        CREATE INDEX idx_ref_tracks_embedding ON reference_tracks 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    END IF;
END $$;

-- ============================================================
-- 3. LABEL CLUSTERS
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'label_clusters') THEN
        CREATE TABLE label_clusters (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
            cluster_id text NOT NULL,
            centroid vector(64),
            track_count int DEFAULT 0,
            percentage float,
            avg_bpm float,
            avg_energy float,
            dominant_key text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE(label_id, cluster_id)
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_label_clusters_label ON label_clusters(label_id);

-- ============================================================
-- 4. LABEL SNAPSHOTS
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'label_snapshots') THEN
        CREATE TABLE label_snapshots (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
            snapshot_date date NOT NULL,
            centroid vector(64),
            dominant_clusters text[],
            bpm_range jsonb,
            key_distribution jsonb,
            energy_stats jsonb,
            trend_direction text,
            trend_magnitude float,
            created_at timestamptz NOT NULL DEFAULT now()
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_label_snapshots_label ON label_snapshots(label_id, snapshot_date);

-- ============================================================
-- 5. USER TRACKS (Update existing)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tracks') THEN
        -- Add missing columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tracks' AND column_name = 'embedding') THEN
            ALTER TABLE user_tracks ADD COLUMN embedding vector(64);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tracks' AND column_name = 'bpm') THEN
            ALTER TABLE user_tracks ADD COLUMN bpm float;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tracks' AND column_name = 'key') THEN
            ALTER TABLE user_tracks ADD COLUMN key text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tracks' AND column_name = 'scale') THEN
            ALTER TABLE user_tracks ADD COLUMN scale text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tracks' AND column_name = 'lufs') THEN
            ALTER TABLE user_tracks ADD COLUMN lufs float;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tracks' AND column_name = 'duration_seconds') THEN
            ALTER TABLE user_tracks ADD COLUMN duration_seconds float;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tracks' AND column_name = 'energy_curve') THEN
            ALTER TABLE user_tracks ADD COLUMN energy_curve float[];
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tracks' AND column_name = 'features') THEN
            ALTER TABLE user_tracks ADD COLUMN features jsonb DEFAULT '{}';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tracks' AND column_name = 'worker_job_id') THEN
            ALTER TABLE user_tracks ADD COLUMN worker_job_id text;
        END IF;
    END IF;
END $$;

-- Vector index for user tracks
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_user_tracks_embedding'
    ) THEN
        CREATE INDEX idx_user_tracks_embedding ON user_tracks 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 50);
    END IF;
END $$;

-- ============================================================
-- 6. LABEL MATCHES
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'label_matches') THEN
        CREATE TABLE label_matches (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            track_id uuid NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
            label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
            sound_match_score float NOT NULL,
            trend_alignment_score float NOT NULL,
            accessibility_score float NOT NULL,
            novelty_score float NOT NULL,
            saturation_penalty float NOT NULL,
            recency_boost float NOT NULL,
            final_probability float NOT NULL,
            rank int NOT NULL,
            match_reasoning text,
            strengths text[],
            weaknesses text[],
            improvement_suggestions text[],
            computed_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE(track_id, label_id)
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_label_matches_track ON label_matches(track_id);
CREATE INDEX IF NOT EXISTS idx_label_matches_label ON label_matches(label_id);
CREATE INDEX IF NOT EXISTS idx_label_matches_rank ON label_matches(track_id, rank);

-- ============================================================
-- 7. INGESTION QUEUE
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ingestion_queue') THEN
        CREATE TABLE ingestion_queue (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            job_type text NOT NULL,
            status text DEFAULT 'pending',
            label_id uuid REFERENCES labels(id),
            spotify_id text,
            payload jsonb DEFAULT '{}',
            attempts int DEFAULT 0,
            max_attempts int DEFAULT 3,
            last_error text,
            next_retry_at timestamptz,
            worker_id text,
            started_at timestamptz,
            completed_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ingestion_queue_status ON ingestion_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_label ON ingestion_queue(label_id) WHERE status = 'pending';

-- ============================================================
-- 8. SYSTEM CONFIG
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_config') THEN
        CREATE TABLE system_config (
            key text PRIMARY KEY,
            value jsonb NOT NULL,
            description text,
            updated_at timestamptz NOT NULL DEFAULT now()
        );
    END IF;
END $$;

-- Insert default config
INSERT INTO system_config (key, value, description) VALUES
('matching_weights', '{"sound_similarity": 0.35, "trend_alignment": 0.25, "accessibility": 0.10, "novelty": 0.10, "saturation": 0.10, "recency": 0.05, "artist_overlap": 0.05}', 'Pesi per il matching engine'),
('temporal_decay_half_life_days', '180', 'Giorni per half-life del decay temporale'),
('outlier_contamination', '0.05', 'Percentuale outlier da rimuovere'),
('min_preview_duration', '15', 'Secondi minimi preview valida'),
('max_preview_duration', '35', 'Secondi massimi preview valida')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers (safe to run multiple times)
DO $$
BEGIN
    -- Labels
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_labels_updated_at') THEN
        CREATE TRIGGER update_labels_updated_at BEFORE UPDATE ON labels
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Reference tracks
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_reference_tracks_updated_at') THEN
        CREATE TRIGGER update_reference_tracks_updated_at BEFORE UPDATE ON reference_tracks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Label clusters
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_label_clusters_updated_at') THEN
        CREATE TRIGGER update_label_clusters_updated_at BEFORE UPDATE ON label_clusters
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- User tracks
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_tracks_updated_at') THEN
        CREATE TRIGGER update_user_tracks_updated_at BEFORE UPDATE ON user_tracks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Label matches
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_label_matches_updated_at') THEN
        CREATE TRIGGER update_label_matches_updated_at BEFORE UPDATE ON label_matches
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Ingestion queue
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ingestion_queue_updated_at') THEN
        CREATE TRIGGER update_ingestion_queue_updated_at BEFORE UPDATE ON ingestion_queue
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- RLS POLICIES
-- ============================================================
-- Enable RLS
ALTER TABLE IF EXISTS user_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS label_matches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all" ON user_tracks;
DROP POLICY IF EXISTS "Allow all" ON label_matches;

-- Create policies
CREATE POLICY "Allow all" ON user_tracks FOR ALL USING (true);
CREATE POLICY "Allow all" ON label_matches FOR ALL USING (true);

-- ============================================================
-- SEED DATA
-- ============================================================
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
