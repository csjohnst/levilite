'use client'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface LevyItem {
  id: string
  lot_id: string
  admin_levy_amount: number
  capital_levy_amount: number
  special_levy_amount: number | null
  total_levy_amount: number
  amount_paid: number
  balance: number
  status: string
  due_date: string
  lots: {
    lot_number: string
    unit_number: string | null
    lot_ownerships: Array<{
      owners: {
        first_name: string
        last_name: string
      } | null
    }> | null
  } | null
}

interface LevyRollTableProps {
  items: LevyItem[]
}

const STATUS_STYLES: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }> = {
  paid: { variant: 'secondary', className: 'bg-green-100 text-green-800' },
  partial: { variant: 'secondary', className: 'bg-amber-100 text-amber-800' },
  overdue: { variant: 'destructive', className: '' },
  sent: { variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
  pending: { variant: 'outline', className: '' },
}

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function LevyRollTable({ items }: LevyRollTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <h3 className="text-lg font-medium">No levy items yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Calculate levies to generate items for each lot in this period.
        </p>
      </div>
    )
  }

  // Compute totals
  const totals = items.reduce(
    (acc, item) => ({
      admin: acc.admin + item.admin_levy_amount,
      capital: acc.capital + item.capital_levy_amount,
      total: acc.total + item.total_levy_amount,
      paid: acc.paid + item.amount_paid,
      balance: acc.balance + item.balance,
    }),
    { admin: 0, capital: 0, total: 0, paid: 0, balance: 0 },
  )

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lot</TableHead>
            <TableHead>Owner(s)</TableHead>
            <TableHead className="text-right">Admin</TableHead>
            <TableHead className="text-right">Capital</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const lot = item.lots
            const owners = lot?.lot_ownerships
              ?.map(o => o.owners)
              .filter(Boolean) ?? []
            const style = STATUS_STYLES[item.status] ?? STATUS_STYLES.pending

            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {lot?.unit_number ? `Unit ${lot.unit_number}` : `Lot ${lot?.lot_number ?? '?'}`}
                </TableCell>
                <TableCell>
                  {owners.length > 0
                    ? owners.map(o => `${o!.first_name} ${o!.last_name}`).join(', ')
                    : <span className="text-muted-foreground">Unassigned</span>
                  }
                </TableCell>
                <TableCell className="text-right">{formatCurrency(item.admin_levy_amount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.capital_levy_amount)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(item.total_levy_amount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.amount_paid)}</TableCell>
                <TableCell className="text-right font-medium">
                  {item.balance > 0
                    ? formatCurrency(item.balance)
                    : <span className="text-green-700">{formatCurrency(0)}</span>
                  }
                </TableCell>
                <TableCell>{formatDate(item.due_date)}</TableCell>
                <TableCell>
                  <Badge variant={style.variant} className={style.className}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
          <TableRow className="bg-muted/50 font-medium">
            <TableCell colSpan={2}>Totals</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.admin)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.capital)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.total)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.paid)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.balance)}</TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
