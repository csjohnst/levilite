import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { OpeningBalanceForm } from '@/components/opening-balances/opening-balance-form'
import { checkOpeningBalancesStatus } from '@/actions/opening-balances'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function OpeningBalancesPage({
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
    .select('id, scheme_name, scheme_number, financial_year_end_month, financial_year_end_day')
    .eq('id', id)
    .single()

  if (error || !scheme) notFound()

  // Check if scheme already has opening balances
  const statusResult = await checkOpeningBalancesStatus(id)
  const hasOpeningBalances = statusResult.data?.has_opening_balances ?? false

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/schemes/${id}`}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Scheme
          </Link>
        </Button>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Opening Balances</h2>
        <p className="text-muted-foreground">
          {scheme.scheme_name} ({scheme.scheme_number})
        </p>
      </div>

      {hasOpeningBalances && (
        <Alert>
          <AlertDescription>
            This scheme already has opening balances applied. You can update individual lot balances or clear all balances and start fresh.
          </AlertDescription>
        </Alert>
      )}

      <OpeningBalanceForm schemeId={id} />
    </div>
  )
}
