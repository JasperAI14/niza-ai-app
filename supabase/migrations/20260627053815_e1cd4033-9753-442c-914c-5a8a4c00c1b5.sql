CREATE POLICY "own generated images update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'generated-images' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'generated-images' AND (auth.uid())::text = (storage.foldername(name))[1]);