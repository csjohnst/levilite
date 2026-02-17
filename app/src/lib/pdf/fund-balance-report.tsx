import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { commonStyles, formatCurrency, ReportHeader, ReportFooter } from './report-common'
import type { FundBalance } from '@/actions/reports'

interface FundBalanceReportData {
  schemeName: string
  schemeNumber: string
  schemeAddress: string
  dateRange: { startDate: string; endDate: string } | null
  balances: FundBalance[]
}

const FUND_LABELS: Record<string, string> = {
  admin: 'Admin Fund',
  capital_works: 'Capital Works Fund',
}

export function FundBalanceReportPDF({ data }: { data: FundBalanceReportData }) {
  const now = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const subtitle = data.dateRange
    ? `${data.dateRange.startDate} to ${data.dateRange.endDate}`
    : `As at ${now}`

  const combinedOpening = data.balances.reduce((s, b) => s + b.opening_balance, 0)
  const combinedReceipts = data.balances.reduce((s, b) => s + b.total_receipts, 0)
  const combinedPayments = data.balances.reduce((s, b) => s + b.total_payments, 0)
  const combinedClosing = data.balances.reduce((s, b) => s + b.closing_balance, 0)

  return (
    <Document>
      <Page size="A4" style={commonStyles.page}>
        <ReportHeader
          schemeName={data.schemeName}
          schemeNumber={data.schemeNumber}
          schemeAddress={data.schemeAddress}
          reportTitle="Fund Balance Summary"
          subtitle={subtitle}
        />

        {data.balances.map(fund => (
          <View key={fund.fund_type} style={commonStyles.summaryCard}>
            <Text style={commonStyles.sectionTitle}>{FUND_LABELS[fund.fund_type] ?? fund.fund_type}</Text>
            <View style={commonStyles.summaryRow}>
              <Text style={commonStyles.summaryLabel}>Opening Balance</Text>
              <Text style={commonStyles.summaryValue}>{formatCurrency(fund.opening_balance)}</Text>
            </View>
            <View style={commonStyles.summaryRow}>
              <Text style={[commonStyles.summaryLabel, { color: '#16A34A' }]}>Add: Receipts</Text>
              <Text style={[commonStyles.summaryValue, { color: '#16A34A' }]}>{formatCurrency(fund.total_receipts)}</Text>
            </View>
            <View style={commonStyles.summaryRow}>
              <Text style={[commonStyles.summaryLabel, { color: '#DC2626' }]}>Less: Payments</Text>
              <Text style={[commonStyles.summaryValue, { color: '#DC2626' }]}>{formatCurrency(fund.total_payments)}</Text>
            </View>
            <View style={{ borderTop: '1px solid #333333', marginTop: 4, paddingTop: 4 }}>
              <View style={commonStyles.summaryRow}>
                <Text style={[commonStyles.summaryLabel, { fontFamily: 'Helvetica-Bold' }]}>Closing Balance</Text>
                <Text style={commonStyles.summaryValue}>{formatCurrency(fund.closing_balance)}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Combined */}
        <View style={[commonStyles.summaryCard, { backgroundColor: '#F0F7FA' }]}>
          <Text style={commonStyles.sectionTitle}>Combined Totals</Text>
          <View style={commonStyles.summaryRow}>
            <Text style={commonStyles.summaryLabel}>Opening Balance</Text>
            <Text style={commonStyles.summaryValue}>{formatCurrency(combinedOpening)}</Text>
          </View>
          <View style={commonStyles.summaryRow}>
            <Text style={commonStyles.summaryLabel}>Total Receipts</Text>
            <Text style={[commonStyles.summaryValue, { color: '#16A34A' }]}>{formatCurrency(combinedReceipts)}</Text>
          </View>
          <View style={commonStyles.summaryRow}>
            <Text style={commonStyles.summaryLabel}>Total Payments</Text>
            <Text style={[commonStyles.summaryValue, { color: '#DC2626' }]}>{formatCurrency(combinedPayments)}</Text>
          </View>
          <View style={{ borderTop: '1px solid #333333', marginTop: 4, paddingTop: 4 }}>
            <View style={commonStyles.summaryRow}>
              <Text style={[commonStyles.summaryLabel, { fontFamily: 'Helvetica-Bold' }]}>Combined Closing Balance</Text>
              <Text style={commonStyles.summaryValue}>{formatCurrency(combinedClosing)}</Text>
            </View>
          </View>
        </View>

        <ReportFooter generatedAt={now} />
      </Page>
    </Document>
  )
}
