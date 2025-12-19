-- Migration: v3.1 Update Daily Target Constraint
-- Description: Update constraints to allow daily_target values of 150 and 200
-- Date: 2025-12-19

BEGIN;

-- Remove the old check constraint
-- Postgres usually names it user_settings_daily_target_check
ALTER TABLE public.user_settings
DROP CONSTRAINT IF EXISTS user_settings_daily_target_check;

-- Add the new updated constraint including 150 and 200
ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_daily_target_check
CHECK (daily_target IN (30, 50, 70, 100, 150, 200));

COMMIT;
