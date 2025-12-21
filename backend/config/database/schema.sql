-- User profiles table
-- Stores additional user information beyond Supabase Auth

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    monthly_query_limit INTEGER DEFAULT 10,
    queries_used_this_month INTEGER DEFAULT 0,
    last_query_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);

-- Query usage tracking table
CREATE TABLE IF NOT EXISTS query_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    response_text TEXT,
    cost_usd DECIMAL(10, 6) DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for query usage
CREATE INDEX IF NOT EXISTS idx_query_usage_user_id ON query_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_query_usage_created_at ON query_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_query_usage_user_created ON query_usage(user_id, created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE
    USING (auth.uid() = id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access" ON users
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for query_usage table
-- Users can read their own query history
CREATE POLICY "Users can read own queries" ON query_usage
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can insert queries (for backend)
CREATE POLICY "Service role can insert queries" ON query_usage
    FOR INSERT
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Service role can read all queries (for analytics)
CREATE POLICY "Service role can read all queries" ON query_usage
    FOR SELECT
    USING (auth.jwt()->>'role' = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reset monthly query counts (can be called by cron job)
CREATE OR REPLACE FUNCTION reset_monthly_query_counts()
RETURNS void AS $$
BEGIN
    UPDATE users
    SET queries_used_this_month = 0,
        last_query_reset = NOW()
    WHERE last_query_reset < DATE_TRUNC('month', NOW());
END;
$$ language 'plpgsql';

-- Function to atomically increment user query count
-- This prevents race conditions and reduces database round-trips
CREATE OR REPLACE FUNCTION increment_user_query_count(user_id_param UUID)
RETURNS TABLE(id UUID, queries_used_this_month INTEGER) AS $$
BEGIN
    RETURN QUERY
    UPDATE users
    SET queries_used_this_month = queries_used_this_month + 1
    WHERE id = user_id_param
    RETURNING id, queries_used_this_month;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to get user usage statistics with SQL aggregation
-- This performs aggregation in the database instead of fetching all rows
CREATE OR REPLACE FUNCTION get_user_usage_stats(
    user_id_param UUID,
    days_param INTEGER DEFAULT 30
)
RETURNS TABLE(
    total_queries BIGINT,
    successful_queries BIGINT,
    failed_queries BIGINT,
    total_cost_usd NUMERIC,
    total_tokens BIGINT,
    average_cost_per_query NUMERIC
) AS $$
DECLARE
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_date := NOW() - (days_param || ' days')::INTERVAL;
    
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_queries,
        COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_queries,
        COUNT(*) FILTER (WHERE success = false)::BIGINT as failed_queries,
        COALESCE(SUM(cost_usd), 0)::NUMERIC as total_cost_usd,
        COALESCE(SUM(tokens_used), 0)::BIGINT as total_tokens,
        CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(SUM(cost_usd), 0) / COUNT(*)::NUMERIC
            ELSE 0::NUMERIC
        END as average_cost_per_query
    FROM query_usage
    WHERE user_id = user_id_param
      AND created_at >= cutoff_date;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to get user usage trends with SQL GROUP BY
-- This groups by date in the database instead of fetching all rows
CREATE OR REPLACE FUNCTION get_user_usage_trends(
    user_id_param UUID,
    days_param INTEGER DEFAULT 30
)
RETURNS TABLE(
    date DATE,
    queries BIGINT,
    successful_queries BIGINT,
    failed_queries BIGINT,
    total_cost_usd NUMERIC,
    total_tokens BIGINT
) AS $$
DECLARE
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_date := NOW() - (days_param || ' days')::INTERVAL;
    
    RETURN QUERY
    SELECT
        DATE(created_at) as date,
        COUNT(*)::BIGINT as queries,
        COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_queries,
        COUNT(*) FILTER (WHERE success = false)::BIGINT as failed_queries,
        COALESCE(SUM(cost_usd), 0)::NUMERIC as total_cost_usd,
        COALESCE(SUM(tokens_used), 0)::BIGINT as total_tokens
    FROM query_usage
    WHERE user_id = user_id_param
      AND created_at >= cutoff_date
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at);
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Additional composite indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_query_usage_user_success_created 
    ON query_usage(user_id, success, created_at DESC);

-- Conversations table indexes for performance
-- These indexes optimize session listing and conversation retrieval
-- Note: Run these after conversations table is created
-- CREATE INDEX IF NOT EXISTS idx_conversations_user_session_timestamp 
--     ON conversations(user_id, session_id, timestamp DESC);
-- CREATE INDEX IF NOT EXISTS idx_conversations_user_timestamp 
--     ON conversations(user_id, timestamp DESC);