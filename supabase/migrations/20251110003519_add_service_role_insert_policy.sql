-- Add explicit INSERT policy for service role on users table
-- The existing "Service role full access" policy uses USING which doesn't apply to INSERT
-- We need a WITH CHECK clause for INSERT operations

CREATE POLICY "Service role can insert users" ON users
    FOR INSERT
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

