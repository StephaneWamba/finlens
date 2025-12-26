-- Performance Optimizations Migration
-- Adds RPC functions and indexes for backend performance improvements

-- Function to atomically increment user query count
-- This prevents race conditions and reduces database round-trips
CREATE OR REPLACE FUNCTION increment_user_query_count(user_id_param UUID)
RETURNS TABLE(id UUID, queries_used_this_month INTEGER) AS $$
BEGIN
    RETURN QUERY
    UPDATE users
    SET queries_used_this_month = users.queries_used_this_month + 1
    WHERE users.id = user_id_param
    RETURNING users.id, users.queries_used_this_month;
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

-- Additional composite index for performance optimization
-- Note: This will be created when query_usage table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'query_usage') THEN
        CREATE INDEX IF NOT EXISTS idx_query_usage_user_success_created 
            ON query_usage(user_id, success, created_at DESC);
    END IF;
END $$;

-- Conversations table indexes for performance
-- These indexes optimize session listing and conversation retrieval
-- Note: These will be created when conversations table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
        CREATE INDEX IF NOT EXISTS idx_conversations_user_session_timestamp 
            ON conversations(user_id, session_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_conversations_user_timestamp 
            ON conversations(user_id, timestamp DESC);
    END IF;
END $$;



-- Function to atomically increment user query count
-- This prevents race conditions and reduces database round-trips
CREATE OR REPLACE FUNCTION increment_user_query_count(user_id_param UUID)
RETURNS TABLE(id UUID, queries_used_this_month INTEGER) AS $$
BEGIN
    RETURN QUERY
    UPDATE users
    SET queries_used_this_month = users.queries_used_this_month + 1
    WHERE users.id = user_id_param
    RETURNING users.id, users.queries_used_this_month;
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

-- Additional composite index for performance optimization
-- Note: This will be created when query_usage table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'query_usage') THEN
        CREATE INDEX IF NOT EXISTS idx_query_usage_user_success_created 
            ON query_usage(user_id, success, created_at DESC);
    END IF;
END $$;

-- Conversations table indexes for performance
-- These indexes optimize session listing and conversation retrieval
-- Note: These will be created when conversations table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
        CREATE INDEX IF NOT EXISTS idx_conversations_user_session_timestamp 
            ON conversations(user_id, session_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_conversations_user_timestamp 
            ON conversations(user_id, timestamp DESC);
    END IF;
END $$;

