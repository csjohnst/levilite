import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileText, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function DocumentsIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgUser } = await supabase
    .from('organisation_users')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single()

  if (!orgUser) redirect('/')

  const { data: schemes } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number, status')
    .eq('organisation_id', orgUser.organisation_id)
    .eq('status', 'active')
    .order('scheme_name')

  // Get document counts per scheme
  const schemeIds = schemes?.map(s => s.id) ?? []
  const docCounts: Record<string, number> = {}

  if (schemeIds.length > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select('scheme_id')
      .in('scheme_id', schemeIds)
      .is('deleted_at', null)

    if (docs) {
      for (const d of docs) {
        docCounts[d.scheme_id] = (docCounts[d.scheme_id] ?? 0) + 1
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
        <p className="text-muted-foreground">
          Manage documents across all your schemes
        </p>
      </div>

      {schemes && schemes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schemes.map((scheme) => {
            const count = docCounts[scheme.id] ?? 0
            return (
              <Link key={scheme.id} href={`/schemes/${scheme.id}/documents`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{scheme.scheme_name}</CardTitle>
                      <CardDescription>{scheme.scheme_number}</CardDescription>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {count > 0
                        ? `${count} document${count !== 1 ? 's' : ''}`
                        : 'No documents yet'
                      }
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No schemes</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a scheme first before managing documents.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
