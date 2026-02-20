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
import type { LotFormData } from '@/actions/lots'

const lotSchema = z.object({
  lot_number: z.string().min(1, 'Lot number is required'),
  unit_number: z.string().optional().nullable(),
  street_address: z.string().optional().nullable(),
  lot_type: z.enum(['residential', 'commercial', 'parking', 'storage', 'common-property', 'other']),
  unit_entitlement: z.number().int().min(0, 'Unit entitlement must be 0 or greater'),
  voting_entitlement: z.number().int().positive().optional().nullable(),
  floor_area_sqm: z.number().positive().optional().nullable(),
  balcony_area_sqm: z.number().positive().optional().nullable(),
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().min(0).optional().nullable(),
  car_bays: z.number().int().min(0).optional().nullable(),
  occupancy_status: z.enum(['owner-occupied', 'tenanted', 'vacant', 'common-property', 'unknown']),
  notes: z.string().optional().nullable(),
})

interface LotFormProps {
  schemeId: string
  initialData?: Partial<LotFormData>
  onSubmit: (data: LotFormData) => Promise<{ data?: unknown; error?: string }>
  submitLabel?: string
}

const LOT_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'parking', label: 'Parking' },
  { value: 'storage', label: 'Storage' },
  { value: 'common-property', label: 'Common Property' },
  { value: 'other', label: 'Other' },
] as const

const OCCUPANCY_STATUSES = [
  { value: 'owner-occupied', label: 'Owner Occupied' },
  { value: 'tenanted', label: 'Tenanted' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'common-property', label: 'Common Property' },
  { value: 'unknown', label: 'Unknown' },
] as const

export function LotForm({ schemeId, initialData, onSubmit, submitLabel = 'Save Lot' }: LotFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)

    const toNumberOrNull = (val: string | null) => {
      if (!val || val === '') return null
      const num = Number(val)
      return isNaN(num) ? null : num
    }

    const data: Record<string, unknown> = {
      lot_number: formData.get('lot_number') as string,
      unit_number: (formData.get('unit_number') as string) || null,
      street_address: (formData.get('street_address') as string) || null,
      lot_type: formData.get('lot_type') as string,
      unit_entitlement: Number(formData.get('unit_entitlement')),
      voting_entitlement: toNumberOrNull(formData.get('voting_entitlement') as string),
      floor_area_sqm: toNumberOrNull(formData.get('floor_area_sqm') as string),
      balcony_area_sqm: toNumberOrNull(formData.get('balcony_area_sqm') as string),
      bedrooms: toNumberOrNull(formData.get('bedrooms') as string),
      bathrooms: toNumberOrNull(formData.get('bathrooms') as string),
      car_bays: toNumberOrNull(formData.get('car_bays') as string),
      occupancy_status: formData.get('occupancy_status') as string,
      notes: (formData.get('notes') as string) || null,
    }

    const parsed = lotSchema.safeParse(data)
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

    toast.success('Lot saved successfully')
    router.push(`/schemes/${schemeId}?tab=lots`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Lot Details</CardTitle>
          <CardDescription>Basic lot identification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="lot_number">Lot Number</Label>
              <Input
                id="lot_number"
                name="lot_number"
                placeholder="e.g. 1"
                defaultValue={initialData?.lot_number ?? ''}
              />
              {errors.lot_number && (
                <p className="text-sm text-destructive">{errors.lot_number}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_number">Unit Number</Label>
              <Input
                id="unit_number"
                name="unit_number"
                placeholder="e.g. 101"
                defaultValue={initialData?.unit_number ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lot_type">Lot Type</Label>
              <Select name="lot_type" defaultValue={initialData?.lot_type ?? 'residential'}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="street_address">Street Address (if different from scheme)</Label>
            <Input
              id="street_address"
              name="street_address"
              defaultValue={initialData?.street_address ?? ''}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entitlements</CardTitle>
          <CardDescription>Voting and unit entitlements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="unit_entitlement">Unit Entitlement</Label>
              <Input
                id="unit_entitlement"
                name="unit_entitlement"
                type="number"
                min={1}
                defaultValue={initialData?.unit_entitlement ?? ''}
              />
              {errors.unit_entitlement && (
                <p className="text-sm text-destructive">{errors.unit_entitlement}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="voting_entitlement">Voting Entitlement (optional)</Label>
              <Input
                id="voting_entitlement"
                name="voting_entitlement"
                type="number"
                min={1}
                defaultValue={initialData?.voting_entitlement ?? ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Physical Details</CardTitle>
          <CardDescription>Size and amenities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="floor_area_sqm">Floor Area (sqm)</Label>
              <Input
                id="floor_area_sqm"
                name="floor_area_sqm"
                type="number"
                step="0.01"
                min={0}
                defaultValue={initialData?.floor_area_sqm ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balcony_area_sqm">Balcony Area (sqm)</Label>
              <Input
                id="balcony_area_sqm"
                name="balcony_area_sqm"
                type="number"
                step="0.01"
                min={0}
                defaultValue={initialData?.balcony_area_sqm ?? ''}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input
                id="bedrooms"
                name="bedrooms"
                type="number"
                min={0}
                defaultValue={initialData?.bedrooms ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input
                id="bathrooms"
                name="bathrooms"
                type="number"
                min={0}
                step="0.5"
                defaultValue={initialData?.bathrooms ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="car_bays">Car Bays</Label>
              <Input
                id="car_bays"
                name="car_bays"
                type="number"
                min={0}
                defaultValue={initialData?.car_bays ?? ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Occupancy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="occupancy_status">Occupancy Status</Label>
            <Select
              name="occupancy_status"
              defaultValue={initialData?.occupancy_status ?? 'owner-occupied'}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OCCUPANCY_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              name="notes"
              placeholder="Any additional notes about this lot..."
              defaultValue={initialData?.notes ?? ''}
              rows={3}
            />
          </div>
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
