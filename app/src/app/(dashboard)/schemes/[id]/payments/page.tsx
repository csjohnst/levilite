import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Plus, DollarSign, CreditCard, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  cash: 'Cash',
  direct_debit: 'Direct Debit',
  bpay: 'BPAY',
}

export default async function PaymentsPage({
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

  // Fetch payments with lot info and allocations
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      *,
      lots(id, lot_number, unit_number),
      payment_allocations(
        id, allocated_amount,
        levy_items(id, status, levy_periods(period_name))
      )
    `)
    .eq('scheme_id', id)
    .order('payment_date', { ascending: false })

  const paymentList = (payments ?? []) as Array<{
    id: string
    lot_id: string
    amount: number
    payment_date: string
    payment_method: string
    reference: string | null
    notes: string | null
    created_at: string
    lots: { id: string; lot_number: string; unit_number: string | null } | null
    payment_allocations: Array<{
      id: string
      allocated_amount: number
      levy_items: {
        id: string
        status: string
        levy_periods: { period_name: string } | null
      } | null
    }> | null
  }>

  // Summary stats
  const totalReceived = paymentList.reduce((sum, p) => sum + p.amount, 0)
  const totalAllocated = paymentList.reduce((sum, p) => {
    return sum + (p.payment_allocations?.reduce((s, a) => s + a.allocated_amount, 0) ?? 0)
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payments</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash; Payment History
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/schemes/${id}/arrears`}>
              <AlertTriangle className="mr-2 size-4" />
              Arrears
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/schemes/${id}/payments/new`}>
              <Plus className="mr-2 size-4" />
              Record Payment
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Payments</CardDescription>
            <CreditCard className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{paymentList.length}</CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Received</CardDescription>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{formatCurrency(totalReceived)}</CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Allocated</CardDescription>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{formatCurrency(totalAllocated)}</CardTitle>
          </CardContent>
        </Card>
      </div>

      {/* Payments table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>
            {paymentList.length > 0
              ? `${paymentList.length} payment${paymentList.length !== 1 ? 's' : ''} recorded`
              : 'No payments recorded yet'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No payments have been recorded for this scheme.</p>
              <Button asChild className="mt-4">
                <Link href={`/schemes/${id}/payments/new`}>
                  <Plus className="mr-2 size-4" />
                  Record First Payment
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Allocated To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentList.map((payment) => {
                  const allocations = payment.payment_allocations ?? []
                  const totalAlloc = allocations.reduce((s, a) => s + a.allocated_amount, 0)
                  const isFullyAllocated = Math.abs(totalAlloc - payment.amount) < 0.01

                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(payment.payment_date)}
                      </TableCell>
                      <TableCell>
                        {payment.lots ? (
                          <Link
                            href={`/schemes/${id}?tab=lots`}
                            className="hover:underline font-medium"
                          >
                            Lot {payment.lots.lot_number}
                            {payment.lots.unit_number && ` (${payment.lots.unit_number})`}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        {METHOD_LABELS[payment.payment_method] ?? payment.payment_method}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.reference || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {allocations.map((alloc) => (
                            <Badge
                              key={alloc.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {alloc.levy_items?.levy_periods?.period_name ?? 'N/A'}: {formatCurrency(alloc.allocated_amount)}
                            </Badge>
                          ))}
                          {!isFullyAllocated && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              {formatCurrency(payment.amount - totalAlloc)} unallocated
                            </Badge>
                          )}
                          {allocations.length === 0 && (
                            <span className="text-xs text-muted-foreground">Not allocated</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
