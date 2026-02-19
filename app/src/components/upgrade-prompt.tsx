'use client'

import Link from 'next/link'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getFeatureLabel } from '@/lib/subscription'

interface UpgradePromptProps {
  feature: string
  description?: string
}

export function UpgradePrompt({ feature, description }: UpgradePromptProps) {
  const label = getFeatureLabel(feature)

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Upgrade Required</CardTitle>
        <CardDescription>
          {description ?? `${label} requires a paid subscription.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Upgrade your plan to unlock {label} and other premium features.
          Start with a free trial to explore everything LevyLite has to offer.
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild>
          <Link href="/settings/billing/select-plan">Upgrade Now</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
