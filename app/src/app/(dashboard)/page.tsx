import { Building2, Home, Users, DollarSign, Receipt, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch counts in parallel
  const [schemesResult, lotsResult, ownersResult, levyItemsResult, overdueResult] = await Promise.all([
    supabase.from('schemes').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('lot_ownerships').select('owner_id', { count: 'exact', head: true }).is('ownership_end_date', null),
    supabase.from('levy_items').select('total_levy_amount, amount_paid, status'),
    supabase.from('levy_items').select('balance', { count: 'exact', head: false }).eq('status', 'overdue'),
  ])

  const totalSchemes = schemesResult.count ?? 0
  const totalLots = lotsResult.count ?? 0
  const totalOwners = ownersResult.count ?? 0

  // Levy stats
  const levyItems = levyItemsResult.data ?? []
  const totalLevied = levyItems.reduce((sum, i) => sum + (i.total_levy_amount ?? 0), 0)
  const totalPaid = levyItems.reduce((sum, i) => sum + (i.amount_paid ?? 0), 0)
  const collectionRate = totalLevied > 0 ? Math.round((totalPaid / totalLevied) * 100) : 0

  const overdueItems = overdueResult.data ?? []
  const overdueAmount = overdueItems.reduce((sum, i) => sum + (i.balance ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome to LevyLite
        </h2>
        <p className="text-muted-foreground">
          Your strata management overview at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Schemes</CardDescription>
            <Building2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{totalSchemes}</CardTitle>
            <p className="text-xs text-muted-foreground">Active strata schemes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Lots</CardDescription>
            <Home className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{totalLots}</CardTitle>
            <p className="text-xs text-muted-foreground">Across all schemes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Active Owners</CardDescription>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{totalOwners}</CardTitle>
            <p className="text-xs text-muted-foreground">Registered lot owners</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Levies Due</CardDescription>
            <Receipt className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{formatCurrency(totalLevied)}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalPaid)} collected
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Collection Rate</CardDescription>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{collectionRate}%</CardTitle>
            <p className="text-xs text-muted-foreground">
              {levyItems.filter(i => i.status === 'paid').length} of {levyItems.length} items paid
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Overdue Amount</CardDescription>
            <AlertTriangle className={`size-4 ${overdueAmount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <CardTitle className={`text-2xl ${overdueAmount > 0 ? 'text-red-600' : ''}`}>
              {formatCurrency(overdueAmount)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {overdueItems.length} overdue item{overdueItems.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest updates across your schemes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recent activity to display.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
