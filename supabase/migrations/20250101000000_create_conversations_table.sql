-- FinLens: Conversations table schema for Supabase
-- Migration: Create conversations table with indexes and RLS policies

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    messages JSONB NOT NULL,  -- Full conversation messages array
    summary TEXT,              -- Compressed summary (for memory)
    metadata JSONB,            -- {companies: [], years: [], topics: []}
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_metadata ON conversations USING GIN(metadata);

-- Row Level Security (RLS) policies
-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own conversations
CREATE POLICY "Users can view own conversations"
    ON conversations
    FOR SELECT
    USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
    ON conversations
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own conversations
CREATE POLICY "Users can update own conversations"
    ON conversations
    FOR UPDATE
    USING (auth.uid()::text = user_id);

-- Note: For MVP, if you're not using Supabase Auth yet,
-- you can temporarily disable RLS or use service role key
-- ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;

