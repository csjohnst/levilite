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
import { Separator } from '@/components/ui/separator'
import { getIncomeStatement } from '@/actions/reports'
import { ExportPDFButton } from '@/components/reports/export-pdf-button'

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface FundSectionProps {
  title: string
  income: { category_id: string; code: string; name: string; total: number }[]
  expenses: { category_id: string; code: string; name: string; total: number }[]
  totalIncome: number
  totalExpenses: number
  net: number
}

function FundSection({ title, income, expenses, totalIncome, totalExpenses, net }: FundSectionProps) {
  const hasData = income.length > 0 || expenses.length > 0

  if (!hasData) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Income section */}
            {income.length > 0 && (
              <>
                <TableRow className="bg-green-50">
                  <TableCell colSpan={3} className="font-semibold text-sm text-green-800">
                    Income
                  </TableCell>
                </TableRow>
                {income.map(item => (
                  <TableRow key={item.category_id}>
                    <TableCell className="font-mono text-sm">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right text-green-700">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell colSpan={2} className="text-right">Total Income</TableCell>
                  <TableCell className="text-right text-green-700">{formatCurrency(totalIncome)}</TableCell>
                </TableRow>
              </>
            )}

            {/* Expenses section */}
            {expenses.length > 0 && (
              <>
                <TableRow className="bg-red-50">
                  <TableCell colSpan={3} className="font-semibold text-sm text-red-800">
                    Expenses
                  </TableCell>
                </TableRow>
                {expenses.map(item => (
                  <TableRow key={item.category_id}>
                    <TableCell className="font-mono text-sm">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right text-red-700">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell colSpan={2} className="text-right">Total Expenses</TableCell>
                  <TableCell className="text-right text-red-700">{formatCurrency(totalExpenses)}</TableCell>
                </TableRow>
              </>
            )}

            {/* Net */}
            <TableRow className="bg-muted font-bold">
              <TableCell colSpan={2} className="text-right">
                Net {net >= 0 ? 'Surplus' : 'Deficit'}
              </TableCell>
              <TableCell className={`text-right ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(net)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default async function IncomeStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { id } = await params
  const filters = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scheme } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number')
    .eq('id', id)
    .single()

  if (!scheme) notFound()

  // Default date range: current financial year (July 1 to June 30)
  const now = new Date()
  const fyStart = now.getMonth() >= 6
    ? `${now.getFullYear()}-07-01`
    : `${now.getFullYear() - 1}-07-01`
  const fyEnd = now.getMonth() >= 6
    ? `${now.getFullYear() + 1}-06-30`
    : `${now.getFullYear()}-06-30`

  const startDate = filters.from || fyStart
  const endDate = filters.to || fyEnd

  const result = await getIncomeStatement(id, { startDate, endDate })
  const statement = result.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Income Statement</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/trust/reports`} className="hover:underline">Reports</Link>
            {' '}&mdash; Income Statement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPDFButton
            schemeId={id}
            reportType="income-statement"
            params={{ startDate, endDate }}
          />
          <Button asChild variant="outline">
            <Link href={`/schemes/${id}/trust/reports`}>
              <ArrowLeft className="mr-2 size-4" />
              Back to Reports
            </Link>
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Period: {startDate} to {endDate}
      </div>

      {!statement || (statement.combined.total_income === 0 && statement.combined.total_expenses === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No income or expense transactions for this period.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <FundSection
            title="Admin Fund"
            income={statement.admin.income}
            expenses={statement.admin.expenses}
            totalIncome={statement.admin.total_income}
            totalExpenses={statement.admin.total_expenses}
            net={statement.admin.net}
          />

          <FundSection
            title="Capital Works Fund"
            income={statement.capital_works.income}
            expenses={statement.capital_works.expenses}
            totalIncome={statement.capital_works.total_income}
            totalExpenses={statement.capital_works.total_expenses}
            net={statement.capital_works.net}
          />

          {/* Combined summary */}
          <Card>
            <CardHeader>
              <CardTitle>Combined Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Income</p>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(statement.combined.total_income)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-700">{formatCurrency(statement.combined.total_expenses)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Net {statement.combined.net >= 0 ? 'Surplus' : 'Deficit'}
                  </p>
                  <p className={`text-2xl font-bold ${statement.combined.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(statement.combined.net)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
