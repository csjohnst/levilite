// Shared subscription utilities - types, pricing calculation, helpers

// ============================================================
// Types
// ============================================================

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'paused'
  | 'free'

export type BillingInterval = 'monthly' | 'annual'

export interface PlanFeatures {
  trust_accounting: boolean
  bulk_levy_notices: boolean
  financial_reporting: boolean
  csv_import_export: boolean
}

export interface TierBreakdown {
  tier: number
  label: string
  lotsInTier: number
  ratePerLot: number
  tierTotal: number
}

export interface PricingResult {
  subtotalExGst: number
  gst: number
  totalIncGst: number
  monthlySubtotal: number
  annualSubtotal: number
  annualSavings: number
  breakdown: TierBreakdown[]
}

// ============================================================
// Graduated Pricing Tiers
// ============================================================

const PRICING_TIERS = [
  { min: 1, max: 10, rate: 0, label: 'First 10 lots (free)' },
  { min: 11, max: 100, rate: 2.5, label: 'Lots 11-100' },
  { min: 101, max: 500, rate: 1.5, label: 'Lots 101-500' },
  { min: 501, max: 2000, rate: 1.0, label: 'Lots 501-2,000' },
  { min: 2001, max: Infinity, rate: 0.75, label: 'Lots 2,001+' },
] as const

// ============================================================
// Pricing Calculation
// ============================================================

export function calculateGraduatedPrice(
  lots: number,
  interval: BillingInterval
): PricingResult {
  const breakdown: TierBreakdown[] = []
  let monthlySubtotal = 0

  for (let i = 0; i < PRICING_TIERS.length; i++) {
    const tier = PRICING_TIERS[i]
    const tierMax = tier.max === Infinity ? lots : tier.max
    const lotsInTier = Math.max(0, Math.min(lots, tierMax) - (tier.min - 1))

    if (lotsInTier > 0) {
      const tierTotal = lotsInTier * tier.rate
      monthlySubtotal += tierTotal
      breakdown.push({
        tier: i + 1,
        label: tier.label,
        lotsInTier,
        ratePerLot: tier.rate,
        tierTotal,
      })
    }
  }

  const annualNoDiscount = monthlySubtotal * 12
  // Annual = monthly x 10 (2 months free)
  const annualDiscounted = monthlySubtotal * 10

  const subtotalExGst =
    interval === 'annual' ? annualDiscounted : monthlySubtotal
  const gst = round2(subtotalExGst * 0.1)
  const totalIncGst = round2(subtotalExGst + gst)

  return {
    subtotalExGst: round2(subtotalExGst),
    gst,
    totalIncGst,
    monthlySubtotal: round2(monthlySubtotal),
    annualSubtotal: round2(annualDiscounted),
    annualSavings: round2(annualNoDiscount - annualDiscounted),
    breakdown,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ============================================================
// Formatting Helpers
// ============================================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const FEATURE_LABELS: Record<string, string> = {
  trust_accounting: 'Trust Accounting',
  bulk_levy_notices: 'Bulk Levy Notices',
  financial_reporting: 'Financial Reporting',
  csv_import_export: 'CSV Import/Export',
}

export function getFeatureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature
}
