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
import type { OwnerFormData } from '@/actions/owners'

const ownerSchema = z.object({
  title: z.string().optional().nullable(),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  middle_name: z.string().optional().nullable(),
  preferred_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  email_secondary: z.string().email().optional().nullable(),
  phone_mobile: z.string().optional().nullable(),
  phone_home: z.string().optional().nullable(),
  phone_work: z.string().optional().nullable(),
  postal_address_line1: z.string().optional().nullable(),
  postal_address_line2: z.string().optional().nullable(),
  postal_suburb: z.string().optional().nullable(),
  postal_state: z.string().optional().nullable(),
  postal_postcode: z.string().optional().nullable(),
  abn: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  correspondence_method: z.enum(['email', 'postal', 'both']),
  notes: z.string().optional().nullable(),
})

interface OwnerFormProps {
  schemeId: string
  initialData?: Partial<OwnerFormData>
  onSubmit: (data: OwnerFormData) => Promise<{ data?: unknown; error?: string }>
  submitLabel?: string
}

const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof']
const STATES = ['WA', 'NSW', 'VIC', 'QLD', 'SA', 'TAS', 'NT', 'ACT']
const CORRESPONDENCE_METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'postal', label: 'Postal' },
  { value: 'both', label: 'Both' },
] as const

export function OwnerForm({ schemeId, initialData, onSubmit, submitLabel = 'Save Owner' }: OwnerFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPostal, setShowPostal] = useState(
    !!(initialData?.postal_address_line1)
  )
  const [showCorporate, setShowCorporate] = useState(
    !!(initialData?.abn || initialData?.company_name)
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const orNull = (val: string | null) => (!val || val === 'none') ? null : val

    const data: Record<string, unknown> = {
      title: orNull(formData.get('title') as string),
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      middle_name: orNull(formData.get('middle_name') as string),
      preferred_name: orNull(formData.get('preferred_name') as string),
      email: orNull(formData.get('email') as string),
      email_secondary: orNull(formData.get('email_secondary') as string),
      phone_mobile: orNull(formData.get('phone_mobile') as string),
      phone_home: orNull(formData.get('phone_home') as string),
      phone_work: orNull(formData.get('phone_work') as string),
      postal_address_line1: orNull(formData.get('postal_address_line1') as string),
      postal_address_line2: orNull(formData.get('postal_address_line2') as string),
      postal_suburb: orNull(formData.get('postal_suburb') as string),
      postal_state: orNull(formData.get('postal_state') as string),
      postal_postcode: orNull(formData.get('postal_postcode') as string),
      abn: orNull(formData.get('abn') as string),
      company_name: orNull(formData.get('company_name') as string),
      correspondence_method: formData.get('correspondence_method') as string,
      notes: orNull(formData.get('notes') as string),
    }

    const parsed = ownerSchema.safeParse(data)
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

    toast.success('Owner saved successfully')
    router.push(`/schemes/${schemeId}?tab=owners`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>Owner identification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Select name="title" defaultValue={initialData?.title ?? 'none'}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {TITLES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                name="first_name"
                defaultValue={initialData?.first_name ?? ''}
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="middle_name">Middle Name</Label>
              <Input
                id="middle_name"
                name="middle_name"
                defaultValue={initialData?.middle_name ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                name="last_name"
                defaultValue={initialData?.last_name ?? ''}
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferred_name">Preferred Name</Label>
            <Input
              id="preferred_name"
              name="preferred_name"
              defaultValue={initialData?.preferred_name ?? ''}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initialData?.email ?? ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_secondary">Secondary Email</Label>
              <Input
                id="email_secondary"
                name="email_secondary"
                type="email"
                defaultValue={initialData?.email_secondary ?? ''}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="phone_mobile">Mobile</Label>
              <Input
                id="phone_mobile"
                name="phone_mobile"
                defaultValue={initialData?.phone_mobile ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_home">Home Phone</Label>
              <Input
                id="phone_home"
                name="phone_home"
                defaultValue={initialData?.phone_home ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_work">Work Phone</Label>
              <Input
                id="phone_work"
                name="phone_work"
                defaultValue={initialData?.phone_work ?? ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowPostal(!showPostal)}>
          <CardTitle className="flex items-center justify-between">
            Postal Address
            <span className="text-sm font-normal text-muted-foreground">
              {showPostal ? 'Hide' : 'Show'} (optional)
            </span>
          </CardTitle>
        </CardHeader>
        {showPostal && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="postal_address_line1">Address Line 1</Label>
              <Input
                id="postal_address_line1"
                name="postal_address_line1"
                defaultValue={initialData?.postal_address_line1 ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_address_line2">Address Line 2</Label>
              <Input
                id="postal_address_line2"
                name="postal_address_line2"
                defaultValue={initialData?.postal_address_line2 ?? ''}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="postal_suburb">Suburb</Label>
                <Input
                  id="postal_suburb"
                  name="postal_suburb"
                  defaultValue={initialData?.postal_suburb ?? ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_state">State</Label>
                <Select name="postal_state" defaultValue={initialData?.postal_state ?? 'none'}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {STATES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_postcode">Postcode</Label>
                <Input
                  id="postal_postcode"
                  name="postal_postcode"
                  maxLength={4}
                  defaultValue={initialData?.postal_postcode ?? ''}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowCorporate(!showCorporate)}>
          <CardTitle className="flex items-center justify-between">
            Corporate Owner
            <span className="text-sm font-normal text-muted-foreground">
              {showCorporate ? 'Hide' : 'Show'} (optional)
            </span>
          </CardTitle>
        </CardHeader>
        {showCorporate && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  defaultValue={initialData?.company_name ?? ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abn">ABN</Label>
                <Input
                  id="abn"
                  name="abn"
                  maxLength={11}
                  defaultValue={initialData?.abn ?? ''}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correspondence_method">Correspondence Method</Label>
            <Select
              name="correspondence_method"
              defaultValue={initialData?.correspondence_method ?? 'email'}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CORRESPONDENCE_METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              name="notes"
              placeholder="Any additional notes..."
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
