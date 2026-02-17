import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { OwnerForm } from '@/components/owners/owner-form'
import { createOwner } from '@/actions/owners'
import type { OwnerFormData, LotAssignment } from '@/actions/owners'
import { OwnerLotAssignment } from '@/components/owners/owner-lot-assignment'

export default async function NewOwnerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: schemeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scheme } = await supabase
    .from('schemes')
    .select('id, scheme_name')
    .eq('id', schemeId)
    .single()

  if (!scheme) notFound()

  // Fetch lots for assignment
  const { data: lots } = await supabase
    .from('lots')
    .select('id, lot_number, unit_number')
    .eq('scheme_id', schemeId)
    .eq('status', 'active')
    .order('lot_number')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Add Owner</h2>
        <p className="text-muted-foreground">
          Add a new owner to {scheme.scheme_name}
        </p>
      </div>
      <OwnerLotAssignment
        schemeId={schemeId}
        lots={lots ?? []}
      />
    </div>
  )
}
