'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const paymentSchema = z.object({
  lot_id: z.string().uuid('Invalid lot'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)'),
  payment_method: z.enum(['bank_transfer', 'cheque', 'cash', 'direct_debit', 'bpay', 'opening_balance']),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type PaymentFormData = z.infer<typeof paymentSchema>

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  return { user, supabase }
}

/**
 * Record a payment for a lot and allocate it FIFO to outstanding levy items.
 *
 * FIFO allocation logic:
 * 1. Get outstanding levy_items for the lot, ordered by due_date ASC (oldest first)
 * 2. Allocate payment amount to each item:
 *    - If remaining >= item balance: fully pay the item, move to next
 *    - If remaining < item balance: partially pay the item, stop
 * 3. Insert payment_allocations for each allocation
 * 4. The DB trigger update_levy_item_on_payment_allocation handles updating amount_paid and status
 */
export async function recordPayment(schemeId: string, data: PaymentFormData) {
  const parsed = paymentSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  // 1. Insert the payment record
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      scheme_id: schemeId,
      lot_id: parsed.data.lot_id,
      amount: parsed.data.amount,
      payment_date: parsed.data.payment_date,
      payment_method: parsed.data.payment_method,
      reference: parsed.data.reference || null,
      notes: parsed.data.notes || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (paymentError || !payment) {
    return { error: paymentError?.message ?? 'Failed to record payment' }
  }

  // 2. Get outstanding levy items for this lot (FIFO: oldest due_date first)
  const { data: outstandingItems, error: itemsError } = await supabase
    .from('levy_items')
    .select('id, admin_levy_amount, capital_levy_amount, special_levy_amount, amount_paid, due_date, status')
    .eq('lot_id', parsed.data.lot_id)
    .eq('scheme_id', schemeId)
    .in('status', ['pending', 'sent', 'partial', 'overdue'])
    .order('due_date', { ascending: true })

  if (itemsError) {
    return {
      error: `Payment recorded but FIFO allocation failed: ${itemsError.message}`,
      data: { payment, allocations: [] },
    }
  }

  if (!outstandingItems || outstandingItems.length === 0) {
    // No outstanding items to allocate to - payment is recorded but unallocated
    revalidatePath(`/schemes/${schemeId}`)
    revalidatePath(`/schemes/${schemeId}/levies`)
    return {
      data: {
        payment,
        allocations: [],
        unallocatedAmount: parsed.data.amount,
        note: 'No outstanding levy items found for this lot. Payment recorded but not allocated.',
      },
    }
  }

  // 3. FIFO allocation
  let remainingAmount = parsed.data.amount
  const allocations: { payment_id: string; levy_item_id: string; allocated_amount: number }[] = []

  for (const item of outstandingItems) {
    if (remainingAmount <= 0) break

    const totalLevy = item.admin_levy_amount + item.capital_levy_amount + (item.special_levy_amount ?? 0)
    const itemBalance = Math.round((totalLevy - item.amount_paid) * 100) / 100

    if (itemBalance <= 0) continue

    const allocationAmount = Math.min(remainingAmount, itemBalance)
    // Round to 2 decimal places to avoid floating point issues
    const roundedAllocation = Math.round(allocationAmount * 100) / 100

    allocations.push({
      payment_id: payment.id,
      levy_item_id: item.id,
      allocated_amount: roundedAllocation,
    })

    remainingAmount = Math.round((remainingAmount - roundedAllocation) * 100) / 100
  }

  // 4. Insert payment allocations (triggers will update levy_items)
  if (allocations.length > 0) {
    const { error: allocError } = await supabase
      .from('payment_allocations')
      .insert(allocations)

    if (allocError) {
      return {
        error: `Payment recorded but allocation failed: ${allocError.message}`,
        data: { payment, allocations: [] },
      }
    }
  }

  // 5. Create a corresponding transaction in the trust accounting ledger
  // Map Phase 2 payment_method to Phase 3 payment_method
  const methodMap: Record<string, string> = {
    bank_transfer: 'eft',
    cheque: 'cheque',
    cash: 'cash',
    direct_debit: 'eft',
    bpay: 'bpay',
  }
  const txnPaymentMethod = methodMap[parsed.data.payment_method] ?? 'eft'

  // Look up the Levy Income - Admin category (code 4100)
  const { data: levyIncomeAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '4100')
    .or(`scheme_id.eq.${schemeId},scheme_id.is.null`)
    .order('scheme_id', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  let transaction = null
  if (levyIncomeAccount) {
    // Get lot info for description
    const { data: lot } = await supabase
      .from('lots')
      .select('lot_number')
      .eq('id', parsed.data.lot_id)
      .single()

    const lotLabel = lot?.lot_number ?? parsed.data.lot_id
    const refLabel = parsed.data.reference ? ` - ${parsed.data.reference}` : ''

    const { data: txn, error: txnError } = await supabase
      .from('transactions')
      .insert({
        scheme_id: schemeId,
        lot_id: parsed.data.lot_id,
        transaction_date: parsed.data.payment_date,
        transaction_type: 'receipt',
        fund_type: 'admin', // TODO: Split admin/CW portions into separate transactions per fund
        category_id: levyIncomeAccount.id,
        amount: parsed.data.amount,
        gst_amount: 0,
        description: `Levy payment - Lot ${lotLabel}${refLabel}`,
        reference: parsed.data.reference ?? null,
        payment_method: txnPaymentMethod,
        created_by: user.id,
      })
      .select()
      .single()

    if (!txnError && txn) {
      transaction = txn

      // Link payment_allocations to this transaction
      if (allocations.length > 0) {
        await supabase
          .from('payment_allocations')
          .update({ transaction_id: txn.id })
          .eq('payment_id', payment.id)
      }
    }
  }

  revalidatePath(`/schemes/${schemeId}`)
  revalidatePath(`/schemes/${schemeId}/levies`)
  revalidatePath(`/schemes/${schemeId}/payments`)
  revalidatePath(`/schemes/${schemeId}/trust-accounting`)
  revalidatePath(`/schemes/${schemeId}/trust-accounting/transactions`)

  return {
    data: {
      payment,
      transaction,
      allocations,
      totalAllocated: Math.round(allocations.reduce((sum, a) => sum + a.allocated_amount, 0) * 100) / 100,
      unallocatedAmount: remainingAmount > 0 ? remainingAmount : undefined,
      note: remainingAmount > 0
        ? `$${remainingAmount.toFixed(2)} could not be allocated (no more outstanding levy items). Consider recording a credit.`
        : undefined,
    },
  }
}

/**
 * Get all payments for a scheme.
 */
export async function getPayments(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      *,
      lots!inner(id, lot_number, unit_number),
      payment_allocations(
        id, allocated_amount,
        levy_items(id, due_date, status, levy_periods(period_name))
      )
    `)
    .eq('scheme_id', schemeId)
    .order('payment_date', { ascending: false })

  if (error) return { error: error.message }
  return { data: payments }
}

/**
 * Get payment history for a specific lot.
 */
export async function getPaymentsForLot(lotId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      *,
      payment_allocations(
        id, allocated_amount,
        levy_items(id, due_date, status, levy_periods(period_name))
      )
    `)
    .eq('lot_id', lotId)
    .order('payment_date', { ascending: false })

  if (error) return { error: error.message }
  return { data: payments }
}

/**
 * Get arrears data for a scheme: overdue levy items with lot and owner info.
 */
export async function getArrearsData(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: arrearsItems, error } = await supabase
    .from('levy_items')
    .select(`
      *,
      lots!inner(
        id, lot_number, unit_number,
        lot_ownerships(
          owners(id, first_name, last_name, email, phone_mobile)
        )
      ),
      levy_periods!inner(
        id, period_name, period_start, period_end
      )
    `)
    .eq('scheme_id', schemeId)
    .in('status', ['overdue', 'partial'])
    .order('due_date', { ascending: true })

  if (error) return { error: error.message }

  // Compute summary stats
  const totalOverdue = arrearsItems?.reduce((sum, item) => {
    const totalLevy = item.admin_levy_amount + item.capital_levy_amount + (item.special_levy_amount ?? 0)
    return sum + (totalLevy - item.amount_paid)
  }, 0) ?? 0

  const today = new Date()
  const aging = {
    under30: { count: 0, amount: 0 },
    days31to60: { count: 0, amount: 0 },
    days61to90: { count: 0, amount: 0 },
    over90: { count: 0, amount: 0 },
  }

  arrearsItems?.forEach(item => {
    const dueDate = new Date(item.due_date)
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    const balance = item.admin_levy_amount + item.capital_levy_amount + (item.special_levy_amount ?? 0) - item.amount_paid

    if (daysOverdue <= 30) {
      aging.under30.count++
      aging.under30.amount += balance
    } else if (daysOverdue <= 60) {
      aging.days31to60.count++
      aging.days31to60.amount += balance
    } else if (daysOverdue <= 90) {
      aging.days61to90.count++
      aging.days61to90.amount += balance
    } else {
      aging.over90.count++
      aging.over90.amount += balance
    }
  })

  // Round amounts
  aging.under30.amount = Math.round(aging.under30.amount * 100) / 100
  aging.days31to60.amount = Math.round(aging.days31to60.amount * 100) / 100
  aging.days61to90.amount = Math.round(aging.days61to90.amount * 100) / 100
  aging.over90.amount = Math.round(aging.over90.amount * 100) / 100

  return {
    data: {
      items: arrearsItems,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      lotsInArrears: new Set(arrearsItems?.map(i => i.lot_id)).size,
      aging,
    },
  }
}

/**
 * Get outstanding levy items for a lot (used by payment form to show allocation preview).
 */
export async function getOutstandingLevyItems(lotId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: items, error } = await supabase
    .from('levy_items')
    .select(`
      *,
      levy_periods!inner(
        id, period_name, period_start, period_end
      )
    `)
    .eq('lot_id', lotId)
    .in('status', ['pending', 'sent', 'partial', 'overdue'])
    .order('due_date', { ascending: true })

  if (error) return { error: error.message }
  return { data: items }
}

/**
 * Get the linked transaction for a payment (Phase 2 → Phase 3 bridge).
 * Looks up via payment_allocations.transaction_id.
 */
export async function getPaymentTransaction(paymentId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Find the transaction_id from payment_allocations for this payment
  const { data: allocation, error: allocError } = await supabase
    .from('payment_allocations')
    .select('transaction_id')
    .eq('payment_id', paymentId)
    .not('transaction_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (allocError) return { error: allocError.message }
  if (!allocation?.transaction_id) return { data: null }

  const { data: transaction, error: txnError } = await supabase
    .from('transactions')
    .select(`
      *,
      transaction_lines(id, account_id, line_type, amount, description,
        chart_of_accounts:account_id(id, code, name)
      )
    `)
    .eq('id', allocation.transaction_id)
    .single()

  if (txnError) return { error: txnError.message }
  return { data: transaction }
}
