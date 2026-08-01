DROP POLICY IF EXISTS "own audio read" ON storage.objects;
CREATE POLICY "own audio read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'generated-audio' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "own audio insert" ON storage.objects;
CREATE POLICY "own audio insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-audio' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "own audio delete" ON storage.objects;
CREATE POLICY "own audio delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'generated-audio' AND (auth.uid())::text = (storage.foldername(name))[1]);