-- Add composite indexes for conversations table to optimize session queries
-- These indexes optimize the most common query patterns

-- Index for get_conversations_by_session: (user_id, session_id, timestamp)
CREATE INDEX IF NOT EXISTS idx_conversations_user_session_timestamp 
    ON conversations(user_id, session_id, timestamp DESC);

-- Index for get_all_sessions: (user_id, timestamp DESC)
CREATE INDEX IF NOT EXISTS idx_conversations_user_timestamp 
    ON conversations(user_id, timestamp DESC);



