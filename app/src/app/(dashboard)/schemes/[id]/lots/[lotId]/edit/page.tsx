import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LotForm } from '@/components/lots/lot-form'
import { updateLot } from '@/actions/lots'
import type { LotFormData } from '@/actions/lots'

export default async function EditLotPage({
  params,
}: {
  params: Promise<{ id: string; lotId: string }>
}) {
  const { id: schemeId, lotId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lot, error } = await supabase
    .from('lots')
    .select('*')
    .eq('id', lotId)
    .single()

  if (error || !lot) notFound()

  const initialData: Partial<LotFormData> = {
    lot_number: lot.lot_number,
    unit_number: lot.unit_number,
    street_address: lot.street_address,
    lot_type: lot.lot_type,
    unit_entitlement: lot.unit_entitlement,
    voting_entitlement: lot.voting_entitlement,
    floor_area_sqm: lot.floor_area_sqm,
    balcony_area_sqm: lot.balcony_area_sqm,
    bedrooms: lot.bedrooms,
    bathrooms: lot.bathrooms,
    car_bays: lot.car_bays,
    occupancy_status: lot.occupancy_status,
    notes: lot.notes,
  }

  async function handleUpdate(data: LotFormData) {
    'use server'
    return updateLot(lotId, data)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Edit Lot {lot.lot_number}</h2>
        <p className="text-muted-foreground">
          Update lot details
        </p>
      </div>
      <LotForm
        schemeId={schemeId}
        initialData={initialData}
        onSubmit={handleUpdate}
        submitLabel="Update Lot"
      />
    </div>
  )
}
