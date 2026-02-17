'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { generateReportPDF } from '@/actions/reports'

interface ExportPDFButtonProps {
  schemeId: string
  reportType: 'trial-balance' | 'fund-summary' | 'income-statement' | 'budget-vs-actual' | 'levy-roll'
  params?: {
    asAtDate?: string
    startDate?: string
    endDate?: string
    financialYearId?: string
    fundType?: 'admin' | 'capital_works'
    periodId?: string
    save?: boolean
  }
}

export function ExportPDFButton({ schemeId, reportType, params }: ExportPDFButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const result = await generateReportPDF(schemeId, reportType, params)

      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }

      if (!result.data) {
        toast.error('Failed to generate PDF')
        return
      }

      if (result.data.saved && 'url' in result.data) {
        // Saved to storage - open signed URL
        window.open(result.data.url, '_blank')
        toast.success('Report exported as PDF')
      } else if ('base64' in result.data && result.data.base64) {
        // Direct download from base64
        const byteCharacters = atob(result.data.base64 as string)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'application/pdf' })

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = result.data.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success('Report exported as PDF')
      }
    } catch {
      toast.error('Failed to export PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Download className="mr-2 size-4" />
      )}
      Export PDF
    </Button>
  )
}
