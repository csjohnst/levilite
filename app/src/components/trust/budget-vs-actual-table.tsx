'use client'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'

export interface BudgetVsActualRow {
  category_id: string
  category_code: string
  category_name: string
  budgeted_amount: number
  actual_amount: number
  variance: number
  variance_pct: number | null
  status: 'on_track' | 'monitor' | 'over_budget'
}

interface BudgetVsActualTableProps {
  rows: BudgetVsActualRow[]
}

function formatCurrency(amount: number): string {
  return '$' + Math.abs(amount).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatVariancePct(pct: number | null): string {
  if (pct === null) return 'N/A'
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; className: string }> = {
  on_track: { label: 'On Track', variant: 'secondary', className: 'bg-green-100 text-green-800' },
  monitor: { label: 'Monitor', variant: 'secondary', className: 'bg-amber-100 text-amber-800' },
  over_budget: { label: 'Over Budget', variant: 'destructive', className: '' },
}

export function BudgetVsActualTable({ rows }: BudgetVsActualTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <h3 className="text-lg font-medium">No budget line items</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a budget to see the comparison with actuals.
        </p>
      </div>
    )
  }

  const totalBudgeted = Math.round(rows.reduce((sum, r) => sum + r.budgeted_amount, 0) * 100) / 100
  const totalActual = Math.round(rows.reduce((sum, r) => sum + r.actual_amount, 0) * 100) / 100
  const totalVariance = Math.round((totalActual - totalBudgeted) * 100) / 100
  const totalVariancePct = totalBudgeted !== 0
    ? Math.round(((totalActual - totalBudgeted) / totalBudgeted) * 10000) / 100
    : null

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Code</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Budget</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Variance ($)</TableHead>
            <TableHead className="text-right">Variance (%)</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const config = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.on_track
            const varianceColor = row.variance > 0 ? 'text-red-600' : row.variance < 0 ? 'text-green-600' : ''

            return (
              <TableRow key={row.category_id}>
                <TableCell className="font-mono text-sm">{row.category_code}</TableCell>
                <TableCell>{row.category_name}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.budgeted_amount)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.actual_amount)}
                </TableCell>
                <TableCell className={`text-right font-mono ${varianceColor}`}>
                  {row.variance !== 0
                    ? (row.variance > 0 ? '+' : '-') + formatCurrency(row.variance)
                    : '-'
                  }
                </TableCell>
                <TableCell className={`text-right font-mono ${varianceColor}`}>
                  {formatVariancePct(row.variance_pct)}
                </TableCell>
                <TableCell>
                  <Badge variant={config.variant} className={config.className}>
                    {config.label}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow className="font-bold">
            <TableCell colSpan={2}>Totals</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(totalBudgeted)}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(totalActual)}</TableCell>
            <TableCell className={`text-right font-mono ${totalVariance > 0 ? 'text-red-600' : totalVariance < 0 ? 'text-green-600' : ''}`}>
              {totalVariance !== 0
                ? (totalVariance > 0 ? '+' : '-') + formatCurrency(totalVariance)
                : '-'
              }
            </TableCell>
            <TableCell className={`text-right font-mono ${totalVariance > 0 ? 'text-red-600' : totalVariance < 0 ? 'text-green-600' : ''}`}>
              {formatVariancePct(totalVariancePct)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
