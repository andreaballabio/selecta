-- Aggiungi colonna spectral_contrast alla tabella label_profiles
ALTER TABLE label_profiles
  ADD COLUMN IF NOT EXISTS avg_spectral_contrast FLOAT;
