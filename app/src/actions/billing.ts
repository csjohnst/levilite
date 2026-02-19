'use server'

import { createClient } from '@/lib/supabase/server'
import type { PlanFeatures } from '@/lib/subscription'

// ============================================================
// Auth helper — reused across all billing actions
// ============================================================

async function getOrgContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }

  const { data: orgUser } = await supabase
    .from('organisation_users')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single()
  if (!orgUser) return { error: 'No organisation found' as const }

  return { user, orgId: orgUser.organisation_id, supabase }
}

// ============================================================
// getSubscription
// ============================================================

export async function getSubscription() {
  const ctx = await getOrgContext()
  if ('error' in ctx && !('supabase' in ctx)) return { error: ctx.error }
  const { supabase, orgId } = ctx as Exclude<typeof ctx, { error: string }>

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('*, subscription_plans(*)')
    .eq('organisation_id', orgId)
    .single()

  if (error) return { error: error.message }
  if (!subscription) return { error: 'No subscription found' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planRaw = subscription.subscription_plans as any
  const plan = (Array.isArray(planRaw) ? planRaw[0] : planRaw) as {
    plan_code: string
    plan_name: string
    features: PlanFeatures
    max_lots: number | null
    max_schemes: number | null
  }

  return {
    data: {
      id: subscription.id,
      status: subscription.status,
      plan_code: plan.plan_code,
      plan_name: plan.plan_name,
      billing_interval: subscription.billing_interval,
      billed_lots_count: subscription.billed_lots_count,
      stripe_customer_id: subscription.stripe_customer_id,
      stripe_subscription_id: subscription.stripe_subscription_id,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      trial_start_date: subscription.trial_start_date,
      trial_end_date: subscription.trial_end_date,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at,
      data_retention_expires_at: subscription.data_retention_expires_at,
      features: plan.features,
    },
  }
}

// ============================================================
// getSubscriptionPlans
// ============================================================

export async function getSubscriptionPlans() {
  const ctx = await getOrgContext()
  if ('error' in ctx && !('supabase' in ctx)) return { error: ctx.error }
  const { supabase } = ctx as Exclude<typeof ctx, { error: string }>

  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) return { error: error.message }
  return { data: plans }
}

// ============================================================
// getBillingHistory
// ============================================================

export async function getBillingHistory() {
  const ctx = await getOrgContext()
  if ('error' in ctx && !('supabase' in ctx)) return { error: ctx.error }
  const { supabase, orgId } = ctx as Exclude<typeof ctx, { error: string }>

  const { data: invoices, error } = await supabase
    .from('platform_invoices')
    .select('*')
    .eq('organisation_id', orgId)
    .order('invoice_date', { ascending: false })

  if (error) return { error: error.message }
  return { data: invoices }
}

// ============================================================
// getUsageStats
// ============================================================

export async function getUsageStats() {
  const ctx = await getOrgContext()
  if ('error' in ctx && !('supabase' in ctx)) return { error: ctx.error }
  const { supabase, orgId } = ctx as Exclude<typeof ctx, { error: string }>

  // Count lots across all schemes in the organisation
  const { count: totalLots, error: lotsError } = await supabase
    .from('lots')
    .select('id, schemes!inner(organisation_id)', { count: 'exact', head: true })
    .eq('schemes.organisation_id', orgId)

  if (lotsError) return { error: lotsError.message }

  // Count schemes
  const { count: totalSchemes, error: schemesError } = await supabase
    .from('schemes')
    .select('id', { count: 'exact', head: true })
    .eq('organisation_id', orgId)
    .neq('status', 'archived')

  if (schemesError) return { error: schemesError.message }

  // Count users in organisation
  const { count: totalUsers, error: usersError } = await supabase
    .from('organisation_users')
    .select('id', { count: 'exact', head: true })
    .eq('organisation_id', orgId)

  if (usersError) return { error: usersError.message }

  return {
    data: {
      totalLots: totalLots ?? 0,
      totalSchemes: totalSchemes ?? 0,
      totalUsers: totalUsers ?? 0,
    },
  }
}

// ============================================================
// canAccessFeature
// ============================================================

export async function canAccessFeature(feature: string) {
  const ctx = await getOrgContext()
  if ('error' in ctx && !('supabase' in ctx)) return { error: ctx.error }
  const { supabase, orgId } = ctx as Exclude<typeof ctx, { error: string }>

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('status, trial_end_date, subscription_plans(features)')
    .eq('organisation_id', orgId)
    .single()

  if (error || !subscription) return { data: false }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planRaw = subscription.subscription_plans as any
  const plan = (Array.isArray(planRaw) ? planRaw[0] : planRaw) as {
    features: Record<string, boolean>
  } | undefined
  const features = plan?.features ?? {}
  const status = subscription.status
  const trialEnd = subscription.trial_end_date

  // Active subscription: check feature flags
  if (status === 'active') {
    return { data: features[feature] === true }
  }

  // Trialing: full access if trial not expired
  if (status === 'trialing') {
    if (!trialEnd || new Date() <= new Date(trialEnd + 'T23:59:59')) {
      return { data: features[feature] === true }
    }
    // Trial expired but status not yet flipped
    return { data: false }
  }

  // Free: check feature flags (most will be false)
  if (status === 'free') {
    return { data: features[feature] === true }
  }

  // past_due, canceled, paused: deny
  return { data: false }
}

// ============================================================
// checkPlanLimits
// ============================================================

export async function checkPlanLimits() {
  const ctx = await getOrgContext()
  if ('error' in ctx && !('supabase' in ctx)) return { error: ctx.error }
  const { supabase, orgId } = ctx as Exclude<typeof ctx, { error: string }>

  // Get plan limits
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('subscription_plans(max_lots, max_schemes)')
    .eq('organisation_id', orgId)
    .single()

  if (subError || !subscription) {
    return { error: 'No subscription found' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planRaw = subscription.subscription_plans as any
  const plan = (Array.isArray(planRaw) ? planRaw[0] : planRaw) as {
    max_lots: number | null
    max_schemes: number | null
  }

  // Count current lots
  const { count: currentLots, error: lotsError } = await supabase
    .from('lots')
    .select('id, schemes!inner(organisation_id)', { count: 'exact', head: true })
    .eq('schemes.organisation_id', orgId)

  if (lotsError) return { error: lotsError.message }

  // Count current schemes
  const { count: currentSchemes, error: schemesError } = await supabase
    .from('schemes')
    .select('id', { count: 'exact', head: true })
    .eq('organisation_id', orgId)
    .neq('status', 'archived')

  if (schemesError) return { error: schemesError.message }

  const lots = currentLots ?? 0
  const schemes = currentSchemes ?? 0
  const maxLots = plan.max_lots
  const maxSchemes = plan.max_schemes

  const lotsWithinLimits = maxLots === null || lots < maxLots
  const schemesWithinLimits = maxSchemes === null || schemes < maxSchemes

  return {
    data: {
      withinLimits: lotsWithinLimits && schemesWithinLimits,
      currentLots: lots,
      maxLots,
      currentSchemes: schemes,
      maxSchemes,
    },
  }
}

// ============================================================
// getTrialInfo
// ============================================================

export async function getTrialInfo() {
  const ctx = await getOrgContext()
  if ('error' in ctx && !('supabase' in ctx)) return { error: ctx.error }
  const { supabase, orgId } = ctx as Exclude<typeof ctx, { error: string }>

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('status, trial_start_date, trial_end_date')
    .eq('organisation_id', orgId)
    .single()

  if (error || !subscription) {
    return { data: { isTrialing: false, trialDaysRemaining: 0, trialEndDate: null, isExpired: false } }
  }

  const isTrialing = subscription.status === 'trialing'
  const trialEndDate = subscription.trial_end_date

  if (!isTrialing || !trialEndDate) {
    return {
      data: {
        isTrialing: false,
        trialDaysRemaining: 0,
        trialEndDate,
        isExpired: !isTrialing && trialEndDate !== null,
      },
    }
  }

  const now = new Date()
  const end = new Date(trialEndDate + 'T23:59:59')
  const msRemaining = end.getTime() - now.getTime()
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
  const isExpired = msRemaining <= 0

  return {
    data: {
      isTrialing: !isExpired,
      trialDaysRemaining: daysRemaining,
      trialEndDate,
      isExpired,
    },
  }
}
