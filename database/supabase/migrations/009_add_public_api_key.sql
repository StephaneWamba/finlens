-- Migration: Add public_api_key column to agent_configs table
-- This column stores API keys for public widget access (format: pub_key_xxx)

ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS public_api_key TEXT;

-- Add comment
COMMENT ON COLUMN public.agent_configs.public_api_key IS 'Public API key for widget access (format: pub_key_xxx)';

-- Create index for faster lookups (optional, but useful if we query by key)
CREATE INDEX IF NOT EXISTS idx_agent_configs_public_api_key ON public.agent_configs(public_api_key) WHERE public_api_key IS NOT NULL;

