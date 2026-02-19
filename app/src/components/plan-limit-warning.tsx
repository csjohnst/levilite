'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { checkPlanLimits } from '@/actions/billing'
import { cn } from '@/lib/utils'

export function PlanLimitWarning() {
  const [limits, setLimits] = useState<{
    currentLots: number
    maxLots: number | null
    withinLimits: boolean
  } | null>(null)

  useEffect(() => {
    checkPlanLimits().then((result) => {
      if (result.data) {
        setLimits({
          currentLots: result.data.currentLots,
          maxLots: result.data.maxLots,
          withinLimits: result.data.withinLimits,
        })
      }
    })
  }, [])

  // Don't show for unlimited plans or when data hasn't loaded
  if (!limits || limits.maxLots === null) return null

  const percent = (limits.currentLots / limits.maxLots) * 100
  const colorClass =
    percent > 90
      ? 'text-red-600'
      : percent > 70
        ? 'text-yellow-600'
        : 'text-green-600'
  const barClass =
    percent > 90
      ? '[&_[data-slot=progress-indicator]]:bg-red-500'
      : percent > 70
        ? '[&_[data-slot=progress-indicator]]:bg-yellow-500'
        : ''

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={cn('font-medium', colorClass)}>
          {limits.currentLots}/{limits.maxLots} lots used
        </span>
        {!limits.withinLimits && (
          <Link
            href="/settings/billing/select-plan"
            className="text-sm font-medium text-[#02667F] hover:underline"
          >
            Upgrade
          </Link>
        )}
      </div>
      <Progress value={Math.min(100, percent)} className={barClass} />
      {percent >= 90 && (
        <p className="text-xs text-muted-foreground">
          {limits.withinLimits
            ? `You're approaching the ${limits.maxLots}-lot limit on your current plan.`
            : `You've reached the ${limits.maxLots}-lot limit. Upgrade to add more lots.`}
        </p>
      )}
    </div>
  )
}
