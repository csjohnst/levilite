import { Building2, Home, Users, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch counts in parallel
  const [schemesResult, lotsResult, ownersResult] = await Promise.all([
    supabase.from('schemes').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('lot_ownerships').select('owner_id', { count: 'exact', head: true }).is('ownership_end_date', null),
  ])

  const totalSchemes = schemesResult.count ?? 0
  const totalLots = lotsResult.count ?? 0
  const totalOwners = ownersResult.count ?? 0

  const stats = [
    {
      title: 'Total Schemes',
      value: totalSchemes,
      description: 'Active strata schemes',
      icon: Building2,
    },
    {
      title: 'Total Lots',
      value: totalLots,
      description: 'Across all schemes',
      icon: Home,
    },
    {
      title: 'Active Owners',
      value: totalOwners,
      description: 'Registered lot owners',
      icon: Users,
    },
    {
      title: 'Pending Items',
      value: 0,
      description: 'Requiring attention',
      icon: ClipboardList,
    },
  ]

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{stat.title}</CardDescription>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
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
