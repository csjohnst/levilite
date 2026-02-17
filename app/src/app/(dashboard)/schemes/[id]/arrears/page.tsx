import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AlertTriangle, DollarSign, Users, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrearsTable } from '@/components/payments/arrears-table'

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function ArrearsPage({
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

  // Fetch overdue and partial levy items with lot and owner info
  const { data: arrearsItems } = await supabase
    .from('levy_items')
    .select(`
      *,
      lots!inner(
        id, lot_number, unit_number,
        lot_ownerships(
          owners(id, first_name, last_name, email, phone_mobile)
        )
      ),
      levy_periods!inner(
        id, period_name
      )
    `)
    .eq('scheme_id', id)
    .in('status', ['overdue', 'partial'])
    .order('due_date', { ascending: true })

  const items = (arrearsItems ?? []) as Array<{
    id: string
    lot_id: string
    admin_levy_amount: number
    capital_levy_amount: number
    special_levy_amount: number | null
    total_levy_amount: number
    amount_paid: number
    balance: number
    due_date: string
    status: string
    lots: {
      id: string
      lot_number: string
      unit_number: string | null
      lot_ownerships: Array<{
        owners: {
          id: string
          first_name: string
          last_name: string
          email: string | null
          phone_mobile: string | null
        } | null
      }> | null
    }
    levy_periods: {
      id: string
      period_name: string
    }
  }>

  // Compute ageing summary
  const today = new Date()
  const ageing = {
    days0to30: { count: 0, amount: 0 },
    days31to60: { count: 0, amount: 0 },
    days61to90: { count: 0, amount: 0 },
    days90plus: { count: 0, amount: 0 },
  }

  let totalArrears = 0
  const lotIds = new Set<string>()

  for (const item of items) {
    const balance = Number(item.balance)
    totalArrears += balance
    lotIds.add(item.lot_id)

    const dueDate = new Date(item.due_date)
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysOverdue <= 30) {
      ageing.days0to30.count++
      ageing.days0to30.amount += balance
    } else if (daysOverdue <= 60) {
      ageing.days31to60.count++
      ageing.days31to60.amount += balance
    } else if (daysOverdue <= 90) {
      ageing.days61to90.count++
      ageing.days61to90.amount += balance
    } else {
      ageing.days90plus.count++
      ageing.days90plus.amount += balance
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">Arrears Dashboard</h2>
            {items.length > 0 && (
              <Badge variant="destructive">{items.length} overdue</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash; Arrears Management
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Arrears</CardDescription>
            <DollarSign className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl text-red-600">
              {formatCurrency(totalArrears)}
            </CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Lots in Arrears</CardDescription>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{lotIds.size}</CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Overdue Items</CardDescription>
            <AlertTriangle className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{items.length}</CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Critical ({'>'}90 days)</CardDescription>
            <Clock className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl text-red-600">
              {ageing.days90plus.count}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(ageing.days90plus.amount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ageing breakdown */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ageing Summary</CardTitle>
            <CardDescription>Breakdown of arrears by days overdue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">0-30 days</p>
                <p className="text-lg font-semibold">{formatCurrency(ageing.days0to30.amount)}</p>
                <p className="text-xs text-muted-foreground">{ageing.days0to30.count} item{ageing.days0to30.count !== 1 ? 's' : ''}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <p className="text-sm text-amber-700">31-60 days</p>
                <p className="text-lg font-semibold text-amber-800">{formatCurrency(ageing.days31to60.amount)}</p>
                <p className="text-xs text-amber-600">{ageing.days31to60.count} item{ageing.days31to60.count !== 1 ? 's' : ''}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                <p className="text-sm text-red-700">61-90 days</p>
                <p className="text-lg font-semibold text-red-800">{formatCurrency(ageing.days61to90.amount)}</p>
                <p className="text-xs text-red-600">{ageing.days61to90.count} item{ageing.days61to90.count !== 1 ? 's' : ''}</p>
              </div>
              <div className="rounded-lg border border-red-300 bg-red-100/50 p-3">
                <p className="text-sm text-red-800 font-medium">{'>'} 90 days</p>
                <p className="text-lg font-semibold text-red-900">{formatCurrency(ageing.days90plus.amount)}</p>
                <p className="text-xs text-red-700">{ageing.days90plus.count} item{ageing.days90plus.count !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Arrears table */}
      <Card>
        <CardHeader>
          <CardTitle>Overdue Levy Items</CardTitle>
          <CardDescription>
            {items.length > 0
              ? `${items.length} levy item${items.length !== 1 ? 's' : ''} with outstanding balance`
              : 'No overdue levy items'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArrearsTable items={items} schemeId={id} />
        </CardContent>
      </Card>
    </div>
  )
}
