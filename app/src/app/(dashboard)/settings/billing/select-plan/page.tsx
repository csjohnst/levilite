'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { PricingCalculator } from '@/components/billing/pricing-calculator'
import { getUsageStats } from '@/actions/billing'
import type { BillingInterval } from '@/lib/subscription'

const FREE_FEATURES = [
  { name: 'Scheme register', included: true },
  { name: 'Levy management', included: true },
  { name: 'Owner management', included: true },
  { name: 'Document storage', included: true },
  { name: 'Meetings & minutes', included: true },
  { name: 'Maintenance tracking', included: true },
  { name: 'Up to 10 lots', included: true },
  { name: 'Trust accounting', included: false },
  { name: 'Bulk levy notices', included: false },
  { name: 'Financial reporting', included: false },
  { name: 'CSV import/export', included: false },
  { name: 'Unlimited lots', included: false },
]

const PAID_FEATURES = [
  { name: 'Everything in Free', included: true },
  { name: 'Unlimited lots', included: true },
  { name: 'Unlimited schemes', included: true },
  { name: 'Trust accounting', included: true },
  { name: 'Bulk levy notices (PDF + email)', included: true },
  { name: 'Financial reporting', included: true },
  { name: 'CSV import/export', included: true },
  { name: 'Bank reconciliation', included: true },
  { name: 'Budget management', included: true },
]

export default function SelectPlanPage() {
  const [loading, setLoading] = useState(false)
  const [lotCount, setLotCount] = useState(50)

  useEffect(() => {
    getUsageStats().then((result) => {
      if (result.data && result.data.totalLots > 0) {
        setLotCount(result.data.totalLots)
      }
    })
  }, [])

  async function handleSelectPlan(interval: BillingInterval) {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingInterval: interval }),
      })
      const data = await res.json()
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl
      } else {
        console.error('Checkout error:', data.error)
        setLoading(false)
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings/billing">
            <ArrowLeft className="mr-2 size-4" />
            Back to Billing
          </Link>
        </Button>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Choose Your Plan</h2>
        <p className="text-muted-foreground">
          Select the plan that works for your strata management needs
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-[#0090B7]/30 bg-[#0090B7]/5 p-4">
          <Loader2 className="size-4 animate-spin text-[#02667F]" />
          <span className="text-sm">Redirecting to checkout...</span>
        </div>
      )}

      {/* Feature comparison */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>
              For small schemes with up to 10 lots
            </CardDescription>
            <p className="text-3xl font-bold mt-2">$0</p>
            <p className="text-sm text-muted-foreground">forever</p>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <ul className="space-y-2">
              {FREE_FEATURES.map((feature) => (
                <li key={feature.name} className="flex items-center gap-2 text-sm">
                  {feature.included ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <X className="size-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      feature.included ? '' : 'text-muted-foreground'
                    }
                  >
                    {feature.name}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-[#02667F]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Professional
              <span className="rounded-full bg-[#0090B7] px-2 py-0.5 text-xs text-white">
                Most Popular
              </span>
            </CardTitle>
            <CardDescription>
              For growing strata management businesses
            </CardDescription>
            <p className="text-3xl font-bold mt-2">From $2.50</p>
            <p className="text-sm text-muted-foreground">
              per lot/month ex GST (first 10 free)
            </p>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <ul className="space-y-2">
              {PAID_FEATURES.map((feature) => (
                <li key={feature.name} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-green-600" />
                  <span>{feature.name}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Pricing calculator */}
      <PricingCalculator
        initialLots={lotCount}
        showSelectButtons
        onSelect={handleSelectPlan}
        loading={loading}
      />
    </div>
  )
}
