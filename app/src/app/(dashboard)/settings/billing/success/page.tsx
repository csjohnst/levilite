import Link from 'next/link'
import { CheckCircle2, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const UNLOCKED_FEATURES = [
  'Trust accounting with full double-entry ledger',
  'Bulk levy notice generation (PDF + email)',
  'Financial reporting (trial balance, fund summary, income statement)',
  'CSV import/export for lots and bank statements',
  'Bank reconciliation with auto-matching',
  'Budget management and variance tracking',
  'Unlimited lots and schemes',
]

export default function BillingSuccessPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="size-10 text-green-600" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight">
          Welcome to LevyLite Professional!
        </h2>
        <p className="mt-2 text-muted-foreground">
          Your subscription is now active. You have full access to all features.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s Now Unlocked</CardTitle>
          <CardDescription>
            You now have access to all premium features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {UNLOCKED_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <Button asChild size="lg">
          <Link href="/">
            Go to Dashboard
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings/billing">View Billing Details</Link>
        </Button>
      </div>
    </div>
  )
}
