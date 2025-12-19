-- Migration: v3.2 Robust Update Daily Target Constraint
-- Description: Dynamically finding and dropping the check constraint to ensure 150/200 are allowed.
-- Date: 2025-12-19

BEGIN;

-- 1. Dynamically find and drop ANY check constraints involving 'daily_target' on 'user_settings'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
        INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'user_settings'
          AND con.contype = 'c' -- Check constraint
          AND pg_get_constraintdef(con.oid) LIKE '%daily_target%' -- Checks the definition contains the column name
    LOOP
        EXECUTE 'ALTER TABLE public.user_settings DROP CONSTRAINT ' || quote_ident(r.conname);
        RAISE NOTICE 'Dropped constraint: %', r.conname;
    END LOOP;
END $$;

-- 2. Add the correct constraint
ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_daily_target_check
CHECK (daily_target IN (30, 50, 70, 100, 150, 200));

COMMIT;
