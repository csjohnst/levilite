import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LevyScheduleForm } from '@/components/levies/levy-schedule-form'
import { createLevySchedule } from '@/actions/levy-schedules'

export default async function NewLevySchedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scheme, error } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number, financial_year_end_month, financial_year_end_day, levy_frequency')
    .eq('id', id)
    .single()

  if (error || !scheme) notFound()

  // Pre-compute default budget year dates from scheme's FY settings
  const now = new Date()
  const fyEndMonth = scheme.financial_year_end_month // 1-indexed
  const fyEndDay = scheme.financial_year_end_day

  // Determine the current FY start
  let fyStartYear = now.getFullYear()
  // If we're past the FY end, the current FY started this year; otherwise last year
  const fyEndThisYear = new Date(fyStartYear, fyEndMonth - 1, fyEndDay)
  if (now > fyEndThisYear) {
    // We're in the FY that started after fyEndThisYear
    fyStartYear = fyStartYear
  } else {
    fyStartYear = fyStartYear - 1
  }

  // FY start = day after last FY end
  const fyStart = new Date(fyStartYear, fyEndMonth - 1, fyEndDay + 1)
  const fyEnd = new Date(fyStartYear + 1, fyEndMonth - 1, fyEndDay)

  const pad = (n: number) => String(n).padStart(2, '0')
  const defaultStart = `${fyStart.getFullYear()}-${pad(fyStart.getMonth() + 1)}-${pad(fyStart.getDate())}`
  const defaultEnd = `${fyEnd.getFullYear()}-${pad(fyEnd.getMonth() + 1)}-${pad(fyEnd.getDate())}`

  // Map scheme levy_frequency to schedule frequency
  const freqMap: Record<string, string> = {
    monthly: 'monthly',
    quarterly: 'quarterly',
    annual: 'annual',
    custom: 'quarterly',
  }

  async function handleCreate(data: Parameters<typeof createLevySchedule>[1]) {
    'use server'
    return createLevySchedule(id, data)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Levy Schedule</h2>
        <p className="text-muted-foreground">
          <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
          {' '}&mdash;{' '}
          <Link href={`/schemes/${id}/levies`} className="hover:underline">Levy Schedules</Link>
        </p>
      </div>

      <LevyScheduleForm
        schemeId={id}
        initialData={{
          budget_year_start: defaultStart,
          budget_year_end: defaultEnd,
          frequency: freqMap[scheme.levy_frequency] as 'annual' | 'quarterly' | 'monthly',
        }}
        onSubmit={handleCreate}
        submitLabel="Create Schedule"
      />
    </div>
  )
}
