-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- LABELS TABLE
-- ============================================
CREATE TABLE labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    website_url VARCHAR(500),
    demo_submission_url VARCHAR(500),
    primary_genre VARCHAR(100) NOT NULL DEFAULT 'tech house',
    secondary_genres TEXT[],
    bpm_min INTEGER CHECK (bpm_min >= 60 AND bpm_min <= 200),
    bpm_max INTEGER CHECK (bpm_max >= 60 AND bpm_max <= 200),
    typical_key_signatures TEXT[],
    audio_embedding vector(128),
    avg_energy_mean FLOAT CHECK (avg_energy_mean >= 0 AND avg_energy_mean <= 1),
    avg_energy_variance FLOAT CHECK (avg_energy_variance >= 0 AND avg_energy_variance <= 1),
    commercial_score FLOAT CHECK (commercial_score >= 0 AND commercial_score <= 1),
    underground_score FLOAT CHECK (underground_score >= 0 AND underground_score <= 1),
    target_artist_level VARCHAR(50) CHECK (target_artist_level IN ('emerging', 'mid', 'top', 'established', 'all')),
    estimated_monthly_releases INTEGER,
    years_active INTEGER,
    spotify_followers INTEGER,
    beatport_label_page_url VARCHAR(500),
    accepts_unsolicited_demos BOOLEAN DEFAULT true,
    response_time_days_avg INTEGER,
    signing_rate_estimate FLOAT CHECK (signing_rate_estimate >= 0 AND signing_rate_estimate <= 1),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT bpm_range_check CHECK (bpm_min <= bpm_max)
);

CREATE INDEX idx_labels_embedding ON labels USING ivfflat (audio_embedding vector_cosine_ops);

-- ============================================
-- REFERENCE TRACKS
-- ============================================
CREATE TABLE reference_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    artist VARCHAR(500) NOT NULL,
    spotify_id VARCHAR(100),
    beatport_id VARCHAR(100),
    isrc VARCHAR(50),
    release_date DATE,
    catalog_number VARCHAR(100),
    bpm FLOAT,
    key VARCHAR(10),
    scale VARCHAR(10) CHECK (scale IN ('major', 'minor', 'unknown')),
    duration_seconds FLOAT,
    lufs FLOAT,
    audio_embedding vector(128),
    energy_curve JSONB,
    features JSONB,
    source VARCHAR(50) CHECK (source IN ('spotify', 'beatport', 'manual_upload', 'label_submission')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_reference_tracks_spotify_unique ON reference_tracks(label_id, spotify_id) WHERE spotify_id IS NOT NULL;
CREATE INDEX idx_reference_tracks_label ON reference_tracks(label_id);
CREATE INDEX idx_reference_tracks_embedding ON reference_tracks USING ivfflat (audio_embedding vector_cosine_ops);

-- ============================================
-- USER PROFILES
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    bio TEXT,
    artist_name VARCHAR(255),
    location VARCHAR(255),
    website_url VARCHAR(500),
    spotify_artist_url VARCHAR(500),
    soundcloud_url VARCHAR(500),
    career_level VARCHAR(50) CHECK (career_level IN ('beginner', 'emerging', 'mid', 'established', 'professional')),
    years_producing INTEGER,
    releases_count INTEGER DEFAULT 0,
    primary_genres TEXT[],
    favorite_labels UUID[], -- Array di label IDs (no FK constraint su array)
    subscription_tier VARCHAR(50) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'studio')),
    subscription_expires_at TIMESTAMPTZ,
    monthly_analysis_quota INTEGER DEFAULT 3,
    monthly_analysis_used INTEGER DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_career_level ON profiles(career_level);
CREATE INDEX idx_profiles_subscription ON profiles(subscription_tier);

-- ============================================
-- USER TRACKS
-- ============================================
CREATE TABLE user_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    is_instrumental BOOLEAN DEFAULT true,
    description TEXT,
    storage_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    file_format VARCHAR(10) CHECK (file_format IN ('wav', 'mp3', 'aiff', 'flac')),
    bpm FLOAT,
    key VARCHAR(10),
    scale VARCHAR(10),
    duration_seconds FLOAT,
    lufs FLOAT,
    audio_embedding vector(128),
    energy_curve JSONB,
    features JSONB,
    analysis_status VARCHAR(50) DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
    analysis_error TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ
);

CREATE INDEX idx_user_tracks_user ON user_tracks(user_id);
CREATE INDEX idx_user_tracks_status ON user_tracks(analysis_status);
CREATE INDEX idx_user_tracks_embedding ON user_tracks USING ivfflat (audio_embedding vector_cosine_ops);

-- ============================================
-- ANALYSIS RESULTS
-- ============================================
CREATE TABLE analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    overall_quality_score FLOAT CHECK (overall_quality_score >= 0 AND overall_quality_score <= 100),
    production_readiness FLOAT CHECK (production_readiness >= 0 AND production_readiness <= 100),
    ar_feedback TEXT,
    strengths TEXT[],
    weaknesses TEXT[],
    recommended_genre VARCHAR(100),
    commercial_potential FLOAT CHECK (commercial_potential >= 0 AND commercial_potential <= 100),
    underground_credibility FLOAT CHECK (underground_credibility >= 0 AND underground_credibility <= 100),
    analysis_version VARCHAR(50) DEFAULT '1.0.0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(track_id)
);

CREATE INDEX idx_analysis_results_track ON analysis_results(track_id);
CREATE INDEX idx_analysis_results_user ON analysis_results(user_id);

-- ============================================
-- LABEL MATCHES
-- ============================================
CREATE TABLE label_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    sound_match_score FLOAT NOT NULL CHECK (sound_match_score >= 0 AND sound_match_score <= 100),
    accessibility_score FLOAT NOT NULL CHECK (accessibility_score >= 0 AND accessibility_score <= 100),
    trend_alignment_score FLOAT NOT NULL CHECK (trend_alignment_score >= 0 AND trend_alignment_score <= 100),
    final_probability FLOAT NOT NULL CHECK (final_probability >= 0 AND final_probability <= 100),
    match_reasoning TEXT,
    rank INTEGER NOT NULL,
    fit_analysis TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(track_id, label_id)
);

CREATE INDEX idx_label_matches_track ON label_matches(track_id);
CREATE INDEX idx_label_matches_label ON label_matches(label_id);
CREATE INDEX idx_label_matches_probability ON label_matches(final_probability DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_labels_updated_at BEFORE UPDATE ON labels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tracks_updated_at BEFORE UPDATE ON user_tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own tracks" ON user_tracks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create tracks" ON user_tracks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracks" ON user_tracks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracks" ON user_tracks
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own analysis" ON analysis_results
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own matches" ON label_matches
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM user_tracks WHERE id = label_matches.track_id AND user_id = auth.uid()
    ));

ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Labels are viewable by all authenticated users" ON labels
    FOR SELECT TO authenticated USING (true);

-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO labels (name, slug, description, primary_genre, bpm_min, bpm_max, target_artist_level, commercial_score, underground_score, demo_submission_url, is_active) VALUES 
('Solid Grooves Records', 'solid-grooves', 'Premium tech house label focused on club-ready grooves and underground sounds.', 'tech house', 123, 128, 'mid', 0.6, 0.9, 'https://solidgroovesrecords.com/demo', true),
('Hot Creations', 'hot-creations', 'Legendary label founded by Jamie Jones and Lee Foss.', 'tech house', 120, 126, 'top', 0.75, 0.65, 'https://hotcreations.com/submit', true),
('Black Book Records', 'black-book', 'Chris Lake''s imprint for cutting-edge tech house.', 'tech house', 124, 130, 'emerging', 0.5, 0.9, 'https://blackbookrecords.com/demos', true),
('Toolroom Records', 'toolroom', 'One of the most influential dance labels globally.', 'tech house', 124, 128, 'mid', 0.85, 0.35, 'https://toolroomrecords.com/demos', true),
('Defected Records', 'defected', 'House music institution.', 'house', 122, 126, 'top', 0.95, 0.25, 'https://defected.com/submit', true),
('Sola', 'sola', 'Solardo''s label. Peak-time tech house.', 'tech house', 125, 130, 'mid', 0.7, 0.6, 'https://solamusic.uk/demo', true),
('Repopulate Mars', 'repopulate-mars', 'Lee Foss label focusing on leftfield tech house.', 'tech house', 123, 128, 'emerging', 0.55, 0.85, 'https://repopulatemars.com/submit', true),
('Locus', 'locus', 'Andrea Oliva''s imprint. Minimal-leaning tech house.', 'minimal/tech house', 124, 128, 'emerging', 0.4, 0.9, 'https://locusmusic.net/demos', true);
