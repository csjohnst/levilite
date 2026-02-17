import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { commonStyles, formatCurrency, ReportHeader, ReportFooter } from './report-common'
import type { TrialBalanceRow } from '@/actions/reports'

interface TrialBalanceReportData {
  schemeName: string
  schemeNumber: string
  schemeAddress: string
  asAtDate: string | null
  rows: TrialBalanceRow[]
  totalDebits: number
  totalCredits: number
  isBalanced: boolean
}

const ACCOUNT_TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense']
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
}

export function TrialBalanceReportPDF({ data }: { data: TrialBalanceReportData }) {
  const grouped = ACCOUNT_TYPE_ORDER.map(type => ({
    type,
    label: ACCOUNT_TYPE_LABELS[type],
    rows: data.rows.filter(r => r.account_type === type),
  })).filter(g => g.rows.length > 0)

  const now = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Document>
      <Page size="A4" style={commonStyles.page}>
        <ReportHeader
          schemeName={data.schemeName}
          schemeNumber={data.schemeNumber}
          schemeAddress={data.schemeAddress}
          reportTitle="Trial Balance"
          subtitle={data.asAtDate ? `As at ${data.asAtDate}` : `As at ${now}`}
        />

        {/* Status badge */}
        <View style={{ marginBottom: 10 }}>
          <Text style={[commonStyles.cellTextBold, { color: data.isBalanced ? '#16A34A' : '#DC2626' }]}>
            {data.isBalanced ? 'BALANCED' : 'UNBALANCED'}
          </Text>
        </View>

        {/* Table header */}
        <View style={commonStyles.tableHeader}>
          <Text style={[commonStyles.tableHeaderText, { width: '12%' }]}>Code</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '38%' }]}>Account Name</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '16%', textAlign: 'right' }]}>Debit</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '16%', textAlign: 'right' }]}>Credit</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '18%', textAlign: 'right' }]}>Balance</Text>
        </View>

        {grouped.map(group => (
          <React.Fragment key={group.type}>
            {/* Group header */}
            <View style={{ flexDirection: 'row', backgroundColor: '#E9ECEF', paddingVertical: 2, paddingHorizontal: 6 }}>
              <Text style={[commonStyles.cellTextBold, { fontSize: 7, textTransform: 'uppercase' }]}>{group.label}</Text>
            </View>
            {group.rows.map((row, i) => (
              <View key={row.account_id} style={i % 2 === 0 ? commonStyles.tableRow : commonStyles.tableRowAlt}>
                <Text style={[commonStyles.cellTextMono, { width: '12%' }]}>{row.code}</Text>
                <Text style={[commonStyles.cellText, { width: '38%' }]}>{row.name}</Text>
                <Text style={[commonStyles.cellTextMono, { width: '16%', textAlign: 'right' }]}>
                  {row.total_debits > 0 ? formatCurrency(row.total_debits) : '-'}
                </Text>
                <Text style={[commonStyles.cellTextMono, { width: '16%', textAlign: 'right' }]}>
                  {row.total_credits > 0 ? formatCurrency(row.total_credits) : '-'}
                </Text>
                <Text style={[
                  commonStyles.cellTextMono,
                  { width: '18%', textAlign: 'right' },
                  row.balance < 0 ? { color: '#DC2626' } : {},
                ]}>
                  {row.balance !== 0 ? (row.balance < 0 ? `(${formatCurrency(row.balance)})` : formatCurrency(row.balance)) : '-'}
                </Text>
              </View>
            ))}
          </React.Fragment>
        ))}

        {/* Totals */}
        <View style={commonStyles.tableFooter}>
          <Text style={[commonStyles.cellTextBold, { width: '50%' }]}>Totals</Text>
          <Text style={[commonStyles.cellTextBold, { width: '16%', textAlign: 'right' }]}>{formatCurrency(data.totalDebits)}</Text>
          <Text style={[commonStyles.cellTextBold, { width: '16%', textAlign: 'right' }]}>{formatCurrency(data.totalCredits)}</Text>
          <Text style={[commonStyles.cellTextBold, { width: '18%', textAlign: 'right' }]}>
            {formatCurrency(data.totalDebits - data.totalCredits)}
          </Text>
        </View>

        <ReportFooter generatedAt={now} />
      </Page>
    </Document>
  )
}
