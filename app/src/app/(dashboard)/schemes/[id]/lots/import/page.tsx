import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CsvImportForm } from '@/components/lots/csv-import-form'

export default async function ImportLotsPage({
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Import Lots</h2>
        <p className="text-muted-foreground">
          Bulk import lots into {scheme.scheme_name} from a CSV file
        </p>
      </div>
      <CsvImportForm schemeId={schemeId} />
    </div>
  )
}
