import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getFundBalanceSummary } from '@/actions/reports'
import { ExportPDFButton } from '@/components/reports/export-pdf-button'

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const FUND_LABELS: Record<string, string> = {
  admin: 'Admin Fund',
  capital_works: 'Capital Works Fund',
}

export default async function FundSummaryPage({
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

  const result = await getFundBalanceSummary(id)
  const balances = result.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fund Summary</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/trust/reports`} className="hover:underline">Reports</Link>
            {' '}&mdash; Fund Summary
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPDFButton
            schemeId={id}
            reportType="fund-summary"
          />
          <Button asChild variant="outline">
            <Link href={`/schemes/${id}/trust/reports`}>
              <ArrowLeft className="mr-2 size-4" />
              Back to Reports
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {balances.map(fund => {
          const netMovement = fund.total_receipts - fund.total_payments

          return (
            <Card key={fund.fund_type}>
              <CardHeader>
                <CardTitle>{FUND_LABELS[fund.fund_type]}</CardTitle>
                <CardDescription>Balance overview for this financial year</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Opening Balance</span>
                  <span className="font-medium">{formatCurrency(fund.opening_balance)}</span>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <ArrowUpRight className="size-4 text-green-600" />
                    Total Receipts
                  </span>
                  <span className="font-medium text-green-700">+{formatCurrency(fund.total_receipts)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <ArrowDownRight className="size-4 text-red-600" />
                    Total Payments
                  </span>
                  <span className="font-medium text-red-700">-{formatCurrency(fund.total_payments)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-muted-foreground" />
                    Net Movement
                  </span>
                  <span className={`font-medium ${netMovement >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {netMovement >= 0 ? '+' : ''}{formatCurrency(netMovement)}
                  </span>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="font-semibold">Closing Balance</span>
                  <span className="text-2xl font-bold">{formatCurrency(fund.closing_balance)}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {balances.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No financial data to display. Record transactions to see fund summaries.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
