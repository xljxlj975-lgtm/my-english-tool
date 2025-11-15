-- Migration for v2.0: Add content_type and last_reviewed_at fields
-- This migration adds support for Expression content type and tracks actual review behavior

-- Step 1: Add content_type enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE content_type AS ENUM ('mistake', 'expression');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add content_type column with default value 'mistake'
-- This ensures all existing data is treated as mistakes
ALTER TABLE public.mistakes
ADD COLUMN IF NOT EXISTS content_type content_type NOT NULL DEFAULT 'mistake';

-- Step 3: Add last_reviewed_at column to track actual review behavior
-- NULL means never reviewed, which is important for the backlog mechanism
ALTER TABLE public.mistakes
ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

-- Step 4: Create index on content_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_mistakes_content_type ON public.mistakes(content_type);

-- Step 5: Create index on last_reviewed_at for backlog queries
CREATE INDEX IF NOT EXISTS idx_mistakes_last_reviewed_at ON public.mistakes(last_reviewed_at);

-- Note: No existing data is modified. All existing mistakes will have:
-- - content_type = 'mistake' (default)
-- - last_reviewed_at = NULL (never reviewed)
