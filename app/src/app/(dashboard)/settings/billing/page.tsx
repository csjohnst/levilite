import { redirect } from 'next/navigation'
import {
  getSubscription,
  getUsageStats,
  getBillingHistory,
  getTrialInfo,
  checkPlanLimits,
} from '@/actions/billing'
import { calculateGraduatedPrice } from '@/lib/subscription'
import { SubscriptionStatusCard } from '@/components/billing/subscription-status-card'
import { BillingHistoryTable } from '@/components/billing/billing-history-table'
import { UsageMeter } from '@/components/billing/usage-meter'

export default async function BillingPage() {
  const [subscriptionResult, usageResult, historyResult, trialResult, limitsResult] =
    await Promise.all([
      getSubscription(),
      getUsageStats(),
      getBillingHistory(),
      getTrialInfo(),
      checkPlanLimits(),
    ])

  if (subscriptionResult.error === 'Unauthorized') redirect('/login')

  const subscription = subscriptionResult.data
  const usage = usageResult.data
  const invoices = historyResult.data
  const trial = trialResult.data
  const limits = limitsResult.data

  if (!subscription || !usage || !trial) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
          <p className="text-muted-foreground">
            Unable to load billing information. Please try again.
          </p>
        </div>
      </div>
    )
  }

  const pricing = calculateGraduatedPrice(
    subscription.billed_lots_count ?? usage.totalLots,
    (subscription.billing_interval as 'monthly' | 'annual') ?? 'monthly'
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          Manage your subscription and billing
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SubscriptionStatusCard
            status={subscription.status as Parameters<typeof SubscriptionStatusCard>[0]['status']}
            planName={subscription.plan_name}
            billingInterval={subscription.billing_interval}
            billedLotsCount={subscription.billed_lots_count}
            currentPeriodEnd={subscription.current_period_end}
            trialEndDate={subscription.trial_end_date}
            trialDaysRemaining={trial.trialDaysRemaining}
            cancelAtPeriodEnd={subscription.cancel_at_period_end ?? false}
            canceledAt={subscription.canceled_at}
            dataRetentionExpiresAt={subscription.data_retention_expires_at}
            hasStripeCustomer={!!subscription.stripe_customer_id}
            monthlySubtotal={pricing.monthlySubtotal}
          />
        </div>

        <div>
          <UsageMeter
            totalLots={usage.totalLots}
            totalSchemes={usage.totalSchemes}
            maxLots={limits?.maxLots ?? null}
            maxSchemes={limits?.maxSchemes ?? null}
            status={subscription.status}
          />
        </div>
      </div>

      <BillingHistoryTable invoices={(invoices ?? []) as Parameters<typeof BillingHistoryTable>[0]['invoices']} />
    </div>
  )
}
