'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import type { SchemeFormData } from '@/actions/schemes'

const schemeSchema = z.object({
  scheme_number: z.string().regex(/^SP\s?\d{4,6}$/, 'Scheme number must be in format "SP 12345"'),
  scheme_name: z.string().min(3, 'Scheme name must be at least 3 characters').max(255),
  scheme_type: z.enum(['strata', 'survey-strata', 'community']),
  street_address: z.string().min(1, 'Street address is required'),
  suburb: z.string().min(1, 'Suburb is required'),
  state: z.enum(['WA', 'NSW', 'VIC', 'QLD', 'SA', 'TAS', 'NT', 'ACT']),
  postcode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
  abn: z.string().regex(/^\d{11}$/).optional().nullable(),
  acn: z.string().regex(/^\d{9}$/).optional().nullable(),
  registered_name: z.string().max(255).optional().nullable(),
  financial_year_end_month: z.number().min(1).max(12),
  financial_year_end_day: z.number().min(1).max(31),
  levy_frequency: z.enum(['monthly', 'quarterly', 'annual', 'custom']),
  levy_due_day: z.number().min(1).max(28),
  notes: z.string().optional().nullable(),
})

interface SchemeFormProps {
  initialData?: Partial<SchemeFormData>
  onSubmit: (data: SchemeFormData) => Promise<{ data?: unknown; error?: string }>
  submitLabel?: string
}

const STATES = ['WA', 'NSW', 'VIC', 'QLD', 'SA', 'TAS', 'NT', 'ACT'] as const
const SCHEME_TYPES = [
  { value: 'strata', label: 'Strata' },
  { value: 'survey-strata', label: 'Survey Strata' },
  { value: 'community', label: 'Community' },
] as const
const LEVY_FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'custom', label: 'Custom' },
] as const
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function SchemeForm({ initialData, onSubmit, submitLabel = 'Save Scheme' }: SchemeFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showLegal, setShowLegal] = useState(
    !!(initialData?.abn || initialData?.acn || initialData?.registered_name)
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {
      scheme_number: formData.get('scheme_number') as string,
      scheme_name: formData.get('scheme_name') as string,
      scheme_type: formData.get('scheme_type') as string,
      street_address: formData.get('street_address') as string,
      suburb: formData.get('suburb') as string,
      state: formData.get('state') as string,
      postcode: formData.get('postcode') as string,
      abn: (formData.get('abn') as string) || null,
      acn: (formData.get('acn') as string) || null,
      registered_name: (formData.get('registered_name') as string) || null,
      financial_year_end_month: Number(formData.get('financial_year_end_month')),
      financial_year_end_day: Number(formData.get('financial_year_end_day')),
      levy_frequency: formData.get('levy_frequency') as string,
      levy_due_day: Number(formData.get('levy_due_day')),
      notes: (formData.get('notes') as string) || null,
    }

    const parsed = schemeSchema.safeParse(data)
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

    toast.success('Scheme saved successfully')
    const scheme = result.data as { id: string }
    router.push(`/schemes/${scheme.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Scheme identification details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scheme_number">Scheme Number</Label>
              <Input
                id="scheme_number"
                name="scheme_number"
                placeholder="SP 12345"
                defaultValue={initialData?.scheme_number ?? ''}
              />
              {errors.scheme_number && (
                <p className="text-sm text-destructive">{errors.scheme_number}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheme_type">Scheme Type</Label>
              <Select name="scheme_type" defaultValue={initialData?.scheme_type ?? 'strata'}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEME_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheme_name">Scheme Name</Label>
            <Input
              id="scheme_name"
              name="scheme_name"
              placeholder="e.g. Harbour View Apartments"
              defaultValue={initialData?.scheme_name ?? ''}
            />
            {errors.scheme_name && (
              <p className="text-sm text-destructive">{errors.scheme_name}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Scheme location</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street_address">Street Address</Label>
            <Input
              id="street_address"
              name="street_address"
              defaultValue={initialData?.street_address ?? ''}
            />
            {errors.street_address && (
              <p className="text-sm text-destructive">{errors.street_address}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="suburb">Suburb</Label>
              <Input
                id="suburb"
                name="suburb"
                defaultValue={initialData?.suburb ?? ''}
              />
              {errors.suburb && (
                <p className="text-sm text-destructive">{errors.suburb}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select name="state" defaultValue={initialData?.state ?? 'WA'}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                name="postcode"
                maxLength={4}
                defaultValue={initialData?.postcode ?? ''}
              />
              {errors.postcode && (
                <p className="text-sm text-destructive">{errors.postcode}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowLegal(!showLegal)}>
          <CardTitle className="flex items-center justify-between">
            Legal Details
            <span className="text-sm font-normal text-muted-foreground">
              {showLegal ? 'Hide' : 'Show'} (optional)
            </span>
          </CardTitle>
          <CardDescription>ABN, ACN, and registered name</CardDescription>
        </CardHeader>
        {showLegal && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="abn">ABN</Label>
                <Input
                  id="abn"
                  name="abn"
                  maxLength={11}
                  placeholder="11 digit ABN"
                  defaultValue={initialData?.abn ?? ''}
                />
                {errors.abn && (
                  <p className="text-sm text-destructive">{errors.abn}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="acn">ACN</Label>
                <Input
                  id="acn"
                  name="acn"
                  maxLength={9}
                  placeholder="9 digit ACN"
                  defaultValue={initialData?.acn ?? ''}
                />
                {errors.acn && (
                  <p className="text-sm text-destructive">{errors.acn}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registered_name">Registered Name</Label>
              <Input
                id="registered_name"
                name="registered_name"
                defaultValue={initialData?.registered_name ?? ''}
              />
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial Settings</CardTitle>
          <CardDescription>Financial year and levy schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="financial_year_end_month">Financial Year End Month</Label>
              <Select
                name="financial_year_end_month"
                defaultValue={String(initialData?.financial_year_end_month ?? 6)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="financial_year_end_day">Financial Year End Day</Label>
              <Input
                id="financial_year_end_day"
                name="financial_year_end_day"
                type="number"
                min={1}
                max={31}
                defaultValue={initialData?.financial_year_end_day ?? 30}
              />
              {errors.financial_year_end_day && (
                <p className="text-sm text-destructive">{errors.financial_year_end_day}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="levy_frequency">Levy Frequency</Label>
              <Select
                name="levy_frequency"
                defaultValue={initialData?.levy_frequency ?? 'quarterly'}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVY_FREQUENCIES.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="levy_due_day">Levy Due Day (of month)</Label>
              <Input
                id="levy_due_day"
                name="levy_due_day"
                type="number"
                min={1}
                max={28}
                defaultValue={initialData?.levy_due_day ?? 1}
              />
              {errors.levy_due_day && (
                <p className="text-sm text-destructive">{errors.levy_due_day}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            name="notes"
            placeholder="Any additional notes about this scheme..."
            defaultValue={initialData?.notes ?? ''}
            rows={4}
          />
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
