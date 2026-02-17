import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { SchemeForm } from '@/components/schemes/scheme-form'
import { updateScheme } from '@/actions/schemes'
import type { SchemeFormData } from '@/actions/schemes'

export default async function EditSchemePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scheme, error } = await supabase
    .from('schemes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !scheme) notFound()

  const initialData: Partial<SchemeFormData> = {
    scheme_number: scheme.scheme_number,
    scheme_name: scheme.scheme_name,
    scheme_type: scheme.scheme_type,
    street_address: scheme.street_address,
    suburb: scheme.suburb,
    state: scheme.state,
    postcode: scheme.postcode,
    abn: scheme.abn,
    acn: scheme.acn,
    registered_name: scheme.registered_name,
    financial_year_end_month: scheme.financial_year_end_month,
    financial_year_end_day: scheme.financial_year_end_day,
    levy_frequency: scheme.levy_frequency,
    levy_due_day: scheme.levy_due_day,
    notes: scheme.notes,
  }

  async function handleUpdate(data: SchemeFormData) {
    'use server'
    return updateScheme(id, data)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Edit Scheme</h2>
        <p className="text-muted-foreground">
          Update details for {scheme.scheme_name}
        </p>
      </div>
      <SchemeForm
        initialData={initialData}
        onSubmit={handleUpdate}
        submitLabel="Update Scheme"
      />
    </div>
  )
}
