import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Pencil, Plus, Upload, Building2, Home, Users, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { LotsTab } from '@/components/schemes/lots-tab'
import { OwnersTab } from '@/components/schemes/owners-tab'
import { CommitteeTab } from '@/components/schemes/committee-tab'

export default async function SchemeDetailPage({
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
    .select('*')
    .eq('id', id)
    .single()

  if (error || !scheme) notFound()

  // Fetch lots with owners
  const { data: lots } = await supabase
    .from('lots')
    .select('*, lot_ownerships(*, owners(id, first_name, last_name, email))')
    .eq('scheme_id', id)
    .eq('status', 'active')
    .order('lot_number')

  // Fetch committee members
  const { data: committeeMembers } = await supabase
    .from('committee_members')
    .select('*, owners(id, first_name, last_name, email, phone_mobile)')
    .eq('scheme_id', id)
    .eq('is_active', true)
    .order('position')

  // Compute stats
  const totalLots = lots?.length ?? 0
  const totalEntitlement = lots?.reduce((sum, lot) => sum + (lot.unit_entitlement ?? 0), 0) ?? 0

  // Count unique owners
  const ownerIds = new Set<string>()
  lots?.forEach(lot => {
    const ownerships = lot.lot_ownerships as { owners: { id: string } | null }[] | null
    ownerships?.forEach(o => {
      if (o.owners?.id) ownerIds.add(o.owners.id)
    })
  })

  // Build owners list from ownerships
  const ownerMap = new Map<string, { owner: Record<string, unknown>; lots: { lot_number: string; unit_number: string | null }[] }>()
  lots?.forEach(lot => {
    const ownerships = lot.lot_ownerships as { owners: Record<string, unknown> | null }[] | null
    ownerships?.forEach(o => {
      if (!o.owners) return
      const oid = o.owners.id as string
      if (!ownerMap.has(oid)) {
        ownerMap.set(oid, { owner: o.owners, lots: [] })
      }
      ownerMap.get(oid)!.lots.push({
        lot_number: lot.lot_number,
        unit_number: lot.unit_number,
      })
    })
  })
  const owners = Array.from(ownerMap.values())

  const LEVY_FREQ_LABELS: Record<string, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    annual: 'Annual',
    custom: 'Custom',
  }
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{scheme.scheme_name}</h2>
            <Badge
              variant={scheme.status === 'active' ? 'secondary' : 'outline'}
              className={scheme.status === 'active' ? 'bg-green-100 text-green-800' : ''}
            >
              {scheme.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">{scheme.scheme_number}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/schemes/${id}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit Scheme
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lots">Lots ({totalLots})</TabsTrigger>
          <TabsTrigger value="owners">Owners ({ownerIds.size})</TabsTrigger>
          <TabsTrigger value="committee">Committee ({committeeMembers?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Total Lots</CardDescription>
                <Home className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-2xl">{totalLots}</CardTitle>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Total Entitlement</CardDescription>
                <Building2 className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-2xl">{totalEntitlement}</CardTitle>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Active Owners</CardDescription>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-2xl">{ownerIds.size}</CardTitle>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>{scheme.street_address}</p>
                <p>{scheme.suburb}, {scheme.state} {scheme.postcode}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Financial Year End:</span>{' '}
                  {scheme.financial_year_end_day} {MONTHS[scheme.financial_year_end_month - 1]}
                </p>
                <p>
                  <span className="text-muted-foreground">Levy Frequency:</span>{' '}
                  {LEVY_FREQ_LABELS[scheme.levy_frequency] ?? scheme.levy_frequency}
                </p>
                <p>
                  <span className="text-muted-foreground">Levy Due Day:</span>{' '}
                  {scheme.levy_due_day}
                </p>
              </CardContent>
            </Card>

            {(scheme.abn || scheme.acn || scheme.registered_name) && (
              <Card>
                <CardHeader>
                  <CardTitle>Legal Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {scheme.abn && <p><span className="text-muted-foreground">ABN:</span> {scheme.abn}</p>}
                  {scheme.acn && <p><span className="text-muted-foreground">ACN:</span> {scheme.acn}</p>}
                  {scheme.registered_name && <p><span className="text-muted-foreground">Registered Name:</span> {scheme.registered_name}</p>}
                </CardContent>
              </Card>
            )}

            {scheme.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{scheme.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="lots">
          <LotsTab schemeId={id} lots={lots ?? []} />
        </TabsContent>

        <TabsContent value="owners">
          <OwnersTab schemeId={id} owners={owners} />
        </TabsContent>

        <TabsContent value="committee">
          <CommitteeTab
            schemeId={id}
            members={committeeMembers ?? []}
            owners={owners}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
