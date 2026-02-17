'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { toast } from 'sonner'
import { recordPayment } from '@/actions/payments'
import { getOutstandingLevyItems } from '@/actions/payments'

interface Lot {
  id: string
  lot_number: string
  unit_number: string | null
}

interface PaymentFormProps {
  schemeId: string
  lots: Lot[]
}

interface OutstandingItem {
  id: string
  admin_levy_amount: number
  capital_levy_amount: number
  special_levy_amount: number | null
  total_levy_amount: number
  amount_paid: number
  balance: number
  due_date: string
  status: string
  levy_periods: {
    period_name: string
  }
}

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const STATUS_STYLES: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }> = {
  overdue: { variant: 'destructive', className: '' },
  partial: { variant: 'secondary', className: 'bg-amber-100 text-amber-800' },
  sent: { variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
}

export function PaymentForm({ schemeId, lots }: PaymentFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [lotId, setLotId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [outstandingItems, setOutstandingItems] = useState<OutstandingItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    if (!lotId) {
      setOutstandingItems([])
      return
    }

    setLoadingItems(true)
    getOutstandingLevyItems(lotId).then(result => {
      if (result.data) {
        setOutstandingItems(result.data as OutstandingItem[])
      }
      setLoadingItems(false)
    })
  }, [lotId])

  const totalOutstanding = outstandingItems.reduce((sum, item) => sum + item.balance, 0)
  const paymentAmount = parseFloat(amount) || 0

  // FIFO allocation preview
  const allocationPreview: { item: OutstandingItem; allocated: number }[] = []
  let remaining = paymentAmount
  for (const item of outstandingItems) {
    if (remaining <= 0) break
    const allocation = Math.min(remaining, item.balance)
    allocationPreview.push({ item, allocated: Math.round(allocation * 100) / 100 })
    remaining = Math.round((remaining - allocation) * 100) / 100
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lotId || !amount || !paymentDate) return

    setLoading(true)
    try {
      const result = await recordPayment(schemeId, {
        lot_id: lotId,
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod as 'bank_transfer' | 'cheque' | 'cash' | 'direct_debit' | 'bpay',
        reference: reference || null,
        notes: notes || null,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        const msg = result.data?.note
          ? `Payment recorded. ${result.data.note}`
          : `Payment of ${formatCurrency(paymentAmount)} recorded successfully.`
        toast.success(msg)
        router.push(`/schemes/${schemeId}/payments`)
        router.refresh()
      }
    } catch {
      toast.error('Failed to record payment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lot">Lot</Label>
            <Select value={lotId} onValueChange={setLotId}>
              <SelectTrigger id="lot">
                <SelectValue placeholder="Select a lot" />
              </SelectTrigger>
              <SelectContent>
                {lots.map(lot => (
                  <SelectItem key={lot.id} value={lot.id}>
                    {lot.unit_number ? `Unit ${lot.unit_number}` : `Lot ${lot.lot_number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Payment Date</Label>
            <Input
              id="date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="direct_debit">Direct Debit</SelectItem>
                <SelectItem value="bpay">BPay</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Input
              id="reference"
              placeholder="e.g. LOT5-Q12027"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div>
          {lotId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outstanding Levies</CardTitle>
                <CardDescription>
                  {loadingItems
                    ? 'Loading...'
                    : outstandingItems.length > 0
                      ? `${outstandingItems.length} outstanding item${outstandingItems.length !== 1 ? 's' : ''} (${formatCurrency(totalOutstanding)} total)`
                      : 'No outstanding levy items for this lot'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {outstandingItems.length > 0 && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Status</TableHead>
                          {paymentAmount > 0 && (
                            <TableHead className="text-right">Allocate</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outstandingItems.map((item) => {
                          const preview = allocationPreview.find(p => p.item.id === item.id)
                          const style = STATUS_STYLES[item.status] ?? STATUS_STYLES.sent
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.levy_periods?.period_name ?? '-'}
                              </TableCell>
                              <TableCell>{formatDate(item.due_date)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                              <TableCell>
                                <Badge variant={style.variant} className={style.className}>
                                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                </Badge>
                              </TableCell>
                              {paymentAmount > 0 && (
                                <TableCell className="text-right font-medium">
                                  {preview
                                    ? <span className="text-green-700">{formatCurrency(preview.allocated)}</span>
                                    : <span className="text-muted-foreground">-</span>
                                  }
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {paymentAmount > 0 && remaining > 0 && (
                  <p className="mt-3 text-sm text-amber-600">
                    {formatCurrency(remaining)} will remain unallocated (no more outstanding items).
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading || !lotId || !amount}>
          {loading ? 'Recording...' : 'Record Payment'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
