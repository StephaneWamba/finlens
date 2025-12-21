-- Fix missing auth.identities table for OAuth support
-- This table is required for OAuth providers like Google

-- Create identities table if it doesn't exist
-- Note: This should normally be created by Supabase Auth, but we ensure it exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'auth' 
        AND tablename = 'identities'
    ) THEN
        CREATE TABLE auth.identities (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL,
            identity_data jsonb NOT NULL,
            provider text NOT NULL,
            last_sign_in_at timestamp with time zone,
            created_at timestamp with time zone,
            updated_at timestamp with time zone,
            CONSTRAINT identities_pkey PRIMARY KEY (provider, id),
            CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) 
                REFERENCES auth.users(id) ON DELETE CASCADE
        );

        -- Create indexes
        CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);
        CREATE INDEX identities_email_idx ON auth.identities USING gin ((identity_data ->> 'email'));
        
        -- Grant permissions
        GRANT SELECT, INSERT, UPDATE, DELETE ON auth.identities TO postgres;
        GRANT SELECT, INSERT, UPDATE, DELETE ON auth.identities TO supabase_auth_admin;
    END IF;
END $$;

-- Add missing banned_until column to auth.users if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'auth' 
        AND table_name = 'users' 
        AND column_name = 'banned_until'
    ) THEN
        ALTER TABLE auth.users ADD COLUMN banned_until timestamp with time zone;
    END IF;
END $$;

-- This table is required for OAuth providers like Google

-- Create identities table if it doesn't exist
-- Note: This should normally be created by Supabase Auth, but we ensure it exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'auth' 
        AND tablename = 'identities'
    ) THEN
        CREATE TABLE auth.identities (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL,
            identity_data jsonb NOT NULL,
            provider text NOT NULL,
            last_sign_in_at timestamp with time zone,
            created_at timestamp with time zone,
            updated_at timestamp with time zone,
            CONSTRAINT identities_pkey PRIMARY KEY (provider, id),
            CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) 
                REFERENCES auth.users(id) ON DELETE CASCADE
        );

        -- Create indexes
        CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);
        CREATE INDEX identities_email_idx ON auth.identities USING gin ((identity_data ->> 'email'));
        
        -- Grant permissions
        GRANT SELECT, INSERT, UPDATE, DELETE ON auth.identities TO postgres;
        GRANT SELECT, INSERT, UPDATE, DELETE ON auth.identities TO supabase_auth_admin;
    END IF;
END $$;

-- Add missing banned_until column to auth.users if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'auth' 
        AND table_name = 'users' 
        AND column_name = 'banned_until'
    ) THEN
        ALTER TABLE auth.users ADD COLUMN banned_until timestamp with time zone;
    END IF;
END $$;





