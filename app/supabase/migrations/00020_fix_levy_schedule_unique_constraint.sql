-- Migration 00020: Fix levy schedule unique constraint for soft-deleted schedules
-- Bug #10: Cannot create new levy schedule after deleting one
--
-- Root cause: CONSTRAINT unique_schedule_per_scheme_year UNIQUE(scheme_id, budget_year_start)
-- prevents creating a new schedule for the same year even if the old one was soft-deleted
-- (deactivated, active = false).
--
-- Fix: Replace the UNIQUE constraint with a partial unique index that only applies
-- to ACTIVE schedules (active = true). Inactive (soft-deleted) schedules are ignored
-- by the uniqueness check.
--
-- This allows:
-- 1. Create schedule for 2025/26
-- 2. Delete it (soft-delete → active = false)
-- 3. Create a NEW schedule for 2025/26 (succeeds, old inactive record doesn't conflict)

-- Remove the old table-level unique constraint
ALTER TABLE public.levy_schedules
  DROP CONSTRAINT IF EXISTS unique_schedule_per_scheme_year;

-- Create a partial unique index: only enforce uniqueness for active schedules
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_schedule_per_scheme_year
  ON public.levy_schedules(scheme_id, budget_year_start)
  WHERE active = true;

-- Note: The existing index idx_levy_schedules_active is a non-unique index,
-- while this new one is a unique partial index. They coexist without conflict.
-- The non-unique one speeds up general queries; the unique one enforces the rule.
