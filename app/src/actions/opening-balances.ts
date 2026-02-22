'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordPayment, type PaymentFormData } from './payments'

const openingBalanceSchema = z.object({
  lot_id: z.string().uuid('Invalid lot'),
  amount: z.number().nonnegative('Amount must be zero or greater'),
})

export type OpeningBalanceEntry = z.infer<typeof openingBalanceSchema>

const applyOpeningBalancesSchema = z.object({
  scheme_id: z.string().uuid('Invalid scheme'),
  balances: z.array(openingBalanceSchema),
  opening_balance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)'),
})

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  return { user, supabase }
}

/**
 * Get all lots with their owners and outstanding levy items for the opening balances form.
 */
export async function getLotsForOpeningBalances(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Fetch lots with owners
  const { data: lots, error: lotsError } = await supabase
    .from('lots')
    .select(`
      id,
      lot_number,
      unit_number,
      unit_entitlement,
      status,
      lot_ownerships(
        owners(id, first_name, last_name)
      )
    `)
    .eq('scheme_id', schemeId)
    .eq('status', 'active')
    .order('lot_number')

  if (lotsError) return { error: lotsError.message }

  // Get levy items for each lot to calculate total annual levy
  const { data: levyItems, error: levyItemsError } = await supabase
    .from('levy_items')
    .select('lot_id, admin_levy_amount, capital_levy_amount, special_levy_amount, amount_paid, status')
    .eq('scheme_id', schemeId)

  if (levyItemsError) return { error: levyItemsError.message }

  // Calculate totals per lot
  const lotTotals = new Map<string, { total_levy: number; amount_paid: number; balance: number }>()
  levyItems?.forEach(item => {
    const total = item.admin_levy_amount + item.capital_levy_amount + (item.special_levy_amount ?? 0)
    const existing = lotTotals.get(item.lot_id) || { total_levy: 0, amount_paid: 0, balance: 0 }
    lotTotals.set(item.lot_id, {
      total_levy: existing.total_levy + total,
      amount_paid: existing.amount_paid + item.amount_paid,
      balance: existing.balance + (total - item.amount_paid),
    })
  })

  // Get existing opening balance payments
  const { data: openingBalancePayments } = await supabase
    .from('payments')
    .select('lot_id, amount')
    .eq('scheme_id', schemeId)
    .eq('payment_method', 'opening_balance')

  const existingOpeningBalances = new Map<string, number>()
  openingBalancePayments?.forEach(p => {
    existingOpeningBalances.set(p.lot_id, p.amount)
  })

  // Enhance lots with levy info
  const enhancedLots = lots?.map(lot => {
    const totals = lotTotals.get(lot.id) || { total_levy: 0, amount_paid: 0, balance: 0 }
    const existingBalance = existingOpeningBalances.get(lot.id) || 0

    return {
      ...lot,
      total_annual_levy: totals.total_levy,
      amount_paid: totals.amount_paid,
      balance: totals.balance,
      existing_opening_balance: existingBalance,
      has_opening_balance: existingBalance > 0,
    }
  })

  return { data: enhancedLots }
}

/**
 * Apply opening balances to lots by creating payment records with payment_method='opening_balance'.
 * These payments get FIFO-allocated to outstanding levy items using the existing recordPayment logic.
 */
export async function applyOpeningBalances(data: {
  scheme_id: string
  balances: OpeningBalanceEntry[]
  opening_balance_date: string
}) {
  const parsed = applyOpeningBalancesSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Filter out zero-amount balances
  const nonZeroBalances = parsed.data.balances.filter(b => b.amount > 0)

  if (nonZeroBalances.length === 0) {
    return { error: 'No non-zero opening balances to apply' }
  }

  // Check if any lots already have opening balances
  const lotIds = nonZeroBalances.map(b => b.lot_id)
  const { data: existingPayments } = await supabase
    .from('payments')
    .select('lot_id')
    .eq('scheme_id', parsed.data.scheme_id)
    .eq('payment_method', 'opening_balance')
    .in('lot_id', lotIds)

  if (existingPayments && existingPayments.length > 0) {
    const existingLotIds = existingPayments.map(p => p.lot_id)
    return {
      error: `Some lots already have opening balances set. Please clear existing opening balances first for lots: ${existingLotIds.join(', ')}`,
    }
  }

  // Record each opening balance as a payment using the existing recordPayment action
  const results = []
  const errors = []

  for (const balance of nonZeroBalances) {
    const paymentData: PaymentFormData = {
      lot_id: balance.lot_id,
      amount: balance.amount,
      payment_date: parsed.data.opening_balance_date,
      payment_method: 'opening_balance',
      reference: 'Opening Balance',
      notes: 'Opening balance from mid-year onboarding',
    }

    const paymentResult = await recordPayment(parsed.data.scheme_id, paymentData)

    if (paymentResult.error) {
      errors.push({ lot_id: balance.lot_id, error: paymentResult.error })
    } else {
      results.push({ lot_id: balance.lot_id, payment: paymentResult.data })
    }
  }

  revalidatePath(`/schemes/${parsed.data.scheme_id}`)
  revalidatePath(`/schemes/${parsed.data.scheme_id}/opening-balances`)
  revalidatePath(`/schemes/${parsed.data.scheme_id}/levies`)
  revalidatePath(`/schemes/${parsed.data.scheme_id}/payments`)

  if (errors.length > 0) {
    return {
      error: `Failed to apply opening balances for ${errors.length} lot(s)`,
      data: { results, errors },
    }
  }

  return {
    data: {
      results,
      count: results.length,
      message: `Successfully applied opening balances to ${results.length} lot(s)`,
    },
  }
}

/**
 * Clear opening balances for a scheme (delete all opening_balance payment records).
 */
export async function clearOpeningBalances(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Delete opening balance payments (cascade will handle allocations)
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('scheme_id', schemeId)
    .eq('payment_method', 'opening_balance')

  if (error) return { error: error.message }

  revalidatePath(`/schemes/${schemeId}`)
  revalidatePath(`/schemes/${schemeId}/opening-balances`)
  revalidatePath(`/schemes/${schemeId}/levies`)
  revalidatePath(`/schemes/${schemeId}/payments`)

  return { data: { message: 'Opening balances cleared successfully' } }
}

/**
 * Check if a scheme has opening balances set.
 */
export async function checkOpeningBalancesStatus(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, lot_id, amount', { count: 'exact', head: false })
    .eq('scheme_id', schemeId)
    .eq('payment_method', 'opening_balance')

  if (error) return { error: error.message }

  return {
    data: {
      has_opening_balances: payments && payments.length > 0,
      count: payments?.length ?? 0,
      total_amount: payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0,
    },
  }
}
