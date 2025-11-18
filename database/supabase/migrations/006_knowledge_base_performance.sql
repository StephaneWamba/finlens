-- Performance optimizations for Knowledge Base
-- Compound index for common query pattern: company_id + created_at

-- Compound index for efficient filtering and sorting
CREATE INDEX IF NOT EXISTS idx_kb_documents_company_created 
ON public.knowledge_base_documents(company_id, created_at DESC);

-- Index for status filtering within company (useful for processing status checks)
CREATE INDEX IF NOT EXISTS idx_kb_documents_company_status 
ON public.knowledge_base_documents(company_id, status);




