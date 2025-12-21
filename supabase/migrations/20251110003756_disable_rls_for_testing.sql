-- Temporarily disable RLS for testing
-- WARNING: This is for development/testing only. Re-enable RLS before production.

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Disable RLS on query_usage table  
ALTER TABLE query_usage DISABLE ROW LEVEL SECURITY;

-- Note: To re-enable RLS later, run:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE query_usage ENABLE ROW LEVEL SECURITY;

