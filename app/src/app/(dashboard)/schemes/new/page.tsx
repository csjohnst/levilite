import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SchemeForm } from '@/components/schemes/scheme-form'
import { createScheme } from '@/actions/schemes'

export default async function NewSchemePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Scheme</h2>
        <p className="text-muted-foreground">
          Add a new strata scheme to your portfolio
        </p>
      </div>
      <SchemeForm
        onSubmit={createScheme}
        submitLabel="Create Scheme"
      />
    </div>
  )
}
