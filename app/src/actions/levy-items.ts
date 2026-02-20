'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  return { user, supabase }
}

/**
 * Calculate and insert levy_items for all lots in a given levy period.
 *
 * Formula per lot:
 *   admin_levy  = ROUND(admin_fund_total * unit_entitlement / periods_per_year, 2)
 *   capital_levy = ROUND(capital_works_fund_total * unit_entitlement / periods_per_year, 2)
 *
 * unit_entitlement is stored as an integer (e.g. 10 out of total 100),
 * so we compute the ratio: lot.unit_entitlement / SUM(all lot entitlements).
 */
export async function calculateLeviesForPeriod(periodId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // 1. Get the levy period and its parent schedule
  const { data: period, error: periodError } = await supabase
    .from('levy_periods')
    .select('*, levy_schedules(*)')
    .eq('id', periodId)
    .single()

  if (periodError || !period) {
    return { error: periodError?.message ?? 'Period not found' }
  }

  const schedule = period.levy_schedules as {
    id: string
    scheme_id: string
    admin_fund_total: number
    capital_works_fund_total: number
    periods_per_year: number
    active: boolean
  }

  if (!schedule.active) {
    return { error: 'Cannot calculate levies for an inactive schedule' }
  }

  // 2. Check if levy items already exist for this period
  const { data: existingItems } = await supabase
    .from('levy_items')
    .select('id')
    .eq('levy_period_id', periodId)
    .limit(1)

  if (existingItems && existingItems.length > 0) {
    return { error: 'Levy items have already been generated for this period. Delete existing items first to recalculate.' }
  }

  // 3. Get all active lots for the scheme with unit_entitlement
  const { data: allLots, error: lotsError } = await supabase
    .from('lots')
    .select('id, lot_number, unit_entitlement, lot_type')
    .eq('scheme_id', schedule.scheme_id)
    .eq('status', 'active')
    .order('lot_number')

  if (lotsError) return { error: lotsError.message }
  if (!allLots || allLots.length === 0) {
    return { error: 'No active lots found for this scheme. Add lots before calculating levies.' }
  }

  // Exclude Common Property lots — they don't pay levies
  const lots = allLots.filter(lot => lot.lot_type !== 'common-property')

  if (lots.length === 0) {
    return { error: 'All active lots are Common Property and are excluded from levy calculations. Add regular lots before generating levies.' }
  }

  // 4. Calculate total entitlement for the scheme (Common Property excluded)
  const totalEntitlement = lots.reduce((sum, lot) => sum + (lot.unit_entitlement ?? 0), 0)
  if (totalEntitlement <= 0) {
    return { error: 'Total unit entitlement for the scheme is zero. Set unit entitlements on lots first.' }
  }

  // 5. Calculate levy for each lot (Common Property lots are already excluded)
  const levyItems = lots.map(lot => {
    const entitlementRatio = lot.unit_entitlement / totalEntitlement
    const adminLevy = Math.round(schedule.admin_fund_total * entitlementRatio / schedule.periods_per_year * 100) / 100
    const capitalLevy = Math.round(schedule.capital_works_fund_total * entitlementRatio / schedule.periods_per_year * 100) / 100

    return {
      scheme_id: schedule.scheme_id,
      lot_id: lot.id,
      levy_period_id: periodId,
      levy_type: 'regular' as const,
      admin_levy_amount: adminLevy,
      capital_levy_amount: capitalLevy,
      due_date: period.due_date,
      status: 'pending' as const,
    }
  })

  // 6. Insert all levy items
  const { data: inserted, error: insertError } = await supabase
    .from('levy_items')
    .insert(levyItems)
    .select('id')

  if (insertError) return { error: insertError.message }

  // 7. Compute rounding difference
  const totalAdminLevied = levyItems.reduce((sum, item) => sum + item.admin_levy_amount, 0)
  const totalCapitalLevied = levyItems.reduce((sum, item) => sum + item.capital_levy_amount, 0)
  const expectedAdmin = Math.round(schedule.admin_fund_total / schedule.periods_per_year * 100) / 100
  const expectedCapital = Math.round(schedule.capital_works_fund_total / schedule.periods_per_year * 100) / 100
  const roundingDifference = Math.round(
    ((totalAdminLevied + totalCapitalLevied) - (expectedAdmin + expectedCapital)) * 100
  ) / 100

  // 8. Mark period as active
  await supabase
    .from('levy_periods')
    .update({ status: 'active' })
    .eq('id', periodId)

  revalidatePath(`/schemes/${schedule.scheme_id}`)
  revalidatePath(`/schemes/${schedule.scheme_id}/levies`)

  return {
    data: {
      itemsCreated: inserted?.length ?? levyItems.length,
      totalAdminLevied: Math.round(totalAdminLevied * 100) / 100,
      totalCapitalLevied: Math.round(totalCapitalLevied * 100) / 100,
      roundingDifference: roundingDifference !== 0 ? roundingDifference : undefined,
      roundingNote: roundingDifference !== 0
        ? `Total levies $${(totalAdminLevied + totalCapitalLevied).toFixed(2)} (expected $${(expectedAdmin + expectedCapital).toFixed(2)}, rounding difference $${Math.abs(roundingDifference).toFixed(2)})`
        : undefined,
    },
  }
}

/**
 * Get levy items for a period, joined with lot and owner info.
 */
export async function getLevyItems(periodId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: items, error } = await supabase
    .from('levy_items')
    .select(`
      *,
      lots!inner(
        id, lot_number, unit_number, unit_entitlement,
        lot_ownerships(
          owners(id, first_name, last_name, email)
        )
      )
    `)
    .eq('levy_period_id', periodId)
    .order('due_date', { ascending: true })

  if (error) return { error: error.message }
  return { data: items }
}

/**
 * Get levy items summary for a scheme (for dashboard/overview).
 */
export async function getLevyItemsSummary(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: items, error } = await supabase
    .from('levy_items')
    .select('status, total_levy_amount, amount_paid, balance')
    .eq('scheme_id', schemeId)

  if (error) return { error: error.message }
  if (!items || items.length === 0) return { data: null }

  const summary = {
    totalItems: items.length,
    totalLevied: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    byStatus: {} as Record<string, { count: number; amount: number }>,
  }

  for (const item of items) {
    const total = Number(item.total_levy_amount)
    const paid = Number(item.amount_paid)
    const balance = Number(item.balance)

    summary.totalLevied += total
    summary.totalPaid += paid
    summary.totalOutstanding += balance

    const status = item.status as string
    if (!summary.byStatus[status]) {
      summary.byStatus[status] = { count: 0, amount: 0 }
    }
    summary.byStatus[status].count++
    summary.byStatus[status].amount += balance
  }

  // Round totals
  summary.totalLevied = Math.round(summary.totalLevied * 100) / 100
  summary.totalPaid = Math.round(summary.totalPaid * 100) / 100
  summary.totalOutstanding = Math.round(summary.totalOutstanding * 100) / 100
  for (const key of Object.keys(summary.byStatus)) {
    summary.byStatus[key].amount = Math.round(summary.byStatus[key].amount * 100) / 100
  }

  return { data: summary }
}

/**
 * Get levy items for a specific lot (across all periods), for owner statement view.
 */
export async function getLevyItemsForLot(lotId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: items, error } = await supabase
    .from('levy_items')
    .select(`
      *,
      levy_periods!inner(
        id, period_name, period_start, period_end, due_date, status
      )
    `)
    .eq('lot_id', lotId)
    .order('due_date', { ascending: true })

  if (error) return { error: error.message }
  return { data: items }
}

/**
 * Delete all levy items for a period (to allow recalculation).
 * Only allowed if no payments have been allocated to any items in this period.
 */
export async function deleteLevyItemsForPeriod(periodId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Check for existing payment allocations
  const { data: items } = await supabase
    .from('levy_items')
    .select('id, amount_paid')
    .eq('levy_period_id', periodId)

  const hasPayments = items?.some(item => item.amount_paid > 0)
  if (hasPayments) {
    return { error: 'Cannot delete levy items: payments have already been recorded against items in this period.' }
  }

  // Get scheme_id for revalidation
  const { data: period } = await supabase
    .from('levy_periods')
    .select('levy_schedules(scheme_id)')
    .eq('id', periodId)
    .single()

  const { error } = await supabase
    .from('levy_items')
    .delete()
    .eq('levy_period_id', periodId)

  if (error) return { error: error.message }

  // Reset period status to pending
  await supabase
    .from('levy_periods')
    .update({ status: 'pending' })
    .eq('id', periodId)

  const scheduleData = period?.levy_schedules as unknown as { scheme_id: string } | null
  if (scheduleData?.scheme_id) {
    revalidatePath(`/schemes/${scheduleData.scheme_id}`)
    revalidatePath(`/schemes/${scheduleData.scheme_id}/levies`)
  }

  return { data: { deleted: items?.length ?? 0 } }
}

/**
 * Update the status of a single levy item (e.g., marking as 'sent' after notice delivery).
 */
export async function updateLevyItemStatus(
  itemId: string,
  status: 'pending' | 'sent' | 'overdue',
  updates?: { notice_generated_at?: string; notice_sent_at?: string }
) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: item, error } = await supabase
    .from('levy_items')
    .update({
      status,
      ...updates,
    })
    .eq('id', itemId)
    .select('scheme_id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/schemes/${item.scheme_id}`)
  return { data: true }
}

/**
 * Bulk update levy items status to 'sent' (after notices are emailed).
 */
export async function markLevyItemsAsSent(periodId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { error } = await supabase
    .from('levy_items')
    .update({
      status: 'sent',
      notice_sent_at: new Date().toISOString(),
    })
    .eq('levy_period_id', periodId)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  // Get scheme_id for revalidation
  const { data: period } = await supabase
    .from('levy_periods')
    .select('levy_schedules(scheme_id)')
    .eq('id', periodId)
    .single()

  const scheduleData = period?.levy_schedules as unknown as { scheme_id: string } | null
  if (scheduleData?.scheme_id) {
    revalidatePath(`/schemes/${scheduleData.scheme_id}`)
    revalidatePath(`/schemes/${scheduleData.scheme_id}/levies`)
  }

  return { data: true }
}
