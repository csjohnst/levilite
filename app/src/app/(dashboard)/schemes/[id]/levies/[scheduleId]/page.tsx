import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, DollarSign, Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  custom: 'Custom',
}

const PERIOD_STATUS_STYLES: Record<string, { variant: 'default' | 'secondary' | 'outline'; className: string }> = {
  pending: { variant: 'outline', className: '' },
  active: { variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
  closed: { variant: 'secondary', className: 'bg-gray-100 text-gray-600' },
}

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string; scheduleId: string }>
}) {
  const { id, scheduleId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch scheme for breadcrumb
  const { data: scheme } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number')
    .eq('id', id)
    .single()

  if (!scheme) notFound()

  // Fetch schedule with periods
  const { data: schedule, error } = await supabase
    .from('levy_schedules')
    .select('*, levy_periods(*)')
    .eq('id', scheduleId)
    .single()

  if (error || !schedule) notFound()

  const periods = (schedule.levy_periods as Array<{
    id: string
    period_number: number
    period_name: string
    period_start: string
    period_end: string
    due_date: string
    status: string
  }>) ?? []

  // Sort periods by period_number
  periods.sort((a, b) => a.period_number - b.period_number)

  // For each period, get a count of levy_items
  const periodIds = periods.map(p => p.id)
  let itemCounts: Record<string, number> = {}
  if (periodIds.length > 0) {
    const { data: items } = await supabase
      .from('levy_items')
      .select('levy_period_id')
      .in('levy_period_id', periodIds)

    if (items) {
      for (const item of items) {
        itemCounts[item.levy_period_id] = (itemCounts[item.levy_period_id] ?? 0) + 1
      }
    }
  }

  const totalBudget = schedule.admin_fund_total + schedule.capital_works_fund_total

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {formatDate(schedule.budget_year_start)} &ndash; {formatDate(schedule.budget_year_end)}
            </h2>
            {!schedule.active && (
              <Badge variant="outline">Archived</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/levies`} className="hover:underline">Levy Schedules</Link>
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/schemes/${id}/levies`}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Schedules
          </Link>
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Admin Fund</CardDescription>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{formatCurrency(schedule.admin_fund_total)}</CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Capital Works</CardDescription>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{formatCurrency(schedule.capital_works_fund_total)}</CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Budget</CardDescription>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{formatCurrency(totalBudget)}</CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Frequency</CardDescription>
            <Calendar className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{FREQ_LABELS[schedule.frequency] ?? schedule.frequency}</CardTitle>
            <p className="text-xs text-muted-foreground">{periods.length} period{periods.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* Periods table */}
      <Card>
        <CardHeader>
          <CardTitle>Levy Periods</CardTitle>
          <CardDescription>
            Each period represents a billing cycle. Click a period to view the levy roll.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {periods.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((period) => {
                    const style = PERIOD_STATUS_STYLES[period.status] ?? PERIOD_STATUS_STYLES.pending
                    const count = itemCounts[period.id] ?? 0

                    return (
                      <TableRow key={period.id}>
                        <TableCell className="font-medium">{period.period_number}</TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/schemes/${id}/levies/${scheduleId}/${period.id}`}
                            className="hover:underline"
                          >
                            {period.period_name}
                          </Link>
                        </TableCell>
                        <TableCell>{formatDate(period.period_start)}</TableCell>
                        <TableCell>{formatDate(period.period_end)}</TableCell>
                        <TableCell>{formatDate(period.due_date)}</TableCell>
                        <TableCell>
                          {count > 0 ? (
                            <Badge variant="secondary">{count} items</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={style.variant} className={style.className}>
                            {period.status.charAt(0).toUpperCase() + period.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/schemes/${id}/levies/${scheduleId}/${period.id}`}>
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <Clock className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No periods generated</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Periods should have been auto-generated when the schedule was created.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
