import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { commonStyles, formatCurrency, ReportHeader, ReportFooter } from './report-common'
import type { BudgetVsActualRow } from '@/actions/budgets'

interface BudgetVsActualReportData {
  schemeName: string
  schemeNumber: string
  schemeAddress: string
  financialYear: string
  fundType: 'admin' | 'capital_works'
  rows: BudgetVsActualRow[]
}

const FUND_LABELS: Record<string, string> = {
  admin: 'Admin Fund',
  capital_works: 'Capital Works Fund',
}

function getVarianceColor(pct: number | null): string {
  if (pct === null) return '#333333'
  if (pct > 10) return '#DC2626'
  if (pct > 0) return '#D97706'
  return '#16A34A'
}

export function BudgetVsActualReportPDF({ data }: { data: BudgetVsActualReportData }) {
  const now = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  const totalBudgeted = Math.round(data.rows.reduce((s, r) => s + r.budgeted_amount, 0) * 100) / 100
  const totalActual = Math.round(data.rows.reduce((s, r) => s + r.actual_amount, 0) * 100) / 100
  const totalVariance = Math.round((totalActual - totalBudgeted) * 100) / 100
  const totalVariancePct = totalBudgeted !== 0
    ? Math.round(((totalActual - totalBudgeted) / totalBudgeted) * 10000) / 100
    : null

  return (
    <Document>
      <Page size="A4" style={commonStyles.page}>
        <ReportHeader
          schemeName={data.schemeName}
          schemeNumber={data.schemeNumber}
          schemeAddress={data.schemeAddress}
          reportTitle="Budget vs Actual Report"
          subtitle={`${FUND_LABELS[data.fundType]} - FY ${data.financialYear}`}
        />

        {/* Table header */}
        <View style={commonStyles.tableHeader}>
          <Text style={[commonStyles.tableHeaderText, { width: '10%' }]}>Code</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '28%' }]}>Category</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '14%', textAlign: 'right' }]}>Budget</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '14%', textAlign: 'right' }]}>Actual</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '14%', textAlign: 'right' }]}>Var ($)</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '10%', textAlign: 'right' }]}>Var (%)</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '10%', textAlign: 'center' }]}>Status</Text>
        </View>

        {data.rows.map((row, i) => {
          const color = getVarianceColor(row.variance_pct)
          return (
            <View key={row.category_id} style={i % 2 === 0 ? commonStyles.tableRow : commonStyles.tableRowAlt}>
              <Text style={[commonStyles.cellTextMono, { width: '10%' }]}>{row.category_code}</Text>
              <Text style={[commonStyles.cellText, { width: '28%' }]}>{row.category_name}</Text>
              <Text style={[commonStyles.cellTextMono, { width: '14%', textAlign: 'right' }]}>
                {formatCurrency(row.budgeted_amount)}
              </Text>
              <Text style={[commonStyles.cellTextMono, { width: '14%', textAlign: 'right' }]}>
                {formatCurrency(row.actual_amount)}
              </Text>
              <Text style={[commonStyles.cellTextMono, { width: '14%', textAlign: 'right', color }]}>
                {row.variance !== 0
                  ? (row.variance > 0 ? '+' : '-') + formatCurrency(row.variance)
                  : '-'
                }
              </Text>
              <Text style={[commonStyles.cellTextMono, { width: '10%', textAlign: 'right', color }]}>
                {row.variance_pct !== null ? `${row.variance_pct >= 0 ? '+' : ''}${row.variance_pct.toFixed(1)}%` : 'N/A'}
              </Text>
              <Text style={[commonStyles.cellText, { width: '10%', textAlign: 'center', color }]}>
                {row.status === 'on_track' ? 'OK' : row.status === 'monitor' ? 'Watch' : 'Over'}
              </Text>
            </View>
          )
        })}

        {/* Totals */}
        <View style={commonStyles.tableFooter}>
          <Text style={[commonStyles.cellTextBold, { width: '38%' }]}>Totals</Text>
          <Text style={[commonStyles.cellTextBold, { width: '14%', textAlign: 'right' }]}>{formatCurrency(totalBudgeted)}</Text>
          <Text style={[commonStyles.cellTextBold, { width: '14%', textAlign: 'right' }]}>{formatCurrency(totalActual)}</Text>
          <Text style={[commonStyles.cellTextBold, { width: '14%', textAlign: 'right', color: getVarianceColor(totalVariancePct) }]}>
            {totalVariance !== 0
              ? (totalVariance > 0 ? '+' : '-') + formatCurrency(totalVariance)
              : '-'
            }
          </Text>
          <Text style={[commonStyles.cellTextBold, { width: '10%', textAlign: 'right', color: getVarianceColor(totalVariancePct) }]}>
            {totalVariancePct !== null ? `${totalVariancePct >= 0 ? '+' : ''}${totalVariancePct.toFixed(1)}%` : 'N/A'}
          </Text>
          <Text style={[commonStyles.cellTextBold, { width: '10%' }]} />
        </View>

        <ReportFooter generatedAt={now} />
      </Page>
    </Document>
  )
}
