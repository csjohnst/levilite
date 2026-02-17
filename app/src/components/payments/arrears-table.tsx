'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DollarSign } from 'lucide-react'

interface ArrearsItem {
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
}

interface ArrearsTableProps {
  items: ArrearsItem[]
  schemeId: string
}

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function getDaysOverdue(dueDateStr: string): number {
  const due = new Date(dueDateStr)
  const today = new Date()
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
}

function getAgeBadge(days: number) {
  if (days > 90) {
    return <Badge variant="destructive">{'>'} 90 days</Badge>
  }
  if (days > 60) {
    return <Badge variant="destructive" className="bg-red-200 text-red-900">61-90 days</Badge>
  }
  if (days > 30) {
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800">31-60 days</Badge>
  }
  return <Badge variant="outline">0-30 days</Badge>
}

export function ArrearsTable({ items, schemeId }: ArrearsTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <DollarSign className="size-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No arrears</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          All levy items are up to date. No overdue payments.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lot</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Amount Due</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const lot = item.lots
            const owners = lot?.lot_ownerships
              ?.map(o => o.owners)
              .filter(Boolean) ?? []
            const daysOverdue = getDaysOverdue(item.due_date)

            return (
              <TableRow key={item.id} className={daysOverdue > 30 ? 'bg-red-50/50' : ''}>
                <TableCell className="font-medium">
                  {lot?.unit_number ? `Unit ${lot.unit_number}` : `Lot ${lot?.lot_number ?? '?'}`}
                </TableCell>
                <TableCell>
                  {owners.length > 0
                    ? owners.map(o => `${o!.first_name} ${o!.last_name}`).join(', ')
                    : <span className="text-muted-foreground">Unassigned</span>
                  }
                </TableCell>
                <TableCell>{item.levy_periods?.period_name ?? '-'}</TableCell>
                <TableCell>{formatDate(item.due_date)}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.total_levy_amount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.amount_paid)}</TableCell>
                <TableCell className="text-right font-medium text-red-700">
                  {formatCurrency(item.balance)}
                </TableCell>
                <TableCell>{getAgeBadge(daysOverdue)}</TableCell>
                <TableCell>
                  <Badge
                    variant={item.status === 'overdue' ? 'destructive' : 'secondary'}
                    className={item.status === 'partial' ? 'bg-amber-100 text-amber-800' : ''}
                  >
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/schemes/${schemeId}/payments/new?lot=${item.lot_id}`}>
                      Record Payment
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
