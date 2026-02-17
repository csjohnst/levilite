'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const levyScheduleSchema = z.object({
  budget_year_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)'),
  budget_year_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)'),
  admin_fund_total: z.number().positive('Admin fund budget must be greater than zero'),
  capital_works_fund_total: z.number().min(0, 'Capital works fund cannot be negative'),
  frequency: z.enum(['annual', 'quarterly', 'monthly']),
  periods_per_year: z.number().refine(v => [1, 2, 4, 12].includes(v), {
    message: 'Periods must be 1 (annual), 2 (half-yearly), 4 (quarterly), or 12 (monthly)',
  }),
}).refine(data => data.budget_year_end > data.budget_year_start, {
  message: 'Budget year end must be after start date',
  path: ['budget_year_end'],
})

export type LevyScheduleFormData = z.infer<typeof levyScheduleSchema>

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  return { user, supabase }
}

export async function getLevySchedules(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: schedules, error } = await supabase
    .from('levy_schedules')
    .select('*, levy_periods(count)')
    .eq('scheme_id', schemeId)
    .order('budget_year_start', { ascending: false })

  if (error) return { error: error.message }
  return { data: schedules }
}

export async function getLevySchedule(scheduleId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: schedule, error } = await supabase
    .from('levy_schedules')
    .select('*, levy_periods(*)')
    .eq('id', scheduleId)
    .single()

  if (error) return { error: error.message }
  return { data: schedule }
}

export async function createLevySchedule(schemeId: string, data: LevyScheduleFormData) {
  const parsed = levyScheduleSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  // Insert the schedule
  const { data: schedule, error } = await supabase
    .from('levy_schedules')
    .insert({
      scheme_id: schemeId,
      budget_year_start: parsed.data.budget_year_start,
      budget_year_end: parsed.data.budget_year_end,
      admin_fund_total: parsed.data.admin_fund_total,
      capital_works_fund_total: parsed.data.capital_works_fund_total,
      frequency: parsed.data.frequency,
      periods_per_year: parsed.data.periods_per_year,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Get the scheme's levy_due_day for due date calculation
  const { data: scheme } = await supabase
    .from('schemes')
    .select('levy_due_day')
    .eq('id', schemeId)
    .single()

  const levyDueDay = scheme?.levy_due_day ?? 1

  // Auto-generate periods
  const periods = generatePeriods(
    parsed.data.budget_year_start,
    parsed.data.frequency,
    parsed.data.periods_per_year,
    levyDueDay,
    schedule.id,
  )

  if (periods.length > 0) {
    const { error: periodsError } = await supabase
      .from('levy_periods')
      .insert(periods)

    if (periodsError) {
      return { error: `Schedule created but period generation failed: ${periodsError.message}`, data: schedule }
    }
  }

  revalidatePath(`/schemes/${schemeId}`)
  revalidatePath(`/schemes/${schemeId}/levies`)
  return { data: schedule }
}

export async function updateLevySchedule(scheduleId: string, data: LevyScheduleFormData) {
  const parsed = levyScheduleSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Check if any levy_items already exist for this schedule's periods
  const { data: existingItems } = await supabase
    .from('levy_periods')
    .select('id, levy_items(count)')
    .eq('levy_schedule_id', scheduleId)

  const hasItems = existingItems?.some(
    (p) => {
      const counts = p.levy_items as unknown as { count: number }[]
      return counts?.[0]?.count > 0
    }
  )

  if (hasItems) {
    return { error: 'Cannot update schedule: levy items have already been generated for one or more periods' }
  }

  const { data: schedule, error } = await supabase
    .from('levy_schedules')
    .update({
      budget_year_start: parsed.data.budget_year_start,
      budget_year_end: parsed.data.budget_year_end,
      admin_fund_total: parsed.data.admin_fund_total,
      capital_works_fund_total: parsed.data.capital_works_fund_total,
      frequency: parsed.data.frequency,
      periods_per_year: parsed.data.periods_per_year,
    })
    .eq('id', scheduleId)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/schemes/${schedule.scheme_id}`)
  revalidatePath(`/schemes/${schedule.scheme_id}/levies`)
  return { data: schedule }
}

export async function deleteLevySchedule(scheduleId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Get schedule info for revalidation and check for items
  const { data: schedule } = await supabase
    .from('levy_schedules')
    .select('scheme_id')
    .eq('id', scheduleId)
    .single()

  if (!schedule) return { error: 'Schedule not found' }

  // Check if any levy_items exist — if so, deactivate instead of delete
  const { data: periods } = await supabase
    .from('levy_periods')
    .select('id, levy_items(count)')
    .eq('levy_schedule_id', scheduleId)

  const hasItems = periods?.some(
    (p) => {
      const counts = p.levy_items as unknown as { count: number }[]
      return counts?.[0]?.count > 0
    }
  )

  if (hasItems) {
    // Soft delete: deactivate
    const { error } = await supabase
      .from('levy_schedules')
      .update({ active: false })
      .eq('id', scheduleId)

    if (error) return { error: error.message }
  } else {
    // Hard delete: no items exist
    const { error } = await supabase
      .from('levy_schedules')
      .delete()
      .eq('id', scheduleId)

    if (error) return { error: error.message }
  }

  revalidatePath(`/schemes/${schedule.scheme_id}`)
  revalidatePath(`/schemes/${schedule.scheme_id}/levies`)
  return { data: true }
}

// --- Period generation helpers ---

function generatePeriods(
  budgetYearStart: string,
  frequency: string,
  periodsPerYear: number,
  levyDueDay: number,
  scheduleId: string,
) {
  const startDate = new Date(budgetYearStart + 'T00:00:00')
  const periods: {
    levy_schedule_id: string
    period_number: number
    period_name: string
    period_start: string
    period_end: string
    due_date: string
    status: string
  }[] = []

  for (let i = 0; i < periodsPerYear; i++) {
    const periodStart = new Date(startDate)
    const monthsPerPeriod = 12 / periodsPerYear

    // Advance start by i periods
    periodStart.setMonth(periodStart.getMonth() + i * monthsPerPeriod)

    // Period end is the last day of the last month in this period
    const periodEnd = new Date(periodStart)
    periodEnd.setMonth(periodEnd.getMonth() + monthsPerPeriod)
    periodEnd.setDate(periodEnd.getDate() - 1)

    // Due date: levy_due_day of the month after period starts
    // e.g., period starts Jul 1, due day = 31 => due Jul 31
    const dueDate = new Date(periodStart)
    // Clamp due day to last day of month
    const lastDayOfStartMonth = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth() + 1,
      0,
    ).getDate()
    dueDate.setDate(Math.min(levyDueDay, lastDayOfStartMonth))

    const periodName = getPeriodName(frequency, i + 1, periodStart)

    periods.push({
      levy_schedule_id: scheduleId,
      period_number: i + 1,
      period_name: periodName,
      period_start: formatDate(periodStart),
      period_end: formatDate(periodEnd),
      due_date: formatDate(dueDate),
      status: 'pending',
    })
  }

  return periods
}

function getPeriodName(frequency: string, periodNumber: number, periodStart: Date): string {
  const fy = getFYLabel(periodStart)
  switch (frequency) {
    case 'quarterly':
      return `Q${periodNumber} ${fy}`
    case 'monthly': {
      const monthName = periodStart.toLocaleString('en-AU', { month: 'short' })
      return `${monthName} ${fy}`
    }
    case 'annual':
      return `Annual ${fy}`
    default:
      return `Period ${periodNumber} ${fy}`
  }
}

function getFYLabel(date: Date): string {
  // Financial year label based on the year the period falls in
  // e.g., Jul 2026 -> FY2027 (Australian convention: FY ends June 30)
  const month = date.getMonth() // 0-indexed
  const year = date.getFullYear()
  if (month >= 6) {
    return `FY${year + 1}`
  }
  return `FY${year}`
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
