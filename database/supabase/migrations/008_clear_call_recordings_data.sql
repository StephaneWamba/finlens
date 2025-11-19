-- Clear Call Recordings and Related Data
-- This migration clears all data from call_recordings and call_history tables
-- Use this when you want to start fresh with call recording data
--
-- NOTE: Conversations are stored in MongoDB, not Supabase.
-- To clear conversations, you'll need to run a MongoDB script separately.
-- See the companion script: scripts/clear-mongodb-data.js

-- Delete call_history first (it references call_recordings)
DELETE FROM public.call_history;

-- Delete call_recordings
DELETE FROM public.call_recordings;

-- Verify tables are empty
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.call_recordings LIMIT 1) THEN
    RAISE EXCEPTION 'call_recordings table is not empty';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.call_history LIMIT 1) THEN
    RAISE EXCEPTION 'call_history table is not empty';
  END IF;
  
  RAISE NOTICE 'Successfully cleared all call recordings and call history data from Supabase';
  RAISE NOTICE 'Remember to also clear MongoDB conversations and messages using the MongoDB script';
END $$;

