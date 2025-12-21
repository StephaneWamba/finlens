-- Extend user_documents table with metadata indexes and constraints
-- Migration: Add indexes for rich metadata fields

-- Indexes for metadata fields (GIN indexes for JSONB queries)
CREATE INDEX IF NOT EXISTS idx_user_documents_metadata_company_name
    ON user_documents USING gin ((metadata->>'company_name'));

CREATE INDEX IF NOT EXISTS idx_user_documents_metadata_company_ticker
    ON user_documents USING gin ((metadata->>'company_ticker'));

CREATE INDEX IF NOT EXISTS idx_user_documents_metadata_document_type
    ON user_documents USING gin ((metadata->>'document_type'));

CREATE INDEX IF NOT EXISTS idx_user_documents_metadata_document_category
    ON user_documents USING gin ((metadata->>'document_category'));

CREATE INDEX IF NOT EXISTS idx_user_documents_metadata_fiscal_year
    ON user_documents ((metadata->>'fiscal_year'));

CREATE INDEX IF NOT EXISTS idx_user_documents_metadata_fiscal_quarter
    ON user_documents ((metadata->>'fiscal_quarter'));

CREATE INDEX IF NOT EXISTS idx_user_documents_metadata_company_sector
    ON user_documents USING gin ((metadata->>'company_sector'));

CREATE INDEX IF NOT EXISTS idx_user_documents_metadata_company_industry
    ON user_documents USING gin ((metadata->>'company_industry'));

-- Composite index for common queries (company + year + type)
CREATE INDEX IF NOT EXISTS idx_user_documents_metadata_composite
    ON user_documents (
        (metadata->>'company_name'),
        (metadata->>'fiscal_year'),
        (metadata->>'document_type')
    );

-- Optional: Add constraints for data validation
-- Note: These are soft constraints - they validate but don't block invalid data
-- Remove if you want more flexibility

-- Validate fiscal_year range (2015-2030)
ALTER TABLE user_documents
    DROP CONSTRAINT IF EXISTS check_fiscal_year;

ALTER TABLE user_documents
    ADD CONSTRAINT check_fiscal_year
    CHECK (
        (metadata->>'fiscal_year') IS NULL OR
        ((metadata->>'fiscal_year')::int BETWEEN 2015 AND 2030)
    );

-- Validate fiscal_quarter range (1-4)
ALTER TABLE user_documents
    DROP CONSTRAINT IF EXISTS check_fiscal_quarter;

ALTER TABLE user_documents
    ADD CONSTRAINT check_fiscal_quarter
    CHECK (
        (metadata->>'fiscal_quarter') IS NULL OR
        ((metadata->>'fiscal_quarter')::int BETWEEN 1 AND 4)
    );

-- Validate document_type enum (common types)
ALTER TABLE user_documents
    DROP CONSTRAINT IF EXISTS check_document_type;

ALTER TABLE user_documents
    ADD CONSTRAINT check_document_type
    CHECK (
        (metadata->>'document_type') IS NULL OR
        (metadata->>'document_type') IN (
            '10-K', '10-Q', '8-K', '10-K/A', '10-Q/A',
            'Annual Report', 'Quarterly Report', 'Earnings Release',
            'Proxy Statement', 'Other'
        )
    );

