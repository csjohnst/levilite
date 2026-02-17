import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LotForm } from '@/components/lots/lot-form'
import { createLot } from '@/actions/lots'
import type { LotFormData } from '@/actions/lots'

export default async function NewLotPage({
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

  async function handleCreate(data: LotFormData) {
    'use server'
    return createLot(schemeId, data)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Add Lot</h2>
        <p className="text-muted-foreground">
          Add a new lot to {scheme.scheme_name}
        </p>
      </div>
      <LotForm
        schemeId={schemeId}
        onSubmit={handleCreate}
        submitLabel="Create Lot"
      />
    </div>
  )
}
