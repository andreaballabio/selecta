-- Migration 006: Fix analysis_status per tracce esistenti
-- Imposta 'pending' per tutte le tracce matched senza analysis

UPDATE label_ingestion_queue 
SET analysis_status = 'pending'
WHERE status = 'matched' 
  AND (analysis_status IS NULL OR analysis_status = '');

-- Verifica
SELECT 
  status,
  analysis_status,
  COUNT(*) as count
FROM label_ingestion_queue
GROUP BY status, analysis_status;
