'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// --- Auth helper ---

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  return { user, supabase }
}

// --- Zod Schemas ---

const createBudgetSchema = z.object({
  financial_year_id: z.string().uuid('Invalid financial year'),
  budget_type: z.enum(['admin', 'capital_works']),
  notes: z.string().max(2000).optional().nullable(),
})

const updateLineItemSchema = z.object({
  budgeted_amount: z.number().min(0, 'Amount must be non-negative'),
  notes: z.string().max(2000).optional().nullable(),
})

export type CreateBudgetFormData = z.infer<typeof createBudgetSchema>
export type UpdateLineItemFormData = z.infer<typeof updateLineItemSchema>

// --- Exported types ---

export interface BudgetVsActualRow {
  category_id: string
  category_code: string
  category_name: string
  budgeted_amount: number
  actual_amount: number
  variance: number
  variance_pct: number | null
  status: 'on_track' | 'monitor' | 'over_budget'
}

// --- Budget Actions ---

/**
 * Create a new budget for a scheme + financial year + fund type.
 * Auto-populates line items from chart_of_accounts (expense + income accounts matching fund type).
 * If a previous year budget exists, populates previous_year_actual from transaction totals.
 */
export async function createBudget(schemeId: string, data: CreateBudgetFormData) {
  const parsed = createBudgetSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  // Check if budget already exists for this scheme + FY + type
  const { data: existing } = await supabase
    .from('budgets')
    .select('id')
    .eq('scheme_id', schemeId)
    .eq('financial_year_id', parsed.data.financial_year_id)
    .eq('budget_type', parsed.data.budget_type)
    .maybeSingle()

  if (existing) {
    return { error: 'A budget already exists for this scheme, financial year, and fund type' }
  }

  // Create the budget record
  const { data: budget, error: insertError } = await supabase
    .from('budgets')
    .insert({
      scheme_id: schemeId,
      financial_year_id: parsed.data.financial_year_id,
      budget_type: parsed.data.budget_type,
      notes: parsed.data.notes || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError) return { error: insertError.message }

  // Get relevant GL accounts (income + expense accounts matching fund type or no fund type)
  const { data: accounts, error: accountsError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, fund_type')
    .or(`scheme_id.eq.${schemeId},scheme_id.is.null`)
    .in('account_type', ['income', 'expense'])
    .or(`fund_type.eq.${parsed.data.budget_type},fund_type.is.null`)
    .eq('is_active', true)
    .order('code', { ascending: true })

  if (accountsError) return { error: accountsError.message }

  // Deduplicate: prefer scheme-specific accounts over org-level defaults
  const accountMap = new Map<string, typeof accounts[0]>()
  accounts?.forEach(acct => {
    const existing = accountMap.get(acct.code)
    if (!existing) {
      accountMap.set(acct.code, acct)
    }
  })
  const dedupedAccounts = Array.from(accountMap.values())

  // Try to get previous year actuals
  const { data: currentFY } = await supabase
    .from('financial_years')
    .select('start_date, end_date')
    .eq('id', parsed.data.financial_year_id)
    .single()

  let previousActuals = new Map<string, number>()
  if (currentFY) {
    // Find the previous financial year by looking for one ending before this one starts
    const { data: prevFY } = await supabase
      .from('financial_years')
      .select('start_date, end_date')
      .eq('scheme_id', schemeId)
      .lt('end_date', currentFY.start_date)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (prevFY) {
      // Get actual transaction totals per category for the previous year
      const { data: prevTxns } = await supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('scheme_id', schemeId)
        .eq('fund_type', parsed.data.budget_type)
        .is('deleted_at', null)
        .gte('transaction_date', prevFY.start_date)
        .lte('transaction_date', prevFY.end_date)

      prevTxns?.forEach(txn => {
        if (txn.category_id) {
          const current = previousActuals.get(txn.category_id) ?? 0
          previousActuals.set(txn.category_id, Math.round((current + txn.amount) * 100) / 100)
        }
      })
    }
  }

  // Create budget line items
  if (dedupedAccounts.length > 0) {
    const lineItems = dedupedAccounts.map(acct => ({
      budget_id: budget.id,
      category_id: acct.id,
      budgeted_amount: 0,
      previous_year_actual: previousActuals.get(acct.id) ?? null,
    }))

    const { error: lineError } = await supabase
      .from('budget_line_items')
      .insert(lineItems)

    if (lineError) return { error: `Budget created but line items failed: ${lineError.message}` }
  }

  revalidatePath(`/schemes/${schemeId}/budgets`)
  return { data: budget }
}

/**
 * List all budgets for a scheme, joined with financial year labels.
 */
export async function getBudgets(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: budgets, error } = await supabase
    .from('budgets')
    .select(`
      *,
      financial_years:financial_year_id(id, year_label, start_date, end_date, is_current),
      budget_line_items(count)
    `)
    .eq('scheme_id', schemeId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data: budgets }
}

/**
 * Get a single budget with all line items joined with chart_of_accounts.
 */
export async function getBudget(budgetId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: budget, error } = await supabase
    .from('budgets')
    .select(`
      *,
      financial_years:financial_year_id(id, year_label, start_date, end_date, is_current),
      budget_line_items(
        id, budgeted_amount, previous_year_actual, notes,
        chart_of_accounts:category_id(id, code, name, account_type, fund_type)
      )
    `)
    .eq('id', budgetId)
    .single()

  if (error) return { error: error.message }
  return { data: budget }
}

/**
 * Update a single budget line item's amount and notes.
 * Recalculates the budget's total_amount.
 */
export async function updateBudgetLineItem(lineItemId: string, data: UpdateLineItemFormData) {
  const parsed = updateLineItemSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Update the line item
  const { data: lineItem, error: updateError } = await supabase
    .from('budget_line_items')
    .update({
      budgeted_amount: parsed.data.budgeted_amount,
      notes: parsed.data.notes || null,
    })
    .eq('id', lineItemId)
    .select('budget_id')
    .single()

  if (updateError) return { error: updateError.message }

  // Recalculate budget total
  const { data: allLines, error: linesError } = await supabase
    .from('budget_line_items')
    .select('budgeted_amount')
    .eq('budget_id', lineItem.budget_id)

  if (linesError) return { error: linesError.message }

  const totalAmount = Math.round(
    (allLines?.reduce((sum, l) => sum + Number(l.budgeted_amount), 0) ?? 0) * 100,
  ) / 100

  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .update({ total_amount: totalAmount })
    .eq('id', lineItem.budget_id)
    .select('scheme_id')
    .single()

  if (budgetError) return { error: budgetError.message }

  revalidatePath(`/schemes/${budget.scheme_id}/budgets`)
  return { data: { lineItemId, totalAmount } }
}

/**
 * Approve a budget. Sets status to 'approved' and records the approval date.
 * Only works if current status is 'draft' or 'review'.
 */
export async function approveBudget(budgetId: string, approvedAt: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Check current status
  const { data: current, error: fetchError } = await supabase
    .from('budgets')
    .select('status, scheme_id')
    .eq('id', budgetId)
    .single()

  if (fetchError) return { error: fetchError.message }

  if (current.status !== 'draft' && current.status !== 'review') {
    return { error: `Cannot approve a budget with status "${current.status}". Must be "draft" or "review".` }
  }

  const { data: budget, error } = await supabase
    .from('budgets')
    .update({
      status: 'approved',
      approved_at: approvedAt,
    })
    .eq('id', budgetId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/schemes/${current.scheme_id}/budgets`)
  return { data: budget }
}

/**
 * Generate budget vs actual report data.
 * For each budget line item, queries actual transaction totals and calculates variance.
 */
export async function getBudgetVsActual(
  schemeId: string,
  financialYearId: string,
  fundType: 'admin' | 'capital_works',
): Promise<{ data?: BudgetVsActualRow[]; error?: string }> {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Get the financial year date range
  const { data: fy, error: fyError } = await supabase
    .from('financial_years')
    .select('start_date, end_date')
    .eq('id', financialYearId)
    .single()

  if (fyError) return { error: fyError.message }

  // Get the budget with line items
  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select(`
      id,
      budget_line_items(
        id, budgeted_amount,
        chart_of_accounts:category_id(id, code, name)
      )
    `)
    .eq('scheme_id', schemeId)
    .eq('financial_year_id', financialYearId)
    .eq('budget_type', fundType)
    .maybeSingle()

  if (budgetError) return { error: budgetError.message }
  if (!budget) return { error: 'No budget found for this scheme, financial year, and fund type' }

  // Get actual transaction totals grouped by category
  const { data: actuals, error: actualsError } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('scheme_id', schemeId)
    .eq('fund_type', fundType)
    .is('deleted_at', null)
    .gte('transaction_date', fy.start_date)
    .lte('transaction_date', fy.end_date)

  if (actualsError) return { error: actualsError.message }

  // Sum actuals by category
  const actualsByCategory = new Map<string, number>()
  actuals?.forEach(txn => {
    if (txn.category_id) {
      const current = actualsByCategory.get(txn.category_id) ?? 0
      actualsByCategory.set(txn.category_id, current + txn.amount)
    }
  })

  // Build report rows
  const rows: BudgetVsActualRow[] = (budget.budget_line_items ?? []).map((item: Record<string, unknown>) => {
    const acct = item.chart_of_accounts as { id: string; code: string; name: string } | null
    if (!acct) return null

    const budgeted = Number(item.budgeted_amount as number)
    const actual = Math.round((actualsByCategory.get(acct.id) ?? 0) * 100) / 100
    const variance = Math.round((actual - budgeted) * 100) / 100
    const variancePct = budgeted !== 0
      ? Math.round(((actual - budgeted) / budgeted) * 10000) / 100
      : null

    let status: 'on_track' | 'monitor' | 'over_budget' = 'on_track'
    if (variancePct !== null) {
      if (variancePct > 10) status = 'over_budget'
      else if (variancePct > 0) status = 'monitor'
    } else if (actual > 0 && budgeted === 0) {
      status = 'over_budget'
    }

    return {
      category_id: acct.id,
      category_code: acct.code,
      category_name: acct.name,
      budgeted_amount: budgeted,
      actual_amount: actual,
      variance,
      variance_pct: variancePct,
      status,
    }
  }).filter((row: BudgetVsActualRow | null): row is BudgetVsActualRow => row !== null)
    .sort((a: BudgetVsActualRow, b: BudgetVsActualRow) => a.category_code.localeCompare(b.category_code))

  return { data: rows }
}

/**
 * Delete a budget and cascade delete its line items.
 * Only allowed if status is 'draft'.
 */
export async function deleteBudget(budgetId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Check current status
  const { data: current, error: fetchError } = await supabase
    .from('budgets')
    .select('status, scheme_id')
    .eq('id', budgetId)
    .single()

  if (fetchError) return { error: fetchError.message }

  if (current.status !== 'draft') {
    return { error: `Cannot delete a budget with status "${current.status}". Only draft budgets can be deleted.` }
  }

  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId)

  if (error) return { error: error.message }

  revalidatePath(`/schemes/${current.scheme_id}/budgets`)
  return { data: true }
}
