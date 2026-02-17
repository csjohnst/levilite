import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LevyRollTable } from '@/components/levies/levy-roll-table'
import { CalculateLeviesButton } from '@/components/levies/calculate-levies-button'

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const STATUS_STYLES: Record<string, { variant: 'default' | 'secondary' | 'outline'; className: string }> = {
  pending: { variant: 'outline', className: '' },
  active: { variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
  closed: { variant: 'secondary', className: 'bg-gray-100 text-gray-600' },
}

export default async function LevyRollPage({
  params,
}: {
  params: Promise<{ id: string; scheduleId: string; periodId: string }>
}) {
  const { id, scheduleId, periodId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch scheme
  const { data: scheme } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number')
    .eq('id', id)
    .single()

  if (!scheme) notFound()

  // Fetch period
  const { data: period, error: periodError } = await supabase
    .from('levy_periods')
    .select('*, levy_schedules(id, scheme_id, admin_fund_total, capital_works_fund_total, frequency, periods_per_year)')
    .eq('id', periodId)
    .single()

  if (periodError || !period) notFound()

  // Verify this period belongs to the correct schedule and scheme
  const schedule = period.levy_schedules as {
    id: string
    scheme_id: string
    admin_fund_total: number
    capital_works_fund_total: number
    frequency: string
    periods_per_year: number
  } | null

  if (!schedule || schedule.id !== scheduleId || schedule.scheme_id !== id) notFound()

  // Fetch levy items for this period, joined with lot and owner info
  const { data: levyItems } = await supabase
    .from('levy_items')
    .select('*, lots(lot_number, unit_number, lot_ownerships(owners(first_name, last_name)))')
    .eq('levy_period_id', periodId)
    .order('lots(lot_number)')

  const items = (levyItems ?? []) as Array<{
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
  }>

  const style = STATUS_STYLES[period.status] ?? STATUS_STYLES.pending

  // Summary stats
  const totalLevied = items.reduce((sum, i) => sum + i.total_levy_amount, 0)
  const totalPaid = items.reduce((sum, i) => sum + i.amount_paid, 0)
  const totalBalance = items.reduce((sum, i) => sum + i.balance, 0)
  const paidCount = items.filter(i => i.status === 'paid').length
  const overdueCount = items.filter(i => i.status === 'overdue').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{period.period_name}</h2>
            <Badge variant={style.variant} className={style.className}>
              {period.status.charAt(0).toUpperCase() + period.status.slice(1)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/levies`} className="hover:underline">Levy Schedules</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/levies/${scheduleId}`} className="hover:underline">
              {formatDate(period.period_start)} &ndash; {formatDate(period.period_end)}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          {items.length === 0 && (
            <CalculateLeviesButton
              schemeId={id}
              periodId={periodId}
            />
          )}
          <Button asChild variant="outline">
            <Link href={`/schemes/${id}/levies/${scheduleId}`}>
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      {/* Period details */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Period</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{formatDate(period.period_start)} &ndash; {formatDate(period.period_end)}</p>
            <p className="text-xs text-muted-foreground">Due: {formatDate(period.due_date)}</p>
          </CardContent>
        </Card>
        {items.length > 0 && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Collection</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">
                  {formatCurrency(totalPaid)} of {formatCurrency(totalLevied)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {paidCount} of {items.length} lots paid
                  {overdueCount > 0 && ` / ${overdueCount} overdue`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Outstanding</CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-sm font-medium ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(totalBalance)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalBalance > 0 ? 'remaining to collect' : 'fully collected'}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Levy roll table */}
      <Card>
        <CardHeader>
          <CardTitle>Levy Roll</CardTitle>
          <CardDescription>
            {items.length > 0
              ? `${items.length} lot${items.length !== 1 ? 's' : ''} with levies for this period`
              : 'No levy items generated for this period yet'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LevyRollTable items={items} />
        </CardContent>
      </Card>
    </div>
  )
}
