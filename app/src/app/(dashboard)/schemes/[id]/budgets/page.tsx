import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Plus, Wallet, Trash2 } from 'lucide-react'
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

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  draft: { className: 'bg-yellow-100 text-yellow-800', label: 'Draft' },
  review: { className: 'bg-blue-100 text-blue-800', label: 'In Review' },
  approved: { className: 'bg-green-100 text-green-800', label: 'Approved' },
  amended: { className: 'bg-purple-100 text-purple-800', label: 'Amended' },
}

const FUND_LABELS: Record<string, string> = {
  admin: 'Admin Fund',
  capital_works: 'Capital Works',
}

export default async function BudgetListPage({
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

  const { data: budgets } = await supabase
    .from('budgets')
    .select(`
      *,
      financial_years:financial_year_id(id, year_label, start_date, end_date, is_current)
    `)
    .eq('scheme_id', id)
    .order('created_at', { ascending: false })

  const budgetList = (budgets ?? []) as Array<{
    id: string
    budget_type: string
    total_amount: number
    status: string
    approved_at: string | null
    notes: string | null
    created_at: string
    financial_years: {
      id: string
      year_label: string
      is_current: boolean
    } | null
  }>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Budgets</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash; Budget Management
          </p>
        </div>
        <Button asChild>
          <Link href={`/schemes/${id}/budgets/new`}>
            <Plus className="mr-2 size-4" />
            Create Budget
          </Link>
        </Button>
      </div>

      {budgetList.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Financial Year</TableHead>
                <TableHead>Fund Type</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetList.map(budget => {
                const style = STATUS_STYLES[budget.status] ?? STATUS_STYLES.draft
                return (
                  <TableRow key={budget.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/schemes/${id}/budgets/${budget.id}`}
                        className="hover:underline"
                      >
                        {budget.financial_years?.year_label ?? 'Unknown FY'}
                        {budget.financial_years?.is_current && (
                          <Badge variant="outline" className="ml-2 text-[10px]">Current</Badge>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {FUND_LABELS[budget.budget_type] ?? budget.budget_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(Number(budget.total_amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={style.className}>
                        {style.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {budget.approved_at ?? '--'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No budgets yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a budget to start planning income and expenses for this scheme.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/schemes/${id}/budgets/new`}>
                <Plus className="mr-2 size-4" />
                Create First Budget
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
