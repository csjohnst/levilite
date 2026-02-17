'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Scale, Landmark, FileBarChart, BarChart3, Receipt, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Scheme {
  id: string
  scheme_name: string
  scheme_number: string
}

interface ReportsHubProps {
  schemes: Scheme[]
}

export function ReportsHub({ schemes }: ReportsHubProps) {
  const [selectedSchemeId, setSelectedSchemeId] = useState(schemes[0]?.id ?? '')

  const selectedScheme = schemes.find(s => s.id === selectedSchemeId)

  const reports = selectedSchemeId ? [
    {
      title: 'Trial Balance',
      description: 'Verify that total debits equal total credits across all accounts.',
      href: `/schemes/${selectedSchemeId}/trust/reports/trial-balance`,
      icon: Scale,
    },
    {
      title: 'Fund Summary',
      description: 'Opening balance, receipts, payments, and closing balance for each fund.',
      href: `/schemes/${selectedSchemeId}/trust/reports/fund-summary`,
      icon: Landmark,
    },
    {
      title: 'Income Statement',
      description: 'Revenue and expenses by category for each fund.',
      href: `/schemes/${selectedSchemeId}/trust/reports/income-statement`,
      icon: FileBarChart,
    },
    {
      title: 'Budget vs Actual',
      description: 'Compare budgeted amounts against actual spending by category.',
      href: `/schemes/${selectedSchemeId}/trust/reports/budget-vs-actual`,
      icon: BarChart3,
    },
    {
      title: 'Levy Roll',
      description: 'Complete levy roll showing each lot, owner, amounts due, and payment status.',
      href: `/schemes/${selectedSchemeId}/trust/reports/levy-roll`,
      icon: Receipt,
    },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">
          Financial reports and analysis for your schemes
        </p>
      </div>

      {schemes.length > 0 ? (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Scheme</label>
                <Select value={selectedSchemeId} onValueChange={setSelectedSchemeId}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Choose a scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    {schemes.map(scheme => (
                      <SelectItem key={scheme.id} value={scheme.id}>
                        {scheme.scheme_name} ({scheme.scheme_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedScheme && (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
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
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No schemes</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a scheme first before viewing reports.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
