import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { commonStyles, formatCurrency, ReportHeader, ReportFooter } from './report-common'
import type { IncomeStatement } from '@/actions/reports'

interface IncomeStatementReportData {
  schemeName: string
  schemeNumber: string
  schemeAddress: string
  startDate: string
  endDate: string
  statement: IncomeStatement
}

function FundSection({ title, income, expenses, totalIncome, totalExpenses, net }: {
  title: string
  income: { code: string; name: string; total: number }[]
  expenses: { code: string; name: string; total: number }[]
  totalIncome: number
  totalExpenses: number
  net: number
}) {
  if (income.length === 0 && expenses.length === 0) return null

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={commonStyles.sectionTitle}>{title}</Text>

      {/* Table header */}
      <View style={commonStyles.tableHeader}>
        <Text style={[commonStyles.tableHeaderText, { width: '15%' }]}>Code</Text>
        <Text style={[commonStyles.tableHeaderText, { width: '60%' }]}>Category</Text>
        <Text style={[commonStyles.tableHeaderText, { width: '25%', textAlign: 'right' }]}>Amount</Text>
      </View>

      {/* Income */}
      {income.length > 0 && (
        <>
          <View style={{ flexDirection: 'row', backgroundColor: '#DCFCE7', paddingVertical: 2, paddingHorizontal: 6 }}>
            <Text style={[commonStyles.cellTextBold, { color: '#166534' }]}>Income</Text>
          </View>
          {income.map((item, i) => (
            <View key={item.code} style={i % 2 === 0 ? commonStyles.tableRow : commonStyles.tableRowAlt}>
              <Text style={[commonStyles.cellTextMono, { width: '15%' }]}>{item.code}</Text>
              <Text style={[commonStyles.cellText, { width: '60%' }]}>{item.name}</Text>
              <Text style={[commonStyles.cellTextMono, { width: '25%', textAlign: 'right', color: '#16A34A' }]}>
                {formatCurrency(item.total)}
              </Text>
            </View>
          ))}
          <View style={[commonStyles.tableRow, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[commonStyles.cellTextBold, { width: '75%', textAlign: 'right' }]}>Total Income</Text>
            <Text style={[commonStyles.cellTextBold, { width: '25%', textAlign: 'right', color: '#16A34A' }]}>
              {formatCurrency(totalIncome)}
            </Text>
          </View>
        </>
      )}

      {/* Expenses */}
      {expenses.length > 0 && (
        <>
          <View style={{ flexDirection: 'row', backgroundColor: '#FEF2F2', paddingVertical: 2, paddingHorizontal: 6 }}>
            <Text style={[commonStyles.cellTextBold, { color: '#991B1B' }]}>Expenses</Text>
          </View>
          {expenses.map((item, i) => (
            <View key={item.code} style={i % 2 === 0 ? commonStyles.tableRow : commonStyles.tableRowAlt}>
              <Text style={[commonStyles.cellTextMono, { width: '15%' }]}>{item.code}</Text>
              <Text style={[commonStyles.cellText, { width: '60%' }]}>{item.name}</Text>
              <Text style={[commonStyles.cellTextMono, { width: '25%', textAlign: 'right', color: '#DC2626' }]}>
                {formatCurrency(item.total)}
              </Text>
            </View>
          ))}
          <View style={[commonStyles.tableRow, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[commonStyles.cellTextBold, { width: '75%', textAlign: 'right' }]}>Total Expenses</Text>
            <Text style={[commonStyles.cellTextBold, { width: '25%', textAlign: 'right', color: '#DC2626' }]}>
              {formatCurrency(totalExpenses)}
            </Text>
          </View>
        </>
      )}

      {/* Net */}
      <View style={commonStyles.tableFooter}>
        <Text style={[commonStyles.cellTextBold, { width: '75%', textAlign: 'right' }]}>
          Net {net >= 0 ? 'Surplus' : 'Deficit'}
        </Text>
        <Text style={[commonStyles.cellTextBold, { width: '25%', textAlign: 'right', color: net >= 0 ? '#16A34A' : '#DC2626' }]}>
          {net < 0 ? `(${formatCurrency(net)})` : formatCurrency(net)}
        </Text>
      </View>
    </View>
  )
}

export function IncomeStatementReportPDF({ data }: { data: IncomeStatementReportData }) {
  const now = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Document>
      <Page size="A4" style={commonStyles.page}>
        <ReportHeader
          schemeName={data.schemeName}
          schemeNumber={data.schemeNumber}
          schemeAddress={data.schemeAddress}
          reportTitle="Income Statement"
          subtitle={`${data.startDate} to ${data.endDate}`}
        />

        <FundSection
          title="Admin Fund"
          income={data.statement.admin.income}
          expenses={data.statement.admin.expenses}
          totalIncome={data.statement.admin.total_income}
          totalExpenses={data.statement.admin.total_expenses}
          net={data.statement.admin.net}
        />

        <FundSection
          title="Capital Works Fund"
          income={data.statement.capital_works.income}
          expenses={data.statement.capital_works.expenses}
          totalIncome={data.statement.capital_works.total_income}
          totalExpenses={data.statement.capital_works.total_expenses}
          net={data.statement.capital_works.net}
        />

        {/* Combined */}
        <View style={[commonStyles.summaryCard, { backgroundColor: '#F0F7FA' }]}>
          <Text style={commonStyles.sectionTitle}>Combined Summary</Text>
          <View style={commonStyles.summaryRow}>
            <Text style={commonStyles.summaryLabel}>Total Income</Text>
            <Text style={[commonStyles.summaryValue, { color: '#16A34A' }]}>{formatCurrency(data.statement.combined.total_income)}</Text>
          </View>
          <View style={commonStyles.summaryRow}>
            <Text style={commonStyles.summaryLabel}>Total Expenses</Text>
            <Text style={[commonStyles.summaryValue, { color: '#DC2626' }]}>{formatCurrency(data.statement.combined.total_expenses)}</Text>
          </View>
          <View style={{ borderTop: '1px solid #333333', marginTop: 4, paddingTop: 4 }}>
            <View style={commonStyles.summaryRow}>
              <Text style={[commonStyles.summaryLabel, { fontFamily: 'Helvetica-Bold' }]}>
                Net {data.statement.combined.net >= 0 ? 'Surplus' : 'Deficit'}
              </Text>
              <Text style={[commonStyles.summaryValue, { color: data.statement.combined.net >= 0 ? '#16A34A' : '#DC2626' }]}>
                {data.statement.combined.net < 0 ? `(${formatCurrency(data.statement.combined.net)})` : formatCurrency(data.statement.combined.net)}
              </Text>
            </View>
          </View>
        </View>

        <ReportFooter generatedAt={now} />
      </Page>
    </Document>
  )
}
