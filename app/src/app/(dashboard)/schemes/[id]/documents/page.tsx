import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentLibrary } from '@/components/documents/document-library'
import type { DocumentRow } from '@/components/documents/document-actions'

export default async function DocumentLibraryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scheme } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number')
    .eq('id', id)
    .single()

  if (!scheme) notFound()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('scheme_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash; Document Library
          </p>
        </div>
        <Button asChild>
          <Link href={`/schemes/${id}/documents/upload`}>
            <Upload className="mr-2 size-4" />
            Upload Document
          </Link>
        </Button>
      </div>

      <DocumentLibrary
        schemeId={id}
        documents={(documents ?? []) as DocumentRow[]}
      />
    </div>
  )
}
