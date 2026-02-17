import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DollarSign, ArrowRight } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function PaymentsIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's org
  const { data: orgUser } = await supabase
    .from('organisation_users')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single()

  if (!orgUser) redirect('/')

  // Fetch all schemes for this org
  const { data: schemes } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number, status')
    .eq('organisation_id', orgUser.organisation_id)
    .eq('status', 'active')
    .order('scheme_name')

  // For each scheme, get payment counts and totals
  const schemeIds = schemes?.map(s => s.id) ?? []
  const paymentStats: Record<string, { count: number; total: number }> = {}
  const arrearsStats: Record<string, { count: number; total: number }> = {}

  if (schemeIds.length > 0) {
    const { data: payments } = await supabase
      .from('payments')
      .select('scheme_id, amount')
      .in('scheme_id', schemeIds)

    if (payments) {
      for (const p of payments) {
        if (!paymentStats[p.scheme_id]) {
          paymentStats[p.scheme_id] = { count: 0, total: 0 }
        }
        paymentStats[p.scheme_id].count++
        paymentStats[p.scheme_id].total += Number(p.amount)
      }
    }

    const { data: arrears } = await supabase
      .from('levy_items')
      .select('scheme_id, balance')
      .in('scheme_id', schemeIds)
      .in('status', ['overdue', 'partial'])

    if (arrears) {
      for (const a of arrears) {
        if (!arrearsStats[a.scheme_id]) {
          arrearsStats[a.scheme_id] = { count: 0, total: 0 }
        }
        arrearsStats[a.scheme_id].count++
        arrearsStats[a.scheme_id].total += Number(a.balance)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Payments</h2>
        <p className="text-muted-foreground">
          Record and track levy payments across all your schemes
        </p>
      </div>

      {schemes && schemes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schemes.map((scheme) => {
            const stats = paymentStats[scheme.id]
            const arrears = arrearsStats[scheme.id]
            return (
              <Link key={scheme.id} href={`/schemes/${scheme.id}/payments`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{scheme.scheme_name}</CardTitle>
                      <CardDescription>{scheme.scheme_number}</CardDescription>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {stats
                        ? `${stats.count} payment${stats.count !== 1 ? 's' : ''} (${formatCurrency(stats.total)})`
                        : 'No payments yet'
                      }
                    </p>
                    {arrears && arrears.count > 0 && (
                      <p className="text-sm text-red-600">
                        {arrears.count} overdue ({formatCurrency(arrears.total)})
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No schemes</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a scheme first before recording payments.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
