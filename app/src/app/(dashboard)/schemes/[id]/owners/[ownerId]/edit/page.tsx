import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { OwnerForm } from '@/components/owners/owner-form'
import { updateOwner } from '@/actions/owners'
import type { OwnerFormData } from '@/actions/owners'

export default async function EditOwnerPage({
  params,
}: {
  params: Promise<{ id: string; ownerId: string }>
}) {
  const { id: schemeId, ownerId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: owner, error } = await supabase
    .from('owners')
    .select('*')
    .eq('id', ownerId)
    .single()

  if (error || !owner) notFound()

  const initialData: Partial<OwnerFormData> = {
    title: owner.title,
    first_name: owner.first_name,
    last_name: owner.last_name,
    middle_name: owner.middle_name,
    preferred_name: owner.preferred_name,
    email: owner.email,
    email_secondary: owner.email_secondary,
    phone_mobile: owner.phone_mobile,
    phone_home: owner.phone_home,
    phone_work: owner.phone_work,
    postal_address_line1: owner.postal_address_line1,
    postal_address_line2: owner.postal_address_line2,
    postal_suburb: owner.postal_suburb,
    postal_state: owner.postal_state,
    postal_postcode: owner.postal_postcode,
    abn: owner.abn,
    company_name: owner.company_name,
    correspondence_method: owner.correspondence_method,
    notes: owner.notes,
  }

  async function handleUpdate(data: OwnerFormData) {
    'use server'
    return updateOwner(ownerId, data)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Edit Owner</h2>
        <p className="text-muted-foreground">
          Update details for {owner.first_name} {owner.last_name}
        </p>
      </div>
      <OwnerForm
        schemeId={schemeId}
        initialData={initialData}
        onSubmit={handleUpdate}
        submitLabel="Update Owner"
      />
    </div>
  )
}
