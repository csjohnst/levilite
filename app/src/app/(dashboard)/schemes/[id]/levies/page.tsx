import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Plus, Calendar, DollarSign, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
import { LevyScheduleActions } from '@/components/levies/levy-schedule-actions'

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

export default async function LevySchedulesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify scheme exists and belongs to user's org
  const { data: scheme, error: schemeError } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number')
    .eq('id', id)
    .single()

  if (schemeError || !scheme) notFound()

  // Fetch levy schedules with period counts
  const { data: schedules } = await supabase
    .from('levy_schedules')
    .select('*, levy_periods(count)')
    .eq('scheme_id', id)
    .order('budget_year_start', { ascending: false })

  const activeSchedules = schedules?.filter(s => s.active) ?? []
  const inactiveSchedules = schedules?.filter(s => !s.active) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Levy Schedules</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash; {scheme.scheme_number}
          </p>
        </div>
        <Button asChild>
          <Link href={`/schemes/${id}/levies/new`}>
            <Plus className="mr-2 size-4" />
            New Schedule
          </Link>
        </Button>
      </div>

      {activeSchedules.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Budget Year</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Admin Fund</TableHead>
                <TableHead className="text-right">Capital Works</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Periods</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSchedules.map((schedule) => {
                const periodCounts = schedule.levy_periods as unknown as { count: number }[]
                const periodCount = periodCounts?.[0]?.count ?? 0
                const total = schedule.admin_fund_total + schedule.capital_works_fund_total

                return (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/schemes/${id}/levies/${schedule.id}`}
                        className="hover:underline"
                      >
                        {formatDate(schedule.budget_year_start)} &ndash; {formatDate(schedule.budget_year_end)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {FREQ_LABELS[schedule.frequency] ?? schedule.frequency}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(schedule.admin_fund_total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(schedule.capital_works_fund_total)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{periodCount} period{periodCount !== 1 ? 's' : ''}</Badge>
                    </TableCell>
                    <TableCell>
                      <LevyScheduleActions schemeId={id} scheduleId={schedule.id} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No levy schedules yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a levy schedule to start issuing levies for this scheme.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/schemes/${id}/levies/new`}>
                <Plus className="mr-2 size-4" />
                Create First Schedule
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {inactiveSchedules.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Archived Schedules</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Budget Year</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveSchedules.map((schedule) => {
                  const total = schedule.admin_fund_total + schedule.capital_works_fund_total
                  return (
                    <TableRow key={schedule.id} className="text-muted-foreground">
                      <TableCell>
                        <Link
                          href={`/schemes/${id}/levies/${schedule.id}`}
                          className="hover:underline"
                        >
                          {formatDate(schedule.budget_year_start)} &ndash; {formatDate(schedule.budget_year_end)}
                        </Link>
                      </TableCell>
                      <TableCell>{FREQ_LABELS[schedule.frequency] ?? schedule.frequency}</TableCell>
                      <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">Archived</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
