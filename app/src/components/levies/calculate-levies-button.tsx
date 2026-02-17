'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface CalculateLeviesButtonProps {
  schemeId: string
  periodId: string
}

export function CalculateLeviesButton({ schemeId, periodId }: CalculateLeviesButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCalculate() {
    setLoading(true)
    try {
      const { calculateLeviesForPeriod } = await import('@/actions/levy-items')
      const result = await calculateLeviesForPeriod(periodId)
      if (result.error) {
        toast.error(result.error)
      } else {
        const msg = result.data?.roundingNote
          ? `Levies calculated for ${result.data.itemsCreated} lots. ${result.data.roundingNote}`
          : `Levies calculated for ${result.data?.itemsCreated ?? 0} lots`
        toast.success(msg)
        router.refresh()
      }
    } catch {
      toast.error('Failed to calculate levies. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleCalculate} disabled={loading}>
      <Calculator className="mr-2 size-4" />
      {loading ? 'Calculating...' : 'Calculate Levies'}
    </Button>
  )
}
