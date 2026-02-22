-- Migration 00021: Add opening_balance payment method for mid-year onboarding
-- Extends the payment_method enum to support opening balance entries
-- References GitHub issue #6

-- Add 'opening_balance' to the payment_method CHECK constraint
ALTER TABLE public.payments DROP CONSTRAINT valid_payment_method;

ALTER TABLE public.payments ADD CONSTRAINT valid_payment_method 
  CHECK (payment_method IN ('bank_transfer', 'cheque', 'cash', 'direct_debit', 'bpay', 'opening_balance'));

-- Add a column to payment_allocations to link to transactions (for Phase 3 integration)
-- This was added in the payment.ts action but not in the migration
ALTER TABLE public.payment_allocations ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

-- Index for transaction_id lookups
CREATE INDEX IF NOT EXISTS idx_payment_allocations_transaction ON public.payment_allocations(transaction_id);
