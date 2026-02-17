import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Scale, Landmark, FileBarChart, PieChart, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function ReportsHubPage({
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

  const reports = [
    {
      title: 'Trial Balance',
      description: 'Verify that total debits equal total credits across all accounts. Essential for accounting accuracy.',
      href: `/schemes/${id}/trust/reports/trial-balance`,
      icon: Scale,
    },
    {
      title: 'Fund Summary',
      description: 'Opening balance, receipts, payments, and closing balance for each fund (Admin and Capital Works).',
      href: `/schemes/${id}/trust/reports/fund-summary`,
      icon: Landmark,
    },
    {
      title: 'Income Statement',
      description: 'Revenue and expenses by category for each fund. Shows net surplus or deficit for the period.',
      href: `/schemes/${id}/trust/reports/income-statement`,
      icon: FileBarChart,
    },
    {
      title: 'Budget vs Actual',
      description: 'Compare budgeted amounts against actual spending by category. Track variance and identify over-budget areas.',
      href: `/schemes/${id}/trust/reports/budget-vs-actual`,
      icon: PieChart,
    },
    {
      title: 'Levy Roll',
      description: 'View levy assessments per lot with payment status, collection rates, and outstanding balances.',
      href: `/schemes/${id}/trust/reports/levy-roll`,
      icon: ClipboardList,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Financial Reports</h2>
          <p className="text-muted-foreground">
            <Link href={`/schemes/${id}`} className="hover:underline">{scheme.scheme_name}</Link>
            {' '}&mdash;{' '}
            <Link href={`/schemes/${id}/trust`} className="hover:underline">Trust Accounting</Link>
            {' '}&mdash; Reports
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/schemes/${id}/trust`}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Ledger
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {reports.map(report => (
          <Card key={report.title} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <report.icon className="size-5 text-primary" />
                </div>
                <CardTitle className="text-base">{report.title}</CardTitle>
              </div>
              <CardDescription className="mt-2">
                {report.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild variant="outline" className="w-full">
                <Link href={report.href}>
                  View Report
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
