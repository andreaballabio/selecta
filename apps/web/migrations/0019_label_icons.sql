-- 0019_label_icons.sql
-- Icona/logo per ogni label, caricata come PNG dall'admin in /admin/label-icons.
-- Il file va nel bucket Storage "label-icons" (pubblico in lettura); l'URL
-- pubblico viene salvato in labels.icon_url. Usato in homepage/match/catalogo.

-- 1) colonna con l'URL pubblico del logo
ALTER TABLE labels ADD COLUMN IF NOT EXISTS icon_url text;
COMMENT ON COLUMN labels.icon_url IS 'URL pubblico del logo/icona della label (Storage bucket label-icons).';

-- 2) bucket Storage pubblico
INSERT INTO storage.buckets (id, name, public)
VALUES ('label-icons', 'label-icons', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3) lettura pubblica del bucket (l'upload avviene lato server con service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'label_icons_public_read'
  ) THEN
    CREATE POLICY "label_icons_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'label-icons');
  END IF;
END $$;
