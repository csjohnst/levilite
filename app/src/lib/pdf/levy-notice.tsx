import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// --- Data types for the levy notice PDF ---

export interface LevyNoticeData {
  // Strata company / scheme
  strataCompanyName: string
  planNumber: string
  schemeAddress: string
  abn: string | null

  // Owner
  ownerName: string
  lotNumber: string
  lotAddress: string | null

  // Levy period
  periodName: string
  periodStart: string // formatted date string e.g. "1 July 2026"
  periodEnd: string

  // Levy amounts
  adminLevyAmount: number
  capitalLevyAmount: number
  totalLevyAmount: number

  // Unit entitlement
  unitEntitlement: string // e.g. "1/10 (10%)"

  // Due date
  dueDate: string // formatted date string e.g. "31 July 2026"

  // Payment instructions
  bsb: string | null
  accountNumber: string | null
  accountName: string | null
  paymentReference: string

  // Arrears
  arrearsAmount: number

  // Manager contact
  managerName: string
  managerEmail: string | null
  managerPhone: string | null

  // Notice date
  noticeDate: string
}

// --- Styles ---

const BRAND_PRIMARY = '#02667F'
const BRAND_ACCENT = '#0090B7'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
    color: '#333333',
  },

  // Header / Letterhead
  header: {
    borderBottom: `2px solid ${BRAND_PRIMARY}`,
    paddingBottom: 12,
    marginBottom: 16,
  },
  companyName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_PRIMARY,
    marginBottom: 2,
  },
  headerDetail: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 1,
  },

  // Notice title + dates
  titleSection: {
    backgroundColor: BRAND_PRIMARY,
    color: '#FFFFFF',
    padding: 12,
    marginBottom: 16,
  },
  titleText: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  titleDate: {
    fontSize: 10,
    marginBottom: 2,
  },

  // Owner section
  ownerSection: {
    borderBottom: '1px solid #CCCCCC',
    paddingBottom: 12,
    marginBottom: 16,
  },
  ownerLabel: {
    fontSize: 8,
    color: '#999999',
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  ownerName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  ownerDetail: {
    fontSize: 10,
    marginBottom: 1,
  },

  // Levy details table
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_PRIMARY,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
  },
  levySection: {
    marginBottom: 16,
  },
  levyRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  levyRowAlt: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F5F5F5',
  },
  levyLabel: {
    fontSize: 10,
  },
  levyAmount: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  levySeparator: {
    borderBottom: `1px solid ${BRAND_PRIMARY}`,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  levyTotalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: BRAND_PRIMARY,
  },
  levyTotalLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  levyTotalAmount: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  entitlementNote: {
    fontSize: 9,
    color: '#666666',
    paddingHorizontal: 8,
    marginTop: 4,
  },

  // Payment instructions
  paymentSection: {
    backgroundColor: '#F8F9FA',
    border: '1px solid #DEE2E6',
    padding: 12,
    marginBottom: 16,
  },
  paymentRow: {
    flexDirection: 'row' as const,
    marginBottom: 3,
  },
  paymentLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 120,
  },
  paymentValue: {
    fontSize: 10,
  },
  paymentNote: {
    fontSize: 9,
    color: BRAND_ACCENT,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
  },

  // Arrears
  arrearsSection: {
    backgroundColor: '#FFF3CD',
    border: '1px solid #FFECB5',
    padding: 12,
    marginBottom: 16,
  },
  arrearsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  arrearsLabel: {
    fontSize: 10,
  },
  arrearsAmount: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#856404',
  },
  grandTotalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    borderTop: '1px solid #856404',
    paddingTop: 6,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#856404',
  },
  grandTotalAmount: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#856404',
  },

  // Legal notes / footer
  notesSection: {
    borderTop: '1px solid #CCCCCC',
    paddingTop: 12,
    marginBottom: 12,
  },
  notesText: {
    fontSize: 8,
    color: '#666666',
    lineHeight: 1.5,
    marginBottom: 4,
  },

  // Contact
  contactSection: {
    marginTop: 8,
  },
  contactLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#666666',
    marginBottom: 2,
  },
  contactDetail: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 1,
  },
})

// --- Currency formatter ---

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// --- PDF Component ---

export function LevyNoticePDF({ data }: { data: LevyNoticeData }) {
  const grandTotal = data.totalLevyAmount + data.arrearsAmount

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Letterhead */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.strataCompanyName}</Text>
          <Text style={styles.headerDetail}>{data.planNumber}</Text>
          <Text style={styles.headerDetail}>{data.schemeAddress}</Text>
          {data.abn && <Text style={styles.headerDetail}>ABN: {data.abn}</Text>}
        </View>

        {/* Notice Title */}
        <View style={styles.titleSection}>
          <Text style={styles.titleText}>LEVY NOTICE</Text>
          <Text style={styles.titleDate}>Notice Date: {data.noticeDate}</Text>
          <Text style={styles.titleDate}>Due Date: {data.dueDate}</Text>
        </View>

        {/* Owner Details */}
        <View style={styles.ownerSection}>
          <Text style={styles.ownerLabel}>Issued To</Text>
          <Text style={styles.ownerName}>{data.ownerName}</Text>
          <Text style={styles.ownerDetail}>Lot {data.lotNumber} / {data.planNumber}</Text>
          {data.lotAddress && <Text style={styles.ownerDetail}>{data.lotAddress}</Text>}
        </View>

        {/* Levy Details */}
        <View style={styles.levySection}>
          <Text style={styles.sectionTitle}>Levy Details</Text>
          <Text style={styles.entitlementNote}>
            Period: {data.periodName} ({data.periodStart} - {data.periodEnd})
          </Text>
          <View style={{ marginTop: 8 }}>
            <View style={styles.levyRow}>
              <Text style={styles.levyLabel}>Admin Fund Levy</Text>
              <Text style={styles.levyAmount}>{formatCurrency(data.adminLevyAmount)}</Text>
            </View>
            <View style={styles.levyRowAlt}>
              <Text style={styles.levyLabel}>Capital Works Fund Levy</Text>
              <Text style={styles.levyAmount}>{formatCurrency(data.capitalLevyAmount)}</Text>
            </View>
            <View style={styles.levySeparator} />
            <View style={styles.levyTotalRow}>
              <Text style={styles.levyTotalLabel}>Total Due</Text>
              <Text style={styles.levyTotalAmount}>{formatCurrency(data.totalLevyAmount)}</Text>
            </View>
          </View>
          <Text style={styles.entitlementNote}>Unit Entitlement: {data.unitEntitlement}</Text>
        </View>

        {/* Payment Instructions */}
        {(data.bsb || data.accountNumber) && (
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment Instructions</Text>
            {data.bsb && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>BSB:</Text>
                <Text style={styles.paymentValue}>{data.bsb}</Text>
              </View>
            )}
            {data.accountNumber && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Account Number:</Text>
                <Text style={styles.paymentValue}>{data.accountNumber}</Text>
              </View>
            )}
            {data.accountName && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Account Name:</Text>
                <Text style={styles.paymentValue}>{data.accountName}</Text>
              </View>
            )}
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Reference:</Text>
              <Text style={styles.paymentValue}>{data.paymentReference}</Text>
            </View>
            <Text style={styles.paymentNote}>Please pay by {data.dueDate}</Text>
          </View>
        )}

        {/* Arrears (only if > 0) */}
        {data.arrearsAmount > 0 && (
          <View style={styles.arrearsSection}>
            <Text style={styles.sectionTitle}>Arrears</Text>
            <View style={styles.arrearsRow}>
              <Text style={styles.arrearsLabel}>Previous Balance Owing</Text>
              <Text style={styles.arrearsAmount}>{formatCurrency(data.arrearsAmount)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL AMOUNT DUE</Text>
              <Text style={styles.grandTotalAmount}>{formatCurrency(grandTotal)}</Text>
            </View>
          </View>
        )}

        {/* Legal Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesText}>
            Levies are payable under s35 of the Strata Titles Act 1985 (WA). Failure to pay by the
            due date may result in interest charges and recovery action as per s77 of the Act.
          </Text>

          {/* Manager Contact */}
          <View style={styles.contactSection}>
            <Text style={styles.contactLabel}>Questions? Contact:</Text>
            <Text style={styles.contactDetail}>{data.managerName}</Text>
            {data.managerEmail && <Text style={styles.contactDetail}>Email: {data.managerEmail}</Text>}
            {data.managerPhone && <Text style={styles.contactDetail}>Phone: {data.managerPhone}</Text>}
          </View>
        </View>
      </Page>
    </Document>
  )
}
