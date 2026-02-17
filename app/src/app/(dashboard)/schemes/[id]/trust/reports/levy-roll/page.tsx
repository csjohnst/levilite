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
import { LevyRollTable } from '@/components/levies/levy-roll-table'
import { LevyRollPeriodSelector } from './period-selector'
import { ExportPDFButton } from '@/components/reports/export-pdf-button'

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function LevyRollReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ period?: string }>
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

  // Get all levy periods for this scheme (via levy_schedules)
  const { data: periods } = await supabase
    .from('levy_periods')
    .select(`
      id, period_name, period_start, period_end, due_date, status,
      levy_schedules!inner(scheme_id)
    `)
    .eq('levy_schedules.scheme_id', id)
    .order('period_start', { ascending: false })

  const availablePeriods = (periods ?? []).map(p => ({
    id: p.id,
    period_name: p.period_name,
    period_start: p.period_start,
    period_end: p.period_end,
    status: p.status,
  }))

  // Determine selected period
  const selectedPeriodId = filters.period || availablePeriods[0]?.id || null

  // Fetch levy items for the selected period
  let items: Array<{
    id: string
    lot_id: string
    admin_levy_amount: number
    capital_levy_amount: number
    special_levy_amount: number | null
    total_levy_amount: number
    amount_paid: number
    balance: number
    status: string
    due_date: string
    lots: {
      lot_number: string
      unit_number: string | null
      lot_ownerships: Array<{
        owners: {
          first_name: string
          last_name: string
        } | null
      }> | null
    } | null
  }> = []

  if (selectedPeriodId) {
    const { data: levyItems } = await supabase
      .from('levy_items')
      .select('*, lots(lot_number, unit_number, lot_ownerships(owners(first_name, last_name)))')
      .eq('levy_period_id', selectedPeriodId)
      .order('lots(lot_number)')

    items = (levyItems ?? []) as typeof items
  }

  // Summary stats
  const totalLevied = items.reduce((sum, i) => sum + i.total_levy_amount, 0)
  const totalPaid = items.reduce((sum, i) => sum + i.amount_paid, 0)
  const totalBalance = items.reduce((sum, i) => sum + i.balance, 0)
  const paidCount = items.filter(i => i.status === 'paid').length
  const collectionRate = totalLevied > 0
    ? Math.round((totalPaid / totalLevied) * 10000) / 100
    : 0

  const selectedPeriod = availablePeriods.find(p => p.id === selectedPeriodId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Levy Roll Report</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/trust/reports`} className="hover:underline">Reports</Link>
            {' '}&mdash; Levy Roll
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedPeriodId && (
            <ExportPDFButton
              schemeId={id}
              reportType="levy-roll"
              params={{ periodId: selectedPeriodId }}
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

      {/* Period selector */}
      <LevyRollPeriodSelector
        schemeId={id}
        periods={availablePeriods}
        selectedPeriodId={selectedPeriodId}
      />

      {availablePeriods.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No levy periods found. Create a levy schedule first.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Collection summary */}
          {items.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Levied</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold">{formatCurrency(totalLevied)}</p>
                  <p className="text-xs text-muted-foreground">{items.length} lot{items.length !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Collected</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaid)}</p>
                  <p className="text-xs text-muted-foreground">{paidCount} lot{paidCount !== 1 ? 's' : ''} fully paid</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Outstanding</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-lg font-bold ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(totalBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {totalBalance > 0 ? 'remaining' : 'fully collected'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Collection Rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-lg font-bold ${collectionRate >= 90 ? 'text-green-700' : collectionRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                    {collectionRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPeriod?.period_name ?? ''}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Levy roll table */}
          <Card>
            <CardHeader>
              <CardTitle>Levy Roll</CardTitle>
              <CardDescription>
                {items.length > 0
                  ? `${items.length} lot${items.length !== 1 ? 's' : ''} for ${selectedPeriod?.period_name ?? 'this period'}`
                  : 'No levy items for this period'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LevyRollTable items={items} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
