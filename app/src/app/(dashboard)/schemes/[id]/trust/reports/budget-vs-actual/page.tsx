import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { BudgetVsActualTable } from '@/components/trust/budget-vs-actual-table'
import { getBudgetVsActual } from '@/actions/budgets'
import { BudgetVsActualSelectors } from './selectors'
import { ExportPDFButton } from '@/components/reports/export-pdf-button'

export default async function BudgetVsActualPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fy?: string; fund?: string }>
}) {
  const { id } = await params
  const filters = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scheme } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number')
    .eq('id', id)
    .single()

  if (!scheme) notFound()

  // Get available financial years for selector
  const { data: financialYears } = await supabase
    .from('financial_years')
    .select('id, year_label, start_date, end_date, is_current')
    .eq('scheme_id', id)
    .order('start_date', { ascending: false })

  const years = financialYears ?? []

  // Determine selected FY (from query params or current FY)
  const selectedFyId = filters.fy
    || years.find(y => y.is_current)?.id
    || years[0]?.id
    || null

  // Determine selected fund type
  const selectedFund = (filters.fund === 'capital_works' ? 'capital_works' : 'admin') as 'admin' | 'capital_works'

  // Fetch budget vs actual data
  let reportData: Awaited<ReturnType<typeof getBudgetVsActual>>['data'] = undefined
  let reportError: string | undefined

  if (selectedFyId) {
    const result = await getBudgetVsActual(id, selectedFyId, selectedFund)
    if ('error' in result && result.error) {
      reportError = result.error
    } else {
      reportData = result.data
    }
  }

  const selectedYear = years.find(y => y.id === selectedFyId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Budget vs Actual</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/trust/reports`} className="hover:underline">Reports</Link>
            {' '}&mdash; Budget vs Actual
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedFyId && (
            <ExportPDFButton
              schemeId={id}
              reportType="budget-vs-actual"
              params={{ financialYearId: selectedFyId, fundType: selectedFund }}
            />
          )}
          <Button asChild variant="outline">
            <Link href={`/schemes/${id}/trust/reports`}>
              <ArrowLeft className="mr-2 size-4" />
              Back to Reports
            </Link>
          </Button>
        </div>
      </div>

      {/* Selectors */}
      <BudgetVsActualSelectors
        schemeId={id}
        financialYears={years}
        selectedFyId={selectedFyId}
        selectedFund={selectedFund}
      />

      {selectedYear && (
        <div className="text-sm text-muted-foreground">
          Financial Year: {selectedYear.year_label} ({selectedYear.start_date} to {selectedYear.end_date})
          {' '}&mdash; Fund: {selectedFund === 'admin' ? 'Admin' : 'Capital Works'}
        </div>
      )}

      {years.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No financial years configured. Set up a financial year first.</p>
          </CardContent>
        </Card>
      ) : reportError ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>{reportError}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Budget vs Actual Comparison</CardTitle>
            <CardDescription>
              {reportData && reportData.length > 0
                ? `${reportData.length} budget categor${reportData.length !== 1 ? 'ies' : 'y'}`
                : 'No budget data available'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetVsActualTable rows={reportData ?? []} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
