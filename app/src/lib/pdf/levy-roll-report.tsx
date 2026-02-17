import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { commonStyles, formatCurrency, ReportHeader, ReportFooter } from './report-common'

interface LevyRollItem {
  lotNumber: string
  unitNumber: string | null
  ownerName: string
  adminLevy: number
  capitalLevy: number
  totalLevy: number
  amountPaid: number
  balance: number
  status: string
  dueDate: string
}

interface LevyRollReportData {
  schemeName: string
  schemeNumber: string
  schemeAddress: string
  periodName: string
  periodStart: string
  periodEnd: string
  items: LevyRollItem[]
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function LevyRollReportPDF({ data }: { data: LevyRollReportData }) {
  const now = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  const totalAdmin = Math.round(data.items.reduce((s, i) => s + i.adminLevy, 0) * 100) / 100
  const totalCapital = Math.round(data.items.reduce((s, i) => s + i.capitalLevy, 0) * 100) / 100
  const totalLevy = Math.round(data.items.reduce((s, i) => s + i.totalLevy, 0) * 100) / 100
  const totalPaid = Math.round(data.items.reduce((s, i) => s + i.amountPaid, 0) * 100) / 100
  const totalBalance = Math.round(data.items.reduce((s, i) => s + i.balance, 0) * 100) / 100
  const paidCount = data.items.filter(i => i.status === 'paid').length
  const collectionRate = totalLevy > 0 ? Math.round((totalPaid / totalLevy) * 10000) / 100 : 0

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={commonStyles.page}>
        <ReportHeader
          schemeName={data.schemeName}
          schemeNumber={data.schemeNumber}
          schemeAddress={data.schemeAddress}
          reportTitle="Levy Roll"
          subtitle={`${data.periodName} (${data.periodStart} to ${data.periodEnd})`}
        />

        {/* Summary */}
        <View style={{ flexDirection: 'row', marginBottom: 12, gap: 10 }}>
          <View style={[commonStyles.summaryCard, { flex: 1 }]}>
            <Text style={[commonStyles.cellText, { color: '#666666' }]}>Total Levied</Text>
            <Text style={commonStyles.cellTextBold}>{formatCurrency(totalLevy)}</Text>
          </View>
          <View style={[commonStyles.summaryCard, { flex: 1 }]}>
            <Text style={[commonStyles.cellText, { color: '#666666' }]}>Collected</Text>
            <Text style={[commonStyles.cellTextBold, { color: '#16A34A' }]}>{formatCurrency(totalPaid)}</Text>
          </View>
          <View style={[commonStyles.summaryCard, { flex: 1 }]}>
            <Text style={[commonStyles.cellText, { color: '#666666' }]}>Outstanding</Text>
            <Text style={[commonStyles.cellTextBold, { color: totalBalance > 0 ? '#DC2626' : '#16A34A' }]}>{formatCurrency(totalBalance)}</Text>
          </View>
          <View style={[commonStyles.summaryCard, { flex: 1 }]}>
            <Text style={[commonStyles.cellText, { color: '#666666' }]}>Collection Rate</Text>
            <Text style={commonStyles.cellTextBold}>{collectionRate}%</Text>
            <Text style={[commonStyles.cellText, { color: '#666666' }]}>{paidCount}/{data.items.length} lots paid</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={commonStyles.tableHeader}>
          <Text style={[commonStyles.tableHeaderText, { width: '10%' }]}>Lot</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '18%' }]}>Owner</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '12%', textAlign: 'right' }]}>Admin</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '12%', textAlign: 'right' }]}>Capital</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '12%', textAlign: 'right' }]}>Total</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '12%', textAlign: 'right' }]}>Paid</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '12%', textAlign: 'right' }]}>Balance</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '6%' }]}>Due</Text>
          <Text style={[commonStyles.tableHeaderText, { width: '6%' }]}>Status</Text>
        </View>

        {data.items.map((item, i) => {
          const isOverdue = item.status === 'overdue'
          return (
            <View key={`${item.lotNumber}-${i}`} style={i % 2 === 0 ? commonStyles.tableRow : commonStyles.tableRowAlt}>
              <Text style={[commonStyles.cellText, { width: '10%' }]}>
                {item.unitNumber ? `Unit ${item.unitNumber}` : `Lot ${item.lotNumber}`}
              </Text>
              <Text style={[commonStyles.cellText, { width: '18%' }]}>{item.ownerName || 'Unassigned'}</Text>
              <Text style={[commonStyles.cellTextMono, { width: '12%', textAlign: 'right' }]}>{formatCurrency(item.adminLevy)}</Text>
              <Text style={[commonStyles.cellTextMono, { width: '12%', textAlign: 'right' }]}>{formatCurrency(item.capitalLevy)}</Text>
              <Text style={[commonStyles.cellTextBold, { width: '12%', textAlign: 'right', fontSize: 8 }]}>{formatCurrency(item.totalLevy)}</Text>
              <Text style={[commonStyles.cellTextMono, { width: '12%', textAlign: 'right' }]}>{formatCurrency(item.amountPaid)}</Text>
              <Text style={[
                commonStyles.cellTextBold,
                { width: '12%', textAlign: 'right', fontSize: 8, color: item.balance > 0 ? '#DC2626' : '#16A34A' },
              ]}>
                {formatCurrency(item.balance)}
              </Text>
              <Text style={[commonStyles.cellText, { width: '6%' }]}>{formatDate(item.dueDate)}</Text>
              <Text style={[
                commonStyles.cellText,
                { width: '6%' },
                isOverdue ? { color: '#DC2626', fontFamily: 'Helvetica-Bold' } : {},
              ]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          )
        })}

        {/* Totals */}
        <View style={commonStyles.tableFooter}>
          <Text style={[commonStyles.cellTextBold, { width: '28%' }]}>Totals ({data.items.length} lots)</Text>
          <Text style={[commonStyles.cellTextBold, { width: '12%', textAlign: 'right' }]}>{formatCurrency(totalAdmin)}</Text>
          <Text style={[commonStyles.cellTextBold, { width: '12%', textAlign: 'right' }]}>{formatCurrency(totalCapital)}</Text>
          <Text style={[commonStyles.cellTextBold, { width: '12%', textAlign: 'right' }]}>{formatCurrency(totalLevy)}</Text>
          <Text style={[commonStyles.cellTextBold, { width: '12%', textAlign: 'right' }]}>{formatCurrency(totalPaid)}</Text>
          <Text style={[commonStyles.cellTextBold, { width: '12%', textAlign: 'right' }]}>{formatCurrency(totalBalance)}</Text>
          <Text style={[commonStyles.cellTextBold, { width: '12%' }]} />
        </View>

        <ReportFooter generatedAt={now} />
      </Page>
    </Document>
  )
}
