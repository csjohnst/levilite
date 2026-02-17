import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
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
import { getTrialBalance } from '@/actions/reports'
import type { TrialBalanceRow } from '@/actions/reports'
import { ExportPDFButton } from '@/components/reports/export-pdf-button'

function formatCurrency(amount: number): string {
  return '$' + Math.abs(amount).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
}

const ACCOUNT_TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense']

export default async function TrialBalancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { id } = await params
  const { date } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scheme } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number')
    .eq('id', id)
    .single()

  if (!scheme) notFound()

  const result = await getTrialBalance(id, date || undefined)
  const trialBalance = result.data

  // Group rows by account type
  const grouped = ACCOUNT_TYPE_ORDER.map(type => ({
    type,
    label: ACCOUNT_TYPE_LABELS[type],
    rows: (trialBalance?.rows ?? []).filter(r => r.account_type === type),
  })).filter(g => g.rows.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Trial Balance</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/trust/reports`} className="hover:underline">Reports</Link>
            {' '}&mdash; Trial Balance
            {date && ` (as at ${date})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPDFButton
            schemeId={id}
            reportType="trial-balance"
            params={{ asAtDate: date || undefined }}
          />
          <Button asChild variant="outline">
            <Link href={`/schemes/${id}/trust/reports`}>
              <ArrowLeft className="mr-2 size-4" />
              Back to Reports
            </Link>
          </Button>
        </div>
      </div>

      {/* Balance status */}
      <div className="flex items-center gap-3">
        <Badge
          variant={trialBalance?.isBalanced ? 'secondary' : 'destructive'}
          className={trialBalance?.isBalanced ? 'bg-green-100 text-green-800' : ''}
        >
          {trialBalance?.isBalanced ? 'Balanced' : 'UNBALANCED'}
        </Badge>
        {!trialBalance?.isBalanced && trialBalance && (
          <span className="text-sm text-destructive">
            Difference: {formatCurrency(trialBalance.totalDebits - trialBalance.totalCredits)}
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Balances</CardTitle>
          <CardDescription>
            {trialBalance?.rows.length ?? 0} account{(trialBalance?.rows.length ?? 0) !== 1 ? 's' : ''} with activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!trialBalance || trialBalance.rows.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No transactions recorded yet. Trial balance will appear once transactions are entered.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(group => (
                  <>
                    <TableRow key={`header-${group.type}`} className="bg-muted/50">
                      <TableCell colSpan={5} className="font-semibold text-sm uppercase tracking-wide py-2">
                        {group.label}
                      </TableCell>
                    </TableRow>
                    {group.rows.map(row => (
                      <TableRow key={row.account_id}>
                        <TableCell className="font-mono text-sm">{row.code}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-right">
                          {row.total_debits > 0 ? formatCurrency(row.total_debits) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.total_credits > 0 ? formatCurrency(row.total_credits) : '-'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${row.balance < 0 ? 'text-red-700' : ''}`}>
                          {row.balance !== 0 ? (row.balance < 0 ? `(${formatCurrency(row.balance)})` : formatCurrency(row.balance)) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted font-bold">
                  <TableCell colSpan={2}>Totals</TableCell>
                  <TableCell className="text-right">{formatCurrency(trialBalance.totalDebits)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(trialBalance.totalCredits)}</TableCell>
                  <TableCell className="text-right">
                    {trialBalance.totalDebits - trialBalance.totalCredits !== 0
                      ? formatCurrency(trialBalance.totalDebits - trialBalance.totalCredits)
                      : '-'
                    }
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
