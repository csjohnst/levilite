'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import {
  calculateGraduatedPrice,
  formatCurrency,
  type BillingInterval,
} from '@/lib/subscription'

interface PricingCalculatorProps {
  initialLots?: number
  initialInterval?: BillingInterval
  onSelect?: (interval: BillingInterval) => void
  showSelectButtons?: boolean
  loading?: boolean
}

export function PricingCalculator({
  initialLots = 50,
  initialInterval = 'monthly',
  onSelect,
  showSelectButtons = false,
  loading = false,
}: PricingCalculatorProps) {
  const [lots, setLots] = useState(initialLots)
  const [interval, setInterval] = useState<BillingInterval>(initialInterval)

  const pricing = calculateGraduatedPrice(lots, interval)
  const monthlyPricing = calculateGraduatedPrice(lots, 'monthly')
  const annualPricing = calculateGraduatedPrice(lots, 'annual')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Calculator</CardTitle>
        <CardDescription>
          Enter your lot count to see graduated pricing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="lot-count">Number of Lots</Label>
          <Input
            id="lot-count"
            type="number"
            min={1}
            max={10000}
            value={lots}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val) && val >= 1) setLots(val)
            }}
            className="max-w-[200px]"
          />
          <input
            type="range"
            min={1}
            max={2000}
            value={Math.min(lots, 2000)}
            onChange={(e) => setLots(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </div>

        <Tabs
          value={interval}
          onValueChange={(v) => setInterval(v as BillingInterval)}
        >
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">Annual (Save 2 months)</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Lots</TableHead>
                <TableHead className="text-right">Rate/lot/mo</TableHead>
                <TableHead className="text-right">Tier Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricing.breakdown.map((tier) => (
                <TableRow key={tier.tier}>
                  <TableCell className="font-medium">{tier.label}</TableCell>
                  <TableCell className="text-right">
                    {tier.lotsInTier}
                  </TableCell>
                  <TableCell className="text-right">
                    {tier.ratePerLot === 0
                      ? 'FREE'
                      : formatCurrency(tier.ratePerLot)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(tier.tierTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-medium">
                  {interval === 'annual'
                    ? 'Annual Subtotal (ex GST)'
                    : 'Monthly Subtotal (ex GST)'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(pricing.subtotalExGst)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3}>GST (10%)</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(pricing.gst)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-lg font-bold">
                  Total (inc GST)
                </TableCell>
                <TableCell className="text-right text-lg font-bold">
                  {formatCurrency(pricing.totalIncGst)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {interval === 'annual' && pricing.annualSavings > 0 && (
          <p className="text-sm font-medium text-green-600">
            You save {formatCurrency(pricing.annualSavings)} per year with
            annual billing (2 months free)
          </p>
        )}

        {lots <= 10 && (
          <p className="text-sm text-muted-foreground">
            Up to 10 lots are included free on the Free plan. You only pay when
            you exceed 10 lots or need premium features.
          </p>
        )}

        {showSelectButtons && lots > 10 && (
          <>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => onSelect?.('monthly')}
                disabled={loading}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted p-6 transition-colors hover:border-[#02667F] hover:bg-[#02667F]/5 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  Monthly
                </span>
                <span className="text-2xl font-bold">
                  {formatCurrency(monthlyPricing.totalIncGst)}
                </span>
                <span className="text-xs text-muted-foreground">
                  per month inc GST
                </span>
              </button>
              <button
                onClick={() => onSelect?.('annual')}
                disabled={loading}
                className="relative flex flex-col items-center gap-2 rounded-lg border-2 border-[#0090B7] bg-[#0090B7]/5 p-6 transition-colors hover:bg-[#0090B7]/10 disabled:opacity-50"
              >
                <span className="absolute -top-3 rounded-full bg-[#0090B7] px-3 py-0.5 text-xs font-medium text-white">
                  Best Value
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  Annual
                </span>
                <span className="text-2xl font-bold">
                  {formatCurrency(annualPricing.totalIncGst)}
                </span>
                <span className="text-xs text-muted-foreground">
                  per year inc GST (save{' '}
                  {formatCurrency(annualPricing.annualSavings)})
                </span>
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
