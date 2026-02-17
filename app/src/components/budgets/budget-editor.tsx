'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  TableFooter,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { updateBudgetLineItem, approveBudget } from '@/actions/budgets'

interface LineItem {
  id: string
  budgeted_amount: number
  previous_year_actual: number | null
  notes: string | null
  chart_of_accounts: {
    id: string
    code: string
    name: string
    account_type: string
    fund_type: string | null
  } | null
}

interface BudgetEditorProps {
  schemeId: string
  budgetId: string
  status: string
  totalAmount: number
  lineItems: LineItem[]
  totalEntitlement: number
  periodsPerYear: number
}

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  draft: { className: 'bg-yellow-100 text-yellow-800', label: 'Draft' },
  review: { className: 'bg-blue-100 text-blue-800', label: 'In Review' },
  approved: { className: 'bg-green-100 text-green-800', label: 'Approved' },
  amended: { className: 'bg-purple-100 text-purple-800', label: 'Amended' },
}

function formatCurrency(amount: number): string {
  return '$' + Math.abs(amount).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function BudgetEditor({
  schemeId,
  budgetId,
  status,
  totalAmount,
  lineItems,
  totalEntitlement,
  periodsPerYear,
}: BudgetEditorProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [approving, setApproving] = useState(false)
  const [localTotalAmount, setLocalTotalAmount] = useState(totalAmount)

  // Split into income and expense categories
  const incomeItems = lineItems.filter(l => l.chart_of_accounts?.account_type === 'income')
  const expenseItems = lineItems.filter(l => l.chart_of_accounts?.account_type === 'expense')

  const totalIncome = incomeItems.reduce((sum, l) => sum + Number(l.budgeted_amount), 0)
  const totalExpenses = expenseItems.reduce((sum, l) => sum + Number(l.budgeted_amount), 0)

  async function handleSave(lineItemId: string) {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setSaving(true)
    const result = await updateBudgetLineItem(lineItemId, {
      budgeted_amount: amount,
      notes: null,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      setLocalTotalAmount(result.data?.totalAmount ?? localTotalAmount)
      router.refresh()
    }
    setSaving(false)
    setEditingId(null)
  }

  function startEditing(lineItemId: string, currentAmount: number) {
    setEditingId(lineItemId)
    setEditAmount(String(currentAmount))
  }

  async function handleApprove() {
    setApproving(true)
    const result = await approveBudget(budgetId, new Date().toISOString().split('T')[0])
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Budget approved')
      router.refresh()
    }
    setApproving(false)
    setShowApproveDialog(false)
  }

  // Levy calculator
  const levyPerUnit = totalEntitlement > 0
    ? localTotalAmount / totalEntitlement
    : 0
  const levyPerPeriod = periodsPerYear > 0
    ? levyPerUnit / periodsPerYear
    : levyPerUnit

  const isEditable = status === 'draft' || status === 'review'
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft

  function renderLineItems(items: LineItem[], label: string) {
    if (items.length === 0) return null
    const sectionTotal = items.reduce((sum, l) => sum + Number(l.budgeted_amount), 0)

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </h4>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right w-[130px]">Prev. Actual</TableHead>
                <TableHead className="text-right w-[150px]">Budget</TableHead>
                <TableHead className="text-right w-[120px]">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => {
                const acct = item.chart_of_accounts
                if (!acct) return null
                const budgeted = Number(item.budgeted_amount)
                const prevActual = item.previous_year_actual != null ? Number(item.previous_year_actual) : null
                const variance = prevActual != null ? budgeted - prevActual : null

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{acct.code}</TableCell>
                    <TableCell>{acct.name}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {prevActual != null ? formatCurrency(prevActual) : '--'}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSave(item.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="w-[120px] text-right"
                            autoFocus
                            disabled={saving}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleSave(item.id)}
                            disabled={saving}
                          >
                            <Check className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className={`font-mono font-medium ${isEditable ? 'cursor-pointer hover:underline' : ''}`}
                          onClick={() => isEditable && startEditing(item.id, budgeted)}
                        >
                          {formatCurrency(budgeted)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {variance != null ? (
                        <span className={`font-mono text-sm ${variance > 0 ? 'text-green-700' : variance < 0 ? 'text-red-700' : ''}`}>
                          {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="font-medium">
                <TableCell colSpan={3}>Total {label}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(sectionTotal)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className={statusStyle.className}>
          {statusStyle.label}
        </Badge>
        {isEditable && (
          <Button onClick={() => setShowApproveDialog(true)}>
            <Check className="mr-2 size-4" />
            Approve Budget
          </Button>
        )}
      </div>

      {/* Line items */}
      {renderLineItems(incomeItems, 'Income')}
      {renderLineItems(expenseItems, 'Expenses')}

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Income Budget</span>
            <span className="font-mono font-medium text-green-700">{formatCurrency(totalIncome)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Expense Budget</span>
            <span className="font-mono font-medium text-red-700">{formatCurrency(totalExpenses)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="font-medium">Total Budget</span>
            <span className="font-mono text-lg font-bold">{formatCurrency(localTotalAmount)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Levy calculator */}
      {totalEntitlement > 0 && localTotalAmount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Levy Calculator</CardTitle>
            <CardDescription>
              Based on {totalEntitlement} total unit entitlements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Levy per unit entitlement (annual)</span>
              <span className="font-mono font-medium">{formatCurrency(levyPerUnit)}</span>
            </div>
            {periodsPerYear > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Levy per unit entitlement (per {periodsPerYear === 4 ? 'quarter' : periodsPerYear === 12 ? 'month' : 'period'})
                </span>
                <span className="font-mono font-medium">{formatCurrency(levyPerPeriod)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approve dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Budget</DialogTitle>
            <DialogDescription>
              Approving this budget will lock it from further edits. The total budget amount is {formatCurrency(localTotalAmount)}. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? 'Approving...' : 'Approve'}
            </Button>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
