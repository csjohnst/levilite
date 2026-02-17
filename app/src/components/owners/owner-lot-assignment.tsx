'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
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
import { createOwner } from '@/actions/owners'
import type { OwnerFormData, LotAssignment } from '@/actions/owners'

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

interface OwnerLotAssignmentProps {
  schemeId: string
  lots: Array<{ id: string; lot_number: string; unit_number: string | null }>
}

const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof']
const STATES = ['WA', 'NSW', 'VIC', 'QLD', 'SA', 'TAS', 'NT', 'ACT']
const OWNERSHIP_TYPES = [
  { value: 'sole', label: 'Sole Owner' },
  { value: 'joint-tenants', label: 'Joint Tenants' },
  { value: 'tenants-in-common', label: 'Tenants in Common' },
] as const

export function OwnerLotAssignment({ schemeId, lots }: OwnerLotAssignmentProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPostal, setShowPostal] = useState(false)
  const [showCorporate, setShowCorporate] = useState(false)
  const [assignments, setAssignments] = useState<Array<{
    lot_id: string
    ownership_type: string
    ownership_percentage: number
  }>>([])

  function addAssignment() {
    setAssignments([...assignments, { lot_id: '', ownership_type: 'sole', ownership_percentage: 100 }])
  }

  function removeAssignment(index: number) {
    setAssignments(assignments.filter((_, i) => i !== index))
  }

  function updateAssignment(index: number, field: string, value: string | number) {
    const updated = [...assignments]
    updated[index] = { ...updated[index], [field]: value }
    setAssignments(updated)
  }

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

    // Validate assignments
    const validAssignments: LotAssignment[] = assignments
      .filter(a => a.lot_id)
      .map(a => ({
        lot_id: a.lot_id,
        ownership_type: a.ownership_type as LotAssignment['ownership_type'],
        ownership_percentage: a.ownership_percentage,
      }))

    const result = await createOwner(parsed.data, validAssignments)
    if (result.error) {
      toast.error(result.error)
      setLoading(false)
      return
    }

    toast.success('Owner created successfully')
    router.push(`/schemes/${schemeId}?tab=owners`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Select name="title" defaultValue="none">
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
              <Input id="first_name" name="first_name" />
              {errors.first_name && <p className="text-sm text-destructive">{errors.first_name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="middle_name">Middle Name</Label>
              <Input id="middle_name" name="middle_name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input id="last_name" name="last_name" />
              {errors.last_name && <p className="text-sm text-destructive">{errors.last_name}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferred_name">Preferred Name</Label>
            <Input id="preferred_name" name="preferred_name" />
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
              <Input id="email" name="email" type="email" />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_secondary">Secondary Email</Label>
              <Input id="email_secondary" name="email_secondary" type="email" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="phone_mobile">Mobile</Label>
              <Input id="phone_mobile" name="phone_mobile" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_home">Home Phone</Label>
              <Input id="phone_home" name="phone_home" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_work">Work Phone</Label>
              <Input id="phone_work" name="phone_work" />
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
              <Input id="postal_address_line1" name="postal_address_line1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_address_line2">Address Line 2</Label>
              <Input id="postal_address_line2" name="postal_address_line2" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="postal_suburb">Suburb</Label>
                <Input id="postal_suburb" name="postal_suburb" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_state">State</Label>
                <Select name="postal_state" defaultValue="none">
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
                <Input id="postal_postcode" name="postal_postcode" maxLength={4} />
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
                <Input id="company_name" name="company_name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abn">ABN</Label>
                <Input id="abn" name="abn" maxLength={11} />
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
            <Select name="correspondence_method" defaultValue="email">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="postal">Postal</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea name="notes" rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lot Assignment</CardTitle>
          <CardDescription>
            Assign this owner to one or more lots in this scheme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignments.map((assignment, index) => (
            <div key={index} className="flex items-end gap-3 rounded-lg border p-3">
              <div className="flex-1 space-y-2">
                <Label>Lot</Label>
                <Select
                  value={assignment.lot_id}
                  onValueChange={(v) => updateAssignment(index, 'lot_id', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select lot" />
                  </SelectTrigger>
                  <SelectContent>
                    {lots.map(lot => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {lot.unit_number ? `Unit ${lot.unit_number}` : `Lot ${lot.lot_number}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40 space-y-2">
                <Label>Type</Label>
                <Select
                  value={assignment.ownership_type}
                  onValueChange={(v) => updateAssignment(index, 'ownership_type', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNERSHIP_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-2">
                <Label>%</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={assignment.ownership_percentage}
                  onChange={(e) => updateAssignment(index, 'ownership_percentage', Number(e.target.value))}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAssignment(index)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addAssignment}>
            <Plus className="mr-2 size-4" />
            Add Lot Assignment
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Create Owner'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
