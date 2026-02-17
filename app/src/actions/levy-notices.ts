'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import { LevyNoticePDF, type LevyNoticeData } from '@/lib/pdf/levy-notice'
import { getResendClient } from '@/lib/email/resend'
import {
  buildLevyNoticeEmailHtml,
  buildLevyNoticeEmailText,
  type LevyNoticeEmailData,
} from '@/lib/email/levy-notice-template'

// --- Auth helper (matches levy-schedules.ts pattern) ---

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  return { user, supabase }
}

// --- Shared data fetching ---

interface LevyItemWithRelations {
  id: string
  scheme_id: string
  lot_id: string
  levy_period_id: string
  admin_levy_amount: number
  capital_levy_amount: number
  total_levy_amount: number
  due_date: string
  status: string
  balance: number
  notice_generated_at: string | null
  notice_sent_at: string | null
  lot: {
    id: string
    lot_number: string
    unit_number: string | null
    street_address: string | null
    unit_entitlement: number
    scheme_id: string
    lot_ownerships: {
      owner: {
        id: string
        first_name: string
        last_name: string
        title: string | null
        email: string | null
      }
      is_primary_contact: boolean
    }[]
  }
  levy_period: {
    id: string
    period_name: string
    period_start: string
    period_end: string
    due_date: string
    levy_schedule: {
      scheme_id: string
      scheme: {
        id: string
        scheme_name: string
        scheme_number: string
        street_address: string
        suburb: string
        state: string
        postcode: string
        abn: string | null
        total_lot_entitlement: number
        trust_bsb: string | null
        trust_account_number: string | null
        trust_account_name: string | null
        organisation: {
          name: string
          email: string | null
          phone: string | null
        }
      }
    }
  }
}

async function fetchLevyItemWithRelations(supabase: Awaited<ReturnType<typeof createClient>>, levyItemId: string) {
  const { data, error } = await supabase
    .from('levy_items')
    .select(`
      *,
      lot:lots!inner(
        id, lot_number, unit_number, street_address, unit_entitlement, scheme_id,
        lot_ownerships(
          is_primary_contact,
          owner:owners!inner(id, first_name, last_name, title, email)
        )
      ),
      levy_period:levy_periods!inner(
        id, period_name, period_start, period_end, due_date,
        levy_schedule:levy_schedules!inner(
          scheme_id,
          scheme:schemes!inner(
            id, scheme_name, scheme_number, street_address, suburb, state, postcode,
            abn, total_lot_entitlement, trust_bsb, trust_account_number, trust_account_name,
            organisation:organisations!inner(name, email, phone)
          )
        )
      )
    `)
    .eq('id', levyItemId)
    .single()

  if (error) return { error: error.message }
  return { data: data as unknown as LevyItemWithRelations }
}

async function getArrearsForLot(supabase: Awaited<ReturnType<typeof createClient>>, lotId: string, excludePeriodId: string): Promise<number> {
  const { data } = await supabase
    .from('levy_items')
    .select('balance')
    .eq('lot_id', lotId)
    .neq('levy_period_id', excludePeriodId)
    .in('status', ['overdue', 'partial', 'sent'])

  if (!data || data.length === 0) return 0
  return data.reduce((sum: number, item: { balance: number }) => sum + (item.balance > 0 ? item.balance : 0), 0)
}

// --- Build PDF data from a levy item ---

function buildNoticeData(item: LevyItemWithRelations, arrearsAmount: number): LevyNoticeData {
  const scheme = item.levy_period.levy_schedule.scheme
  const org = scheme.organisation
  const lot = item.lot

  // Find primary contact owner (or first owner)
  const primaryOwnership = lot.lot_ownerships.find(o => o.is_primary_contact) || lot.lot_ownerships[0]
  const owner = primaryOwnership?.owner

  const ownerName = owner
    ? [owner.title, owner.first_name, owner.last_name].filter(Boolean).join(' ')
    : 'Owner'

  // Unit entitlement display
  const totalEntitlement = scheme.total_lot_entitlement
  const lotEntitlement = lot.unit_entitlement
  const percentage = totalEntitlement > 0
    ? ((lotEntitlement / totalEntitlement) * 100).toFixed(1)
    : '0'
  const entitlementDisplay = `${lotEntitlement}/${totalEntitlement} (${percentage}%)`

  // Payment reference: LOT{number}-{period_name_sanitized}
  const periodRef = item.levy_period.period_name.replace(/\s+/g, '')
  const paymentReference = `LOT${lot.lot_number}-${periodRef}`

  // Lot address
  const lotAddress = lot.street_address
    || `${lot.unit_number ? lot.unit_number + '/' : ''}${scheme.street_address}, ${scheme.suburb} ${scheme.state} ${scheme.postcode}`

  return {
    strataCompanyName: scheme.scheme_name,
    planNumber: scheme.scheme_number,
    schemeAddress: `${scheme.street_address}, ${scheme.suburb} ${scheme.state} ${scheme.postcode}`,
    abn: scheme.abn,

    ownerName,
    lotNumber: lot.lot_number,
    lotAddress,

    periodName: item.levy_period.period_name,
    periodStart: formatDisplayDate(item.levy_period.period_start),
    periodEnd: formatDisplayDate(item.levy_period.period_end),

    adminLevyAmount: Number(item.admin_levy_amount),
    capitalLevyAmount: Number(item.capital_levy_amount),
    totalLevyAmount: Number(item.total_levy_amount),

    unitEntitlement: entitlementDisplay,
    dueDate: formatDisplayDate(item.due_date),

    bsb: scheme.trust_bsb || null,
    accountNumber: scheme.trust_account_number || null,
    accountName: scheme.trust_account_name || null,
    paymentReference,

    arrearsAmount,

    managerName: org.name,
    managerEmail: org.email,
    managerPhone: org.phone,

    noticeDate: formatDisplayDate(new Date().toISOString().split('T')[0]),
  }
}

// --- PDF Generation Actions ---

export async function generateLevyNotice(levyItemId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Fetch levy item with all relations
  const itemResult = await fetchLevyItemWithRelations(supabase, levyItemId)
  if ('error' in itemResult) return { error: itemResult.error }
  const item = itemResult.data!

  // Get arrears from other periods
  const arrearsAmount = await getArrearsForLot(supabase, item.lot_id, item.levy_period_id)

  // Build notice data and render PDF
  const noticeData = buildNoticeData(item, arrearsAmount)
  const pdfBuffer = await renderToBuffer(
    React.createElement(LevyNoticePDF, { data: noticeData }) as unknown as React.ReactElement<DocumentProps>
  )

  // Upload to Supabase Storage
  const storagePath = `${item.scheme_id}/${item.levy_period_id}/${item.lot_id}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('levy-notices')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) return { error: `PDF upload failed: ${uploadError.message}` }

  // Update notice_generated_at
  const { error: updateError } = await supabase
    .from('levy_items')
    .update({ notice_generated_at: new Date().toISOString() })
    .eq('id', levyItemId)

  if (updateError) return { error: `PDF generated but failed to update record: ${updateError.message}` }

  revalidatePath(`/schemes/${item.scheme_id}`)
  return { data: { storagePath } }
}

export async function generateAllNoticesForPeriod(periodId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Get all levy items for this period
  const { data: levyItems, error: fetchError } = await supabase
    .from('levy_items')
    .select('id, scheme_id')
    .eq('levy_period_id', periodId)

  if (fetchError) return { error: fetchError.message }
  if (!levyItems || levyItems.length === 0) return { error: 'No levy items found for this period' }

  const results: { id: string; success: boolean; error?: string }[] = []

  // Generate PDFs sequentially to avoid overwhelming the server
  for (const levyItem of levyItems) {
    const genResult = await generateLevyNotice(levyItem.id)
    if ('error' in genResult) {
      results.push({ id: levyItem.id, success: false, error: genResult.error as string })
    } else {
      results.push({ id: levyItem.id, success: true })
    }
  }

  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  if (levyItems[0]) {
    revalidatePath(`/schemes/${levyItems[0].scheme_id}`)
  }

  return {
    data: {
      total: levyItems.length,
      succeeded,
      failed,
      results,
    },
  }
}

// --- Email Sending Actions ---

export async function sendLevyNotice(levyItemId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const resend = getResendClient()
  if (!resend) return { error: 'Email service not configured (RESEND_API_KEY not set)' }

  // Fetch levy item with relations
  const itemResult = await fetchLevyItemWithRelations(supabase, levyItemId)
  if ('error' in itemResult) return { error: itemResult.error }
  const item = itemResult.data!

  // Find primary owner with email
  const primaryOwnership = item.lot.lot_ownerships.find(o => o.is_primary_contact) || item.lot.lot_ownerships[0]
  const owner = primaryOwnership?.owner
  if (!owner?.email) {
    return { error: `No email address found for lot ${item.lot.lot_number} owner` }
  }

  // Ensure PDF has been generated
  if (!item.notice_generated_at) {
    // Auto-generate if not yet generated
    const genResult = await generateLevyNotice(levyItemId)
    if ('error' in genResult) return { error: `Failed to generate PDF: ${genResult.error}` }
  }

  // Download the PDF from storage
  const storagePath = `${item.scheme_id}/${item.levy_period_id}/${item.lot_id}.pdf`
  const { data: pdfFile, error: downloadError } = await supabase.storage
    .from('levy-notices')
    .download(storagePath)

  if (downloadError || !pdfFile) {
    return { error: `Failed to download PDF: ${downloadError?.message || 'File not found'}` }
  }

  const pdfArrayBuffer = await pdfFile.arrayBuffer()
  const pdfContent = Buffer.from(pdfArrayBuffer)

  // Build email data
  const scheme = item.levy_period.levy_schedule.scheme
  const org = scheme.organisation
  const ownerName = [owner.title, owner.first_name, owner.last_name].filter(Boolean).join(' ')
  const periodRef = item.levy_period.period_name.replace(/\s+/g, '')

  const emailData: LevyNoticeEmailData = {
    strataCompanyName: scheme.scheme_name,
    ownerName,
    lotNumber: item.lot.lot_number,
    periodDescription: `${item.levy_period.period_name} (${formatDisplayDate(item.levy_period.period_start)} - ${formatDisplayDate(item.levy_period.period_end)})`,
    totalLevy: formatCurrency(Number(item.total_levy_amount)),
    dueDate: formatDisplayDate(item.due_date),
    bsb: scheme.trust_bsb || null,
    accountNumber: scheme.trust_account_number || null,
    accountName: scheme.trust_account_name || null,
    paymentReference: `LOT${item.lot.lot_number}-${periodRef}`,
    managerName: org.name,
    managerEmail: org.email,
    managerPhone: org.phone,
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@levylite.com.au'
  const subject = `Levy Notice - Lot ${item.lot.lot_number} - Due ${formatDisplayDate(item.due_date)}`

  try {
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: owner.email,
      subject,
      html: buildLevyNoticeEmailHtml(emailData),
      text: buildLevyNoticeEmailText(emailData),
      attachments: [
        {
          filename: `Levy-Notice-Lot${item.lot.lot_number}-${periodRef}.pdf`,
          content: pdfContent,
        },
      ],
    })

    if (sendError) return { error: `Email send failed: ${sendError.message}` }

    // Update levy_items: notice_sent_at and status
    const { error: updateError } = await supabase
      .from('levy_items')
      .update({
        notice_sent_at: new Date().toISOString(),
        status: 'sent',
      })
      .eq('id', levyItemId)
      .in('status', ['pending']) // Only update if still pending (don't overwrite paid/partial)

    if (updateError) {
      return { error: `Email sent but failed to update record: ${updateError.message}`, data: { emailId: sendResult?.id } }
    }

    revalidatePath(`/schemes/${item.scheme_id}`)
    return { data: { emailId: sendResult?.id } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error'
    return { error: `Email send failed: ${message}` }
  }
}

export async function sendAllNoticesForPeriod(periodId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Get all levy items for this period that have PDFs generated
  const { data: levyItems, error: fetchError } = await supabase
    .from('levy_items')
    .select('id, scheme_id')
    .eq('levy_period_id', periodId)
    .not('notice_generated_at', 'is', null) // Only send items that have PDFs

  if (fetchError) return { error: fetchError.message }
  if (!levyItems || levyItems.length === 0) {
    return { error: 'No levy items with generated notices found for this period. Generate PDFs first.' }
  }

  const results: { id: string; success: boolean; error?: string }[] = []

  // Send emails sequentially (Resend handles their own rate limits)
  for (const levyItem of levyItems) {
    const sendResult = await sendLevyNotice(levyItem.id)
    if ('error' in sendResult && !sendResult.data) {
      results.push({ id: levyItem.id, success: false, error: sendResult.error as string })
    } else {
      results.push({ id: levyItem.id, success: true })
    }
  }

  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  if (levyItems[0]) {
    revalidatePath(`/schemes/${levyItems[0].scheme_id}`)
  }

  return {
    data: {
      total: levyItems.length,
      succeeded,
      failed,
      results,
    },
  }
}

// --- PDF Download URL ---

export async function getLevyNoticePdfUrl(levyItemId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Get the levy item to build the storage path
  const { data: item, error: fetchError } = await supabase
    .from('levy_items')
    .select('scheme_id, lot_id, levy_period_id, notice_generated_at')
    .eq('id', levyItemId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (!item) return { error: 'Levy item not found' }
  if (!item.notice_generated_at) return { error: 'PDF has not been generated for this levy item' }

  const storagePath = `${item.scheme_id}/${item.levy_period_id}/${item.lot_id}.pdf`

  const { data: signedUrl, error: urlError } = await supabase.storage
    .from('levy-notices')
    .createSignedUrl(storagePath, 60 * 60) // 1 hour expiry

  if (urlError) return { error: `Failed to generate download URL: ${urlError.message}` }
  return { data: { url: signedUrl.signedUrl } }
}

// --- Helpers ---

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
