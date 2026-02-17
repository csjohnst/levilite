const BRAND_PRIMARY = '#02667F'
const BRAND_ACCENT = '#0090B7'

export interface LevyNoticeEmailData {
  strataCompanyName: string
  ownerName: string
  lotNumber: string
  periodDescription: string
  totalLevy: string // pre-formatted e.g. "$1,800.00"
  dueDate: string
  bsb: string | null
  accountNumber: string | null
  accountName: string | null
  paymentReference: string
  managerName: string
  managerEmail: string | null
  managerPhone: string | null
}

export function buildLevyNoticeEmailHtml(data: LevyNoticeEmailData): string {
  const paymentDetailsHtml =
    data.bsb || data.accountNumber
      ? `
    <p><strong>Payment Details:</strong><br>
    ${data.bsb ? `BSB: ${data.bsb}<br>` : ''}
    ${data.accountNumber ? `Account: ${data.accountNumber}<br>` : ''}
    ${data.accountName ? `Account Name: ${data.accountName}<br>` : ''}
    Reference: <strong>${data.paymentReference}</strong></p>
    `
      : ''

  const contactParts: string[] = []
  if (data.managerEmail) contactParts.push(data.managerEmail)
  if (data.managerPhone) contactParts.push(data.managerPhone)
  const contactLine = contactParts.length > 0 ? ` at ${contactParts.join(' or ')}` : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: ${BRAND_PRIMARY}; color: white; padding: 24px 20px; }
    .header h2 { margin: 0 0 4px 0; font-size: 20px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 24px 20px; }
    .content p { line-height: 1.6; margin: 0 0 16px 0; }
    .highlight { background: #f8f9fa; border-left: 3px solid ${BRAND_ACCENT}; padding: 12px 16px; margin: 16px 0; }
    .footer { background: #f5f5f5; padding: 16px 20px; font-size: 12px; color: #666; border-top: 1px solid #ddd; }
    .footer p { margin: 0 0 4px 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${escapeHtml(data.strataCompanyName)}</h2>
      <p>Levy Notice - Lot ${escapeHtml(data.lotNumber)}</p>
    </div>
    <div class="content">
      <p>Dear ${escapeHtml(data.ownerName)},</p>

      <p>Your levy notice for <strong>Lot ${escapeHtml(data.lotNumber)}</strong> is now due.</p>

      <div class="highlight">
        <p style="margin: 0 0 8px 0;"><strong>Period:</strong> ${escapeHtml(data.periodDescription)}<br>
        <strong>Amount Due:</strong> ${escapeHtml(data.totalLevy)}<br>
        <strong>Due Date:</strong> ${escapeHtml(data.dueDate)}</p>
      </div>

      ${paymentDetailsHtml}

      <p>Please find attached your detailed levy notice (PDF).</p>

      <p>If you have any questions, please contact ${escapeHtml(data.managerName)}${contactLine}.</p>

      <p>Thank you,<br>
      ${escapeHtml(data.managerName)}<br>
      ${escapeHtml(data.strataCompanyName)}</p>
    </div>
    <div class="footer">
      <p>This levy is payable under the Strata Titles Act 1985 (WA). Failure to pay by the due date may result in interest charges and recovery action.</p>
    </div>
  </div>
</body>
</html>`
}

export function buildLevyNoticeEmailText(data: LevyNoticeEmailData): string {
  const paymentLines: string[] = []
  if (data.bsb) paymentLines.push(`BSB: ${data.bsb}`)
  if (data.accountNumber) paymentLines.push(`Account: ${data.accountNumber}`)
  if (data.accountName) paymentLines.push(`Account Name: ${data.accountName}`)
  paymentLines.push(`Reference: ${data.paymentReference}`)

  const contactParts: string[] = []
  if (data.managerEmail) contactParts.push(data.managerEmail)
  if (data.managerPhone) contactParts.push(data.managerPhone)
  const contactLine = contactParts.length > 0 ? ` at ${contactParts.join(' or ')}` : ''

  return `${data.strataCompanyName}
Levy Notice - Lot ${data.lotNumber}

Dear ${data.ownerName},

Your levy notice for Lot ${data.lotNumber} is now due.

Period: ${data.periodDescription}
Amount Due: ${data.totalLevy}
Due Date: ${data.dueDate}

Payment Details:
${paymentLines.join('\n')}

Please find attached your detailed levy notice (PDF).

If you have any questions, please contact ${data.managerName}${contactLine}.

Thank you,
${data.managerName}
${data.strataCompanyName}

---
This levy is payable under the Strata Titles Act 1985 (WA). Failure to pay by the due date may result in interest charges and recovery action.`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
