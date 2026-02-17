'use client'

import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BudgetVsActualSelectorsProps {
  schemeId: string
  financialYears: { id: string; year_label: string; is_current: boolean }[]
  selectedFyId: string | null
  selectedFund: 'admin' | 'capital_works'
}

export function BudgetVsActualSelectors({
  schemeId,
  financialYears,
  selectedFyId,
  selectedFund,
}: BudgetVsActualSelectorsProps) {
  const router = useRouter()

  function navigate(fyId: string | null, fund: string) {
    const params = new URLSearchParams()
    if (fyId) params.set('fy', fyId)
    params.set('fund', fund)
    router.push(`/schemes/${schemeId}/trust/reports/budget-vs-actual?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Financial Year:</span>
        <Select
          value={selectedFyId ?? undefined}
          onValueChange={(val) => navigate(val, selectedFund)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {financialYears.map(fy => (
              <SelectItem key={fy.id} value={fy.id}>
                {fy.year_label}{fy.is_current ? ' (current)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Fund:</span>
        <Select
          value={selectedFund}
          onValueChange={(val) => navigate(selectedFyId, val)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin Fund</SelectItem>
            <SelectItem value="capital_works">Capital Works Fund</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
