-- Call Recordings and Call History Schema
-- Stores metadata for voice/video call recordings and history

-- Call Recordings table
CREATE TABLE IF NOT EXISTS public.call_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL, -- Links to MongoDB conversation
  agent_id UUID REFERENCES public.agent_configs(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Call metadata
  room_name TEXT NOT NULL,
  room_id TEXT,
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  
  -- Recording storage
  recording_url TEXT, -- URL to stored recording file (Supabase Storage or S3)
  recording_storage_path TEXT, -- Path in storage bucket
  file_size_bytes BIGINT,
  mime_type TEXT DEFAULT 'audio/webm',
  
  -- Participants
  participants JSONB DEFAULT '[]', -- Array of participant identities
  
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'recording' CHECK (status IN ('recording', 'completed', 'failed', 'processing')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call History table (denormalized for quick access)
CREATE TABLE IF NOT EXISTS public.call_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  agent_id UUID REFERENCES public.agent_configs(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Call info
  room_name TEXT NOT NULL,
  call_type TEXT DEFAULT 'voice' CHECK (call_type IN ('voice', 'video')),
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  
  -- Quick access
  has_recording BOOLEAN DEFAULT false,
  recording_id UUID REFERENCES public.call_recordings(id) ON DELETE SET NULL,
  
  -- Participants summary
  participant_count INTEGER DEFAULT 0,
  participants JSONB DEFAULT '[]',
  
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'missed', 'cancelled')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_recordings_company_id ON public.call_recordings(company_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_conversation_id ON public.call_recordings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_agent_id ON public.call_recordings(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_contact_id ON public.call_recordings(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_started_at ON public.call_recordings(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_recordings_status ON public.call_recordings(status);

CREATE INDEX IF NOT EXISTS idx_call_history_company_id ON public.call_history(company_id);
CREATE INDEX IF NOT EXISTS idx_call_history_conversation_id ON public.call_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_history_agent_id ON public.call_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_history_contact_id ON public.call_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_history_user_id ON public.call_history(user_id);
CREATE INDEX IF NOT EXISTS idx_call_history_started_at ON public.call_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_history_status ON public.call_history(status);

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_call_history_company_started ON public.call_history(company_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_history_contact_started ON public.call_history(contact_id, started_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_history_agent_started ON public.call_history(agent_id, started_at DESC) WHERE agent_id IS NOT NULL;

-- RLS Policies
ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see recordings from their company
CREATE POLICY "Users can view recordings from their company"
  ON public.call_recordings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert recordings for their company
CREATE POLICY "Users can insert recordings for their company"
  ON public.call_recordings
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can update recordings from their company
CREATE POLICY "Users can update recordings from their company"
  ON public.call_recordings
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Same policies for call_history
CREATE POLICY "Users can view call history from their company"
  ON public.call_history
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert call history for their company"
  ON public.call_history
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update call history from their company"
  ON public.call_history
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

