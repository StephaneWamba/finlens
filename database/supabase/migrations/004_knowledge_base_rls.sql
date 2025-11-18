-- Row Level Security for Knowledge Base Documents
-- Run this after 003_knowledge_base.sql

-- Enable RLS on knowledge_base_documents
ALTER TABLE public.knowledge_base_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their knowledge base documents" ON public.knowledge_base_documents;
DROP POLICY IF EXISTS "Users can insert their knowledge base documents" ON public.knowledge_base_documents;
DROP POLICY IF EXISTS "Users can update their knowledge base documents" ON public.knowledge_base_documents;
DROP POLICY IF EXISTS "Users can delete their knowledge base documents" ON public.knowledge_base_documents;

-- Policy: Users can view documents from their company
CREATE POLICY "Users can view their knowledge base documents" ON public.knowledge_base_documents
  FOR SELECT
  USING (
    (SELECT company_id FROM public.users WHERE id = auth.uid()) = company_id
  );

-- Policy: Users can insert documents for their company
CREATE POLICY "Users can insert their knowledge base documents" ON public.knowledge_base_documents
  FOR INSERT
  WITH CHECK (
    (SELECT company_id FROM public.users WHERE id = auth.uid()) = company_id
  );

-- Policy: Users can update documents from their company
CREATE POLICY "Users can update their knowledge base documents" ON public.knowledge_base_documents
  FOR UPDATE
  USING (
    (SELECT company_id FROM public.users WHERE id = auth.uid()) = company_id
  );

-- Policy: Users can delete documents from their company
CREATE POLICY "Users can delete their knowledge base documents" ON public.knowledge_base_documents
  FOR DELETE
  USING (
    (SELECT company_id FROM public.users WHERE id = auth.uid()) = company_id
  );


