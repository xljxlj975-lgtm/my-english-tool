-- Migration for v2.1: remove legacy mistake type classification
-- This drops the unused type column and associated enum definition.

ALTER TABLE public.mistakes
DROP COLUMN IF EXISTS type;

DROP TYPE IF EXISTS mistake_type;
