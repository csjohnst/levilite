import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BudgetEditor } from '@/components/budgets/budget-editor'

const FUND_LABELS: Record<string, string> = {
  admin: 'Admin Fund',
  capital_works: 'Capital Works Fund',
}

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string; budgetId: string }>
}) {
  const { id, budgetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scheme } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number, levy_frequency')
    .eq('id', id)
    .single()

  if (!scheme) notFound()

  // Fetch budget with line items and financial year
  const { data: budget } = await supabase
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

  if (!budget) notFound()

  // Get total unit entitlement for levy calculator
  const { data: lots } = await supabase
    .from('lots')
    .select('unit_entitlement')
    .eq('scheme_id', id)
    .eq('status', 'active')

  const totalEntitlement = lots?.reduce((sum, lot) => sum + (lot.unit_entitlement ?? 0), 0) ?? 0

  // Determine periods per year from scheme levy frequency
  const periodsMap: Record<string, number> = {
    monthly: 12,
    quarterly: 4,
    annual: 1,
  }
  const periodsPerYear = periodsMap[scheme.levy_frequency] ?? 4

  const fy = budget.financial_years as { id: string; year_label: string } | null
  const lineItems = (budget.budget_line_items ?? []) as Array<{
    id: string
    budgeted_amount: number
    previous_year_actual: number | null
    notes: string | null
    chart_of_accounts: {
      id: string
      code: string
      name: string
      account_type: string
      fund_type: string | null
    } | null
  }>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {fy?.year_label ?? 'Budget'} &mdash; {FUND_LABELS[budget.budget_type] ?? budget.budget_type}
          </h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/budgets`} className="hover:underline">Budgets</Link>
            {' '}&mdash; {fy?.year_label}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/schemes/${id}/budgets`}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Budgets
          </Link>
        </Button>
      </div>

      <BudgetEditor
        schemeId={id}
        budgetId={budgetId}
        status={budget.status}
        totalAmount={Number(budget.total_amount)}
        lineItems={lineItems}
        totalEntitlement={totalEntitlement}
        periodsPerYear={periodsPerYear}
      />
    </div>
  )
}
