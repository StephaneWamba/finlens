-- Add parsed_pdf_path column to user_documents table
-- Stores path to MinerU parsed PDF (layout debug PDF) in Supabase Storage
ALTER TABLE user_documents
ADD COLUMN IF NOT EXISTS parsed_pdf_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN user_documents.parsed_pdf_path IS 'Path to parsed PDF (layout debug) in Supabase Storage: {user_id}/{document_id}/parsed.pdf';
