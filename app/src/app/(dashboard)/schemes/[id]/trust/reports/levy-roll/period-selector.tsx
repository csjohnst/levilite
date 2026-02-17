'use client'

import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LevyRollPeriodSelectorProps {
  schemeId: string
  periods: { id: string; period_name: string; period_start: string; period_end: string; status: string }[]
  selectedPeriodId: string | null
}

export function LevyRollPeriodSelector({
  schemeId,
  periods,
  selectedPeriodId,
}: LevyRollPeriodSelectorProps) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Period:</span>
      <Select
        value={selectedPeriodId ?? undefined}
        onValueChange={(val) => {
          router.push(`/schemes/${schemeId}/trust/reports/levy-roll?period=${val}`)
        }}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {periods.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.period_name} ({p.period_start} to {p.period_end})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
