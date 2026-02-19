'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { getTrialInfo } from '@/actions/billing'

export function TrialBanner() {
  const [trial, setTrial] = useState<{
    isTrialing: boolean
    trialDaysRemaining: number
    trialEndDate: string | null
  } | null>(null)

  useEffect(() => {
    getTrialInfo().then((result) => {
      if (result.data) setTrial(result.data)
    })
  }, [])

  if (!trial || !trial.isTrialing) return null

  const progressPercent = Math.max(
    0,
    Math.min(100, ((14 - trial.trialDaysRemaining) / 14) * 100)
  )

  return (
    <Alert className="border-[#0090B7]/30 bg-[#0090B7]/5">
      <AlertTitle className="flex items-center justify-between">
        <span>
          {trial.trialDaysRemaining} day{trial.trialDaysRemaining !== 1 ? 's' : ''} left in your free trial
        </span>
        <Link
          href="/settings/billing/select-plan"
          className="text-sm font-medium text-[#02667F] hover:underline"
        >
          Subscribe Now
        </Link>
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#0090B7]/20">
          <div
            className="h-full rounded-full bg-[#0090B7] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Your trial ends on{' '}
          {trial.trialEndDate
            ? new Date(trial.trialEndDate).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : 'soon'}
          . Subscribe to keep full access to all features.
        </p>
      </AlertDescription>
    </Alert>
  )
}
