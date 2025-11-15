-- Migration for v2.0: Add user_settings table for Daily Target configuration
-- This migration creates a simple settings table to store user preferences

-- Step 1: Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  daily_target integer not null default 50,
  CHECK (daily_target IN (30, 50, 70, 100))
);

-- Step 2: Insert default configuration
-- This ensures there's always a settings row available
INSERT INTO public.user_settings (daily_target)
VALUES (50)
ON CONFLICT DO NOTHING;

-- Step 3: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_settings_daily_target ON public.user_settings(daily_target);

-- Note: In a multi-user system, you would add a user_id column.
-- For now, we use a single global settings row.
