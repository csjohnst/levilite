import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, type SubscriptionStatus } from '@/lib/subscription'
import { CreditCard, ExternalLink, AlertTriangle, Clock } from 'lucide-react'
import { ManageBillingButton } from '@/components/billing/manage-billing-button'

interface SubscriptionStatusCardProps {
  status: SubscriptionStatus
  planName: string
  billingInterval: string | null
  billedLotsCount: number | null
  currentPeriodEnd: string | null
  trialEndDate: string | null
  trialDaysRemaining: number
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  dataRetentionExpiresAt: string | null
  hasStripeCustomer: boolean
  monthlySubtotal: number
}

const STATUS_CONFIG: Record<
  SubscriptionStatus,
  { label: string; className: string }
> = {
  trialing: {
    label: 'Trial',
    className: 'bg-blue-100 text-blue-800',
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-800',
  },
  past_due: {
    label: 'Past Due',
    className: 'bg-red-100 text-red-800',
  },
  canceled: {
    label: 'Canceled',
    className: 'bg-gray-100 text-gray-800',
  },
  paused: {
    label: 'Paused',
    className: 'bg-yellow-100 text-yellow-800',
  },
  free: {
    label: 'Free',
    className: 'bg-gray-100 text-gray-600',
  },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function SubscriptionStatusCard({
  status,
  planName,
  billingInterval,
  billedLotsCount,
  currentPeriodEnd,
  trialEndDate,
  trialDaysRemaining,
  cancelAtPeriodEnd,
  canceledAt,
  dataRetentionExpiresAt,
  hasStripeCustomer,
  monthlySubtotal,
}: SubscriptionStatusCardProps) {
  const statusConfig = STATUS_CONFIG[status]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              <CreditCard className="size-5" />
              Subscription
            </CardTitle>
            <CardDescription className="mt-1">
              Manage your LevyLite subscription
            </CardDescription>
          </div>
          <Badge variant="secondary" className={statusConfig.className}>
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="font-medium">{planName}</p>
          </div>
          {billedLotsCount !== null && status !== 'free' && (
            <div>
              <p className="text-sm text-muted-foreground">Billed Lots</p>
              <p className="font-medium">{billedLotsCount}</p>
            </div>
          )}
          {billingInterval && status === 'active' && (
            <div>
              <p className="text-sm text-muted-foreground">Billing</p>
              <p className="font-medium capitalize">{billingInterval}</p>
            </div>
          )}
          {status === 'active' && monthlySubtotal > 0 && (
            <div>
              <p className="text-sm text-muted-foreground">
                {billingInterval === 'annual' ? 'Annual Cost' : 'Monthly Cost'}
              </p>
              <p className="font-medium">
                {billingInterval === 'annual'
                  ? formatCurrency(monthlySubtotal * 10 * 1.1) + '/yr'
                  : formatCurrency(monthlySubtotal * 1.1) + '/mo'}
                <span className="text-xs text-muted-foreground ml-1">
                  inc GST
                </span>
              </p>
            </div>
          )}
          {status === 'active' && currentPeriodEnd && (
            <div>
              <p className="text-sm text-muted-foreground">
                {cancelAtPeriodEnd
                  ? 'Cancels On'
                  : 'Next Billing Date'}
              </p>
              <p className="font-medium">{formatDate(currentPeriodEnd)}</p>
            </div>
          )}
        </div>

        {/* Trialing state */}
        {status === 'trialing' && (
          <>
            <Separator />
            <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-3">
              <Clock className="size-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {trialDaysRemaining} day
                  {trialDaysRemaining !== 1 ? 's' : ''} remaining in your trial
                </p>
                <p className="text-xs text-blue-700">
                  Trial ends on {formatDate(trialEndDate)}. Subscribe to keep
                  full access.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/settings/billing/select-plan">Subscribe Now</Link>
            </Button>
          </>
        )}

        {/* Past due warning */}
        {status === 'past_due' && (
          <>
            <Separator />
            <div className="flex items-center gap-3 rounded-lg bg-red-50 p-3">
              <AlertTriangle className="size-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-900">
                  Payment failed
                </p>
                <p className="text-xs text-red-700">
                  Please update your payment method to avoid service
                  interruption.
                </p>
              </div>
            </div>
            {hasStripeCustomer && <ManageBillingButton label="Update Payment Method" />}
          </>
        )}

        {/* Active with cancel scheduled */}
        {status === 'active' && cancelAtPeriodEnd && (
          <>
            <Separator />
            <div className="flex items-center gap-3 rounded-lg bg-yellow-50 p-3">
              <AlertTriangle className="size-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-900">
                  Cancellation scheduled
                </p>
                <p className="text-xs text-yellow-700">
                  Your subscription will end on{' '}
                  {formatDate(currentPeriodEnd)}. You can reactivate from
                  the Stripe portal.
                </p>
              </div>
            </div>
            {hasStripeCustomer && <ManageBillingButton label="Reactivate Subscription" />}
          </>
        )}

        {/* Active normal */}
        {status === 'active' && !cancelAtPeriodEnd && hasStripeCustomer && (
          <>
            <Separator />
            <ManageBillingButton />
          </>
        )}

        {/* Canceled */}
        {status === 'canceled' && (
          <>
            <Separator />
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <AlertTriangle className="size-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Subscription canceled
                </p>
                {canceledAt && (
                  <p className="text-xs text-gray-700">
                    Canceled on {formatDate(canceledAt)}.
                  </p>
                )}
                {dataRetentionExpiresAt && (
                  <p className="text-xs text-gray-700">
                    Your data will be retained until{' '}
                    {formatDate(dataRetentionExpiresAt)}.
                  </p>
                )}
              </div>
            </div>
            <Button asChild>
              <Link href="/settings/billing/select-plan">Reactivate</Link>
            </Button>
          </>
        )}

        {/* Free tier */}
        {status === 'free' && (
          <>
            <Separator />
            <p className="text-sm text-muted-foreground">
              You are on the free plan. Upgrade to unlock trust accounting, bulk
              levy notices, financial reporting, and CSV import/export.
            </p>
            <Button asChild>
              <Link href="/settings/billing/select-plan">
                Upgrade
                <ExternalLink className="ml-2 size-4" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
