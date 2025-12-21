-- Document Ingestion: User documents table
-- Migration: Create user_documents table with RLS policies

-- User documents table
-- Stores metadata for user-uploaded documents
CREATE TABLE IF NOT EXISTS user_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_extension TEXT NOT NULL CHECK (file_extension IN ('.pdf', '.doc', '.docx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg')),
    file_size BIGINT NOT NULL,
    page_count INTEGER,
    mime_type TEXT NOT NULL,
    status TEXT DEFAULT 'uploaded' CHECK (status IN (
        'uploaded', 'validating', 'converting', 'parsing', 
        'parsed', 'indexing', 'indexed', 'failed'
    )),
    error_message TEXT,
    content_list_path TEXT, -- Path to parsed JSON in Supabase Storage
    metadata JSONB DEFAULT '{}', -- {document_type, year, company, etc.}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    indexed_at TIMESTAMP WITH TIME ZONE,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_status ON user_documents(status);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_status ON user_documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_documents_extension ON user_documents(file_extension);
CREATE INDEX IF NOT EXISTS idx_user_documents_created_at ON user_documents(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_documents table
-- Users can read their own documents
CREATE POLICY "Users can read own documents" ON user_documents
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert own documents" ON user_documents
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update own documents" ON user_documents
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents" ON user_documents
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access" ON user_documents
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

