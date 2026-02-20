-- Migration 00019: Add Common Property lot type and occupancy status
-- Implements feedback from beta tester Donna Henneberry (Feb 2026)
-- Issues: #7 (lot type), #8 (occupancy type), #9 (zero unit entitlement)

-- 1. Update lot_type CHECK constraint to include 'common-property'
ALTER TABLE public.lots
  DROP CONSTRAINT IF EXISTS valid_lot_type;

ALTER TABLE public.lots
  ADD CONSTRAINT valid_lot_type CHECK (
    lot_type IN ('residential', 'commercial', 'parking', 'storage', 'common-property', 'other')
  );

-- 2. Update occupancy_status CHECK constraint to include 'common-property'
ALTER TABLE public.lots
  DROP CONSTRAINT IF EXISTS valid_occupancy;

ALTER TABLE public.lots
  ADD CONSTRAINT valid_occupancy CHECK (
    occupancy_status IN ('owner-occupied', 'tenanted', 'vacant', 'common-property', 'unknown')
  );

-- 3. Update unit_entitlement CHECK constraint to allow 0 for Common Property lots
--    Previous constraint: unit_entitlement > 0
--    New constraint: unit_entitlement >= 0 (zero allowed for Common Property)
ALTER TABLE public.lots
  DROP CONSTRAINT IF EXISTS positive_entitlement;

ALTER TABLE public.lots
  ADD CONSTRAINT non_negative_entitlement CHECK (unit_entitlement >= 0);

-- 4. Add a comment to document the business rule
COMMENT ON COLUMN public.lots.lot_type IS
  'Lot classification. Common Property lots are excluded from levy calculations and invoicing.';

COMMENT ON COLUMN public.lots.unit_entitlement IS
  'Proportional entitlement for levy apportionment. Use 0 for Common Property lots (excluded from levy calculations).';
