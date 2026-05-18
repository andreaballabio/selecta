-- Migration 003: Label Ingestion System
-- Aggiunge supporto per ingestion automatica da Discogs/YouTube

-- ============================================================
-- 1. AGGIUNGI COLONNE A LABELS
-- ============================================================
DO $$
BEGIN
    -- Colonna per tracciare la fonte (discogs, youtube, manual)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'source') THEN
        ALTER TABLE labels ADD COLUMN source VARCHAR(50) DEFAULT 'manual';
    END IF;
    
    -- ID esterno (Discogs ID o YouTube Channel ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'external_id') THEN
        ALTER TABLE labels ADD COLUMN external_id VARCHAR(100);
    END IF;
    
    -- URL del profilo (Discogs o YouTube)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'profile_url') THEN
        ALTER TABLE labels ADD COLUMN profile_url TEXT;
    END IF;
    
    -- Ultima sincronizzazione
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'last_sync_at') THEN
        ALTER TABLE labels ADD COLUMN last_sync_at TIMESTAMPTZ;
    END IF;
    
    -- Stato ingestion
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'ingestion_status') THEN
        ALTER TABLE labels ADD COLUMN ingestion_status VARCHAR(50) DEFAULT 'pending';
    END IF;
    
    -- Totale tracce catalogate
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'cataloged_tracks') THEN
        ALTER TABLE labels ADD COLUMN cataloged_tracks INT DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_labels_source ON labels(source);
CREATE INDEX IF NOT EXISTS idx_labels_external_id ON labels(external_id);
CREATE INDEX IF NOT EXISTS idx_labels_ingestion_status ON labels(ingestion_status);

-- ============================================================
-- 2. TABELLA INGESTION QUEUE (per tracce in attesa di matching)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'label_ingestion_queue') THEN
        CREATE TABLE label_ingestion_queue (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
            
            -- Metadata traccia
            track_title VARCHAR(255) NOT NULL,
            artist_name VARCHAR(255) NOT NULL,
            release_year INT,
            album_name VARCHAR(255),
            catalog_number VARCHAR(100),
            
            -- Fonte
            source VARCHAR(50) NOT NULL, -- 'discogs', 'youtube'
            source_id VARCHAR(100), -- ID su Discogs o YouTube
            source_url TEXT,
            
            -- Stato
            status VARCHAR(50) DEFAULT 'pending', -- pending, matched, needs_review, failed, skipped
            
            -- Matching Spotify
            spotify_track_id VARCHAR(100),
            spotify_preview_url TEXT,
            spotify_match_confidence FLOAT, -- 0-1
            
            -- Per review manuale
            suggested_matches JSONB, -- Array di possibili match da Spotify
            review_notes TEXT,
            reviewed_by UUID REFERENCES auth.users(id),
            reviewed_at TIMESTAMPTZ,
            
            -- Tentativi
            attempts INT DEFAULT 0,
            max_attempts INT DEFAULT 3,
            last_error TEXT,
            
            -- Timestamp
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        -- Indici
        CREATE INDEX idx_ingestion_queue_label ON label_ingestion_queue(label_id);
        CREATE INDEX idx_ingestion_queue_status ON label_ingestion_queue(status);
        CREATE INDEX idx_ingestion_queue_confidence ON label_ingestion_queue(spotify_match_confidence) WHERE status = 'needs_review';
        CREATE INDEX idx_ingestion_queue_artist_title ON label_ingestion_queue(artist_name, track_title);
        
        -- Trigger per updated_at
        CREATE TRIGGER update_ingestion_queue_updated_at 
        BEFORE UPDATE ON label_ingestion_queue 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 3. COMMENTI
-- ============================================================
COMMENT ON TABLE label_ingestion_queue IS 'Coda di tracce estratte da label in attesa di matching con Spotify';
COMMENT ON COLUMN label_ingestion_queue.status IS 'pending: appena inserita, matched: match sicuro trovato, needs_review: match incerto, failed: nessun match, skipped: scartata da admin';
COMMENT ON COLUMN label_ingestion_queue.spotify_match_confidence IS 'Punteggio 0-1 del matching automatico, >0.9 = sicuro, 0.5-0.9 = da verificare';
