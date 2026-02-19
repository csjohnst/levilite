'use client'

import { Progress } from '@/components/ui/progress'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Building2, Home } from 'lucide-react'

interface UsageMeterProps {
  totalLots: number
  totalSchemes: number
  maxLots: number | null
  maxSchemes: number | null
  status: string
}

export function UsageMeter({
  totalLots,
  totalSchemes,
  maxLots,
  maxSchemes,
  status,
}: UsageMeterProps) {
  const isPaid = status === 'active' || status === 'trialing'
  const hasLotLimit = maxLots !== null

  const lotPercent = hasLotLimit
    ? Math.min(100, (totalLots / maxLots) * 100)
    : 0

  const lotColorClass =
    lotPercent > 90
      ? 'text-red-600'
      : lotPercent > 70
        ? 'text-yellow-600'
        : 'text-green-600'

  const lotBarClass =
    lotPercent > 90
      ? '[&_[data-slot=progress-indicator]]:bg-red-500'
      : lotPercent > 70
        ? '[&_[data-slot=progress-indicator]]:bg-yellow-500'
        : ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <CardDescription>Current resource usage across your organisation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Home className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Lots</span>
          </div>
          {hasLotLimit ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className={cn('font-medium', lotColorClass)}>
                  {totalLots}/{maxLots} lots used
                </span>
                {lotPercent >= 90 && (
                  <span className="text-xs text-muted-foreground">
                    {totalLots >= maxLots!
                      ? 'Limit reached'
                      : 'Approaching limit'}
                  </span>
                )}
              </div>
              <Progress value={lotPercent} className={lotBarClass} />
            </div>
          ) : (
            <div className="text-sm">
              <span className="font-medium">{totalLots}</span>{' '}
              <span className="text-muted-foreground">
                lots {isPaid ? '(unlimited)' : 'used'}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Schemes</span>
          </div>
          <div className="text-sm">
            <span className="font-medium">{totalSchemes}</span>{' '}
            <span className="text-muted-foreground">
              scheme{totalSchemes !== 1 ? 's' : ''}
              {maxSchemes !== null
                ? ` of ${maxSchemes} max`
                : isPaid
                  ? ' (unlimited)'
                  : ''}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
