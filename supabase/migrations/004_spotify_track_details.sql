-- Migration 004: Aggiungi dettagli completi Spotify per tracce
-- Permette di vedere e verificare i match Spotify

-- ============================================================
-- AGGIUNGI COLONNE DETTAGLI SPOTIFY
-- ============================================================
DO $$
BEGIN
    -- Titolo effettivo su Spotify
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'spotify_track_name') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN spotify_track_name VARCHAR(255);
    END IF;
    
    -- Artista effettivo su Spotify
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'spotify_artist_name') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN spotify_artist_name VARCHAR(255);
    END IF;
    
    -- URL diretto a Spotify
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'spotify_url') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN spotify_url TEXT;
    END IF;
    
    -- Album su Spotify
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'spotify_album_name') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN spotify_album_name VARCHAR(255);
    END IF;
    
    -- Immagine album
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'spotify_album_image') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN spotify_album_image TEXT;
    END IF;
    
    -- Durata in ms
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'spotify_duration_ms') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN spotify_duration_ms INT;
    END IF;
    
    -- Popolarità (0-100)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'spotify_popularity') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN spotify_popularity INT;
    END IF;
END $$;

-- Aggiungi indici per ricerca
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_spotify_id ON label_ingestion_queue(spotify_track_id) WHERE spotify_track_id IS NOT NULL;

-- Aggiungi tabella per tracciare modifiche manuali
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'track_match_history') THEN
        CREATE TABLE track_match_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            track_id UUID NOT NULL REFERENCES label_ingestion_queue(id) ON DELETE CASCADE,
            
            -- Vecchi valori
            old_spotify_track_id VARCHAR(100),
            old_spotify_track_name VARCHAR(255),
            old_confidence FLOAT,
            
            -- Nuovi valori
            new_spotify_track_id VARCHAR(100),
            new_spotify_track_name VARCHAR(255),
            new_confidence FLOAT,
            
            -- Motivo modifica
            change_reason VARCHAR(50), -- 'manual_correction', 'auto_retry', 'user_verified'
            notes TEXT,
            
            -- Chi ha modificato
            changed_by UUID REFERENCES auth.users(id),
            
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX idx_match_history_track ON track_match_history(track_id);
    END IF;
END $$;
