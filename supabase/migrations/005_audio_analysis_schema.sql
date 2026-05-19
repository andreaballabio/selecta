-- Migration 005: Aggiungi analisi audio alle tracce
-- Salva risultati analisi dal worker

DO $$
BEGIN
    -- Stato analisi audio
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'analysis_status') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN analysis_status VARCHAR(50) DEFAULT 'pending';
    END IF;
    
    -- BPM
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'bpm') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN bpm FLOAT;
    END IF;
    
    -- Key (tonalità)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'key') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN key VARCHAR(10);
    END IF;
    
    -- Scala (major/minor)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'scale') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN scale VARCHAR(10);
    END IF;
    
    -- Energia
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'energy') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN energy FLOAT;
    END IF;
    
    -- LUFS (loudness)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'lufs') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN lufs FLOAT;
    END IF;
    
    -- Durata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'duration') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN duration FLOAT;
    END IF;
    
    -- Embedding audio (64 dimensioni)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'audio_embedding') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN audio_embedding FLOAT[];
    END IF;
    
    -- Errori analisi
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'analysis_error') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN analysis_error TEXT;
    END IF;
    
    -- Timestamp analisi
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'label_ingestion_queue' AND column_name = 'analyzed_at') THEN
        ALTER TABLE label_ingestion_queue ADD COLUMN analyzed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Indice per tracce pronte all'analisi
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_analysis ON label_ingestion_queue(analysis_status) 
WHERE analysis_status = 'pending' AND status = 'matched';

-- Indice per tracce già analizzate
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_analyzed ON label_ingestion_queue(analysis_status) 
WHERE analysis_status = 'analyzed';
