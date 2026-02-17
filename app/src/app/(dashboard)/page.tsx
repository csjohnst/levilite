import { Building2, Home, Users, ClipboardList } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const stats = [
  {
    title: 'Total Schemes',
    value: '--',
    description: 'Active strata schemes',
    icon: Building2,
  },
  {
    title: 'Total Lots',
    value: '--',
    description: 'Across all schemes',
    icon: Home,
  },
  {
    title: 'Active Owners',
    value: '--',
    description: 'Registered lot owners',
    icon: Users,
  },
  {
    title: 'Pending Items',
    value: '--',
    description: 'Requiring attention',
    icon: ClipboardList,
  },
]

export default function DashboardPage() {
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
