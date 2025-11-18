-- Knowledge Base Schema
-- Documents uploaded to Supabase Storage, metadata in PostgreSQL

-- Knowledge Base Documents table
CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agent_configs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path in Supabase Storage
  file_size BIGINT, -- Size in bytes
  file_type TEXT, -- MIME type (e.g., 'application/pdf', 'text/plain')
  mime_type TEXT, -- Alias for file_type
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  chunk_count INTEGER DEFAULT 0, -- Number of chunks created
  vector_count INTEGER DEFAULT 0, -- Number of vectors in Pinecone
  metadata JSONB DEFAULT '{}', -- Additional metadata (extracted text preview, processing errors, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ -- When processing completed
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kb_documents_company_id ON public.knowledge_base_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_agent_id ON public.knowledge_base_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_status ON public.knowledge_base_documents(status);
CREATE INDEX IF NOT EXISTS idx_kb_documents_created_at ON public.knowledge_base_documents(created_at);

-- Apply updated_at trigger
CREATE TRIGGER update_kb_documents_updated_at BEFORE UPDATE ON public.knowledge_base_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


