-- Storage Bucket Setup for Call Recordings
-- This migration creates RLS policies for the 'recordings' storage bucket
--
-- Note: Storage buckets cannot be created via SQL migrations in Supabase
-- You must create the bucket manually in the Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: "recordings"
-- 4. Public: false (private bucket)
-- 5. File size limit: 100MB (or as needed for audio recordings)
-- 6. Allowed MIME types: audio/webm, audio/mp3, audio/wav, audio/ogg, audio/m4a
--
-- Storage Policies (RLS for Storage)
-- These policies control access to files in the 'recordings' bucket
-- Files are stored with path format: {company_id}/recordings/{filename}
-- Note: RLS is enabled on storage.objects by default in Supabase

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can read recordings from their company" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete recordings from their company" ON storage.objects;

-- Policy: Users can upload recordings to their company's folder
CREATE POLICY "Users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recordings' AND
  (string_to_array(name, '/'))[1] = (
    SELECT company_id::text 
    FROM public.users 
    WHERE id = auth.uid()
  )
);

-- Policy: Users can read recordings from their company's folder
CREATE POLICY "Users can read recordings from their company"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings' AND
  (string_to_array(name, '/'))[1] = (
    SELECT company_id::text 
    FROM public.users 
    WHERE id = auth.uid()
  )
);

-- Policy: Users can delete recordings from their company's folder
CREATE POLICY "Users can delete recordings from their company"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'recordings' AND
  (string_to_array(name, '/'))[1] = (
    SELECT company_id::text 
    FROM public.users 
    WHERE id = auth.uid()
  )
);

