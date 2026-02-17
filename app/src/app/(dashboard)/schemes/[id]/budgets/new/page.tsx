import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BudgetForm } from '@/components/budgets/budget-form'

export default async function NewBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scheme } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number')
    .eq('id', id)
    .single()

  if (!scheme) notFound()

  // Fetch financial years
  const { data: financialYears } = await supabase
    .from('financial_years')
    .select('id, year_label, start_date, end_date, is_current')
    .eq('scheme_id', id)
    .order('start_date', { ascending: false })

  // Fetch existing budgets to prevent duplicates
  const { data: existingBudgets } = await supabase
    .from('budgets')
    .select('financial_year_id, budget_type')
    .eq('scheme_id', id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Create Budget</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/budgets`} className="hover:underline">Budgets</Link>
            {' '}&mdash; New
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/schemes/${id}/budgets`}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Budgets
          </Link>
        </Button>
      </div>

      <BudgetForm
        schemeId={id}
        financialYears={financialYears ?? []}
        existingBudgets={(existingBudgets ?? []).map(b => ({
          financial_year_id: b.financial_year_id,
          budget_type: b.budget_type,
        }))}
      />
    </div>
  )
}
