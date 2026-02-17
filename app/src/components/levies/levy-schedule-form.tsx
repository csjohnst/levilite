'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { LevyScheduleFormData } from '@/actions/levy-schedules'

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

interface LevyScheduleFormProps {
  schemeId: string
  initialData?: Partial<LevyScheduleFormData>
  onSubmit: (data: LevyScheduleFormData) => Promise<{ data?: unknown; error?: string }>
  submitLabel?: string
}

const FREQUENCIES = [
  { value: 'quarterly', label: 'Quarterly', periods: 4 },
  { value: 'monthly', label: 'Monthly', periods: 12 },
  { value: 'annual', label: 'Annual', periods: 1 },
] as const

export function LevyScheduleForm({
  schemeId,
  initialData,
  onSubmit,
  submitLabel = 'Create Schedule',
}: LevyScheduleFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [frequency, setFrequency] = useState<string>(initialData?.frequency ?? 'quarterly')

  function getPeriodsForFrequency(freq: string): number {
    return FREQUENCIES.find(f => f.value === freq)?.periods ?? 4
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const freq = formData.get('frequency') as string

    const data = {
      budget_year_start: formData.get('budget_year_start') as string,
      budget_year_end: formData.get('budget_year_end') as string,
      admin_fund_total: Number(formData.get('admin_fund_total')),
      capital_works_fund_total: Number(formData.get('capital_works_fund_total')),
      frequency: freq,
      periods_per_year: getPeriodsForFrequency(freq),
    }

    const parsed = levyScheduleSchema.safeParse(data)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string
        if (!fieldErrors[field]) fieldErrors[field] = issue.message
      }
      setErrors(fieldErrors)
      setLoading(false)
      return
    }

    const result = await onSubmit(parsed.data)
    if (result.error) {
      toast.error(result.error)
      setLoading(false)
      return
    }

    toast.success('Levy schedule saved successfully')
    const schedule = result.data as { id: string }
    router.push(`/schemes/${schemeId}/levies/${schedule.id}`)
  }

  // Compute per-period preview
  const adminTotal = Number(initialData?.admin_fund_total) || 0
  const capitalTotal = Number(initialData?.capital_works_fund_total) || 0
  const periods = getPeriodsForFrequency(frequency)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Budget Year</CardTitle>
          <CardDescription>The financial year this levy schedule covers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget_year_start">Start Date</Label>
              <Input
                id="budget_year_start"
                name="budget_year_start"
                type="date"
                defaultValue={initialData?.budget_year_start ?? ''}
              />
              {errors.budget_year_start && (
                <p className="text-sm text-destructive">{errors.budget_year_start}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget_year_end">End Date</Label>
              <Input
                id="budget_year_end"
                name="budget_year_end"
                type="date"
                defaultValue={initialData?.budget_year_end ?? ''}
              />
              {errors.budget_year_end && (
                <p className="text-sm text-destructive">{errors.budget_year_end}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fund Budgets</CardTitle>
          <CardDescription>AGM-approved budget amounts for the year</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin_fund_total">Administrative Fund ($)</Label>
              <Input
                id="admin_fund_total"
                name="admin_fund_total"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 50000.00"
                defaultValue={initialData?.admin_fund_total ?? ''}
              />
              {errors.admin_fund_total && (
                <p className="text-sm text-destructive">{errors.admin_fund_total}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="capital_works_fund_total">Capital Works Fund ($)</Label>
              <Input
                id="capital_works_fund_total"
                name="capital_works_fund_total"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 20000.00"
                defaultValue={initialData?.capital_works_fund_total ?? ''}
              />
              {errors.capital_works_fund_total && (
                <p className="text-sm text-destructive">{errors.capital_works_fund_total}</p>
              )}
            </div>
          </div>
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Total Annual Budget</p>
            <p className="text-muted-foreground">
              ${((adminTotal + capitalTotal) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              {periods > 1 && ` (${((adminTotal + capitalTotal) / periods || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })} per period)`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Levy Frequency</CardTitle>
          <CardDescription>How often levies are issued to lot owners</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              name="frequency"
              defaultValue={initialData?.frequency ?? 'quarterly'}
              onValueChange={setFrequency}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label} ({f.periods} periods/year)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            This will create {periods} levy period{periods !== 1 ? 's' : ''} with due dates
            based on the scheme&apos;s configured levy due day.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
