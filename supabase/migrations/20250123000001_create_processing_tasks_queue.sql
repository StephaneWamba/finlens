-- Processing Tasks Queue
-- Migration: Create task queue table and atomic functions for robust document processing

-- Processing tasks table (database-backed task queue)
CREATE TABLE IF NOT EXISTS processing_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES user_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL CHECK (task_type IN (
        'parse_document',
        'process_chunk',
        'merge_chunks',
        'index_document'
    )),
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',
        'processing',
        'completed',
        'failed',
        'retrying'
    )),
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    payload JSONB NOT NULL,
    error_message TEXT,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by TEXT, -- Worker identifier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_processing_tasks_status ON processing_tasks(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_processing_tasks_document ON processing_tasks(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_tasks_locked ON processing_tasks(locked_at) WHERE locked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processing_tasks_type_status ON processing_tasks(task_type, status);

-- Function to atomically claim a task
CREATE OR REPLACE FUNCTION claim_processing_task(
    p_worker_id TEXT,
    p_lock_timeout INTEGER DEFAULT 300
) RETURNS TABLE (
    id UUID,
    document_id UUID,
    user_id UUID,
    task_type TEXT,
    payload JSONB,
    attempts INTEGER,
    max_attempts INTEGER
) AS $$
DECLARE
    v_task_id UUID;
BEGIN
    -- Find and lock a pending or retrying task
    SELECT t.id INTO v_task_id
    FROM processing_tasks t
    WHERE t.status IN ('pending', 'retrying')
        AND (t.locked_at IS NULL OR t.locked_at < NOW() - (p_lock_timeout || ' seconds')::INTERVAL)
    ORDER BY t.priority DESC, t.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    IF v_task_id IS NULL THEN
        RETURN; -- No tasks available
    END IF;
    
    -- Claim the task atomically
    UPDATE processing_tasks
    SET status = 'processing',
        locked_at = NOW(),
        locked_by = p_worker_id,
        attempts = processing_tasks.attempts + 1,
        updated_at = NOW()
    WHERE processing_tasks.id = v_task_id;
    
    -- Return task details (use table alias to avoid conflict with RETURNS TABLE column names)
    RETURN QUERY
    SELECT 
        t.id,
        t.document_id,
        t.user_id,
        t.task_type,
        t.payload,
        t.attempts,
        t.max_attempts
    FROM processing_tasks t
    WHERE t.id = v_task_id;
END;
$$ LANGUAGE plpgsql;

-- Function for atomic state transitions
CREATE OR REPLACE FUNCTION transition_document_status(
    p_document_id UUID,
    p_user_id UUID,
    p_from_status TEXT,
    p_to_status TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    current_status TEXT;
BEGIN
    -- Get current status with row lock
    SELECT status INTO current_status
    FROM user_documents
    WHERE id = p_document_id AND user_id = p_user_id
    FOR UPDATE;
    
    -- Validate transition
    IF current_status != p_from_status THEN
        RAISE EXCEPTION 'Invalid state transition: current=%, expected=%', 
            current_status, p_from_status;
    END IF;
    
    -- Perform transition
    UPDATE user_documents
    SET status = p_to_status,
        updated_at = NOW()
    WHERE id = p_document_id AND user_id = p_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function for atomic chunk counter increment
CREATE OR REPLACE FUNCTION increment_chunk_completed(
    p_document_id UUID,
    p_user_id UUID,
    p_total_chunks INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    new_count INTEGER;
BEGIN
    -- Atomic JSONB update
    UPDATE user_documents
    SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{chunks_completed}',
        to_jsonb(
            COALESCE((metadata->>'chunks_completed')::INTEGER, 0) + 1
        )
    ),
    updated_at = NOW()
    WHERE id = p_document_id AND user_id = p_user_id
    RETURNING (metadata->>'chunks_completed')::INTEGER INTO new_count;
    
    -- Return true if all chunks completed
    RETURN COALESCE(new_count, 0) >= p_total_chunks;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a task
CREATE OR REPLACE FUNCTION complete_processing_task(
    p_task_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE processing_tasks
    SET status = 'completed',
        completed_at = NOW(),
        locked_at = NULL,
        locked_by = NULL,
        updated_at = NOW()
    WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- Function to fail a task (with retry logic)
CREATE OR REPLACE FUNCTION fail_processing_task(
    p_task_id UUID,
    p_error_message TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_attempts INTEGER;
    v_max_attempts INTEGER;
BEGIN
    -- Get current attempts
    SELECT processing_tasks.attempts, processing_tasks.max_attempts INTO v_attempts, v_max_attempts
    FROM processing_tasks
    WHERE processing_tasks.id = p_task_id;
    
    IF v_attempts >= v_max_attempts THEN
        -- Final failure
        UPDATE processing_tasks
        SET status = 'failed',
            error_message = p_error_message,
            locked_at = NULL,
            locked_by = NULL,
            updated_at = NOW()
        WHERE processing_tasks.id = p_task_id;
        RETURN FALSE; -- No retry
    ELSE
        -- Retry
        UPDATE processing_tasks
        SET status = 'retrying',
            error_message = p_error_message,
            locked_at = NULL,
            locked_by = NULL,
            updated_at = NOW()
        WHERE processing_tasks.id = p_task_id;
        RETURN TRUE; -- Will retry
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to enqueue a task
CREATE OR REPLACE FUNCTION enqueue_processing_task(
    p_document_id UUID,
    p_user_id UUID,
    p_task_type TEXT,
    p_payload JSONB,
    p_priority INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
    v_task_id UUID;
BEGIN
    INSERT INTO processing_tasks (
        document_id,
        user_id,
        task_type,
        payload,
        priority,
        status
    ) VALUES (
        p_document_id,
        p_user_id,
        p_task_type,
        p_payload,
        p_priority,
        'pending'
    )
    RETURNING id INTO v_task_id;
    
    RETURN v_task_id;
END;
$$ LANGUAGE plpgsql;

