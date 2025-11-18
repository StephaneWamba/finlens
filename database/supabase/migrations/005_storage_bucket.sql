-- Storage Bucket Setup for Knowledge Base
-- This migration creates the 'documents' storage bucket and sets up policies

-- Note: Storage buckets cannot be created via SQL migrations in Supabase
-- You must create the bucket manually in the Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: "documents"
-- 4. Public: false (private bucket)
-- 5. File size limit: 10MB (or as needed)
-- 6. Allowed MIME types: application/pdf, text/plain, application/msword, 
--    application/vnd.openxmlformats-officedocument.wordprocessingml.document,
--    text/markdown, text/csv

-- Storage Policies (RLS for Storage)
-- These policies control access to files in the 'documents' bucket
-- Files are stored with path format: {company_id}/{filename}
-- Note: RLS is enabled on storage.objects by default in Supabase

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload to company folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read from company folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete from company folder" ON storage.objects;

-- Policy: Users can upload files to their company's folder
CREATE POLICY "Users can upload to company folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (string_to_array(name, '/'))[1] = (
    SELECT company_id::text 
    FROM public.users 
    WHERE id = auth.uid()
  )
);

-- Policy: Users can read files from their company's folder
CREATE POLICY "Users can read from company folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (string_to_array(name, '/'))[1] = (
    SELECT company_id::text 
    FROM public.users 
    WHERE id = auth.uid()
  )
);

-- Policy: Users can delete files from their company's folder
CREATE POLICY "Users can delete from company folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (string_to_array(name, '/'))[1] = (
    SELECT company_id::text 
    FROM public.users 
    WHERE id = auth.uid()
  )
);

-- Policy: Service role can do everything (for knowledge-base service)
-- Note: Service role bypasses RLS, so this is mainly for documentation
-- The knowledge-base service uses service_role_key which bypasses all policies

