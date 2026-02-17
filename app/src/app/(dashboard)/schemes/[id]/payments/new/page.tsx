import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PaymentForm } from '@/components/payments/payment-form'

export default async function NewPaymentPage({
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

  // Fetch active lots for the scheme
  const { data: lots } = await supabase
    .from('lots')
    .select('id, lot_number, unit_number')
    .eq('scheme_id', id)
    .eq('status', 'active')
    .order('lot_number')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Record Payment</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/payments`} className="hover:underline">Payments</Link>
            {' '}&mdash; New Payment
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/schemes/${id}/payments`}>
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Link>
        </Button>
      </div>

      <PaymentForm schemeId={id} lots={lots ?? []} />
    </div>
  )
}
