'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { canAccessFeature } from '@/actions/billing'
import { UpgradePrompt } from '@/components/upgrade-prompt'

interface FeatureGateProps {
  feature: string
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    canAccessFeature(feature).then((result) => {
      setAllowed(result.data ?? false)
    })
  }, [feature])

  // Loading state: render nothing to avoid flash
  if (allowed === null) return null

  if (!allowed) {
    return <>{fallback ?? <UpgradePrompt feature={feature} />}</>
  }

  return <>{children}</>
}
