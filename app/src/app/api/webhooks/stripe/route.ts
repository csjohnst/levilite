import { NextResponse } from 'next/server'
import { getStripe, getWebhookSecret } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, getWebhookSecret())
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Log event (upsert on stripe_event_id)
  const orgId = extractOrgId(event)
  await supabase
    .from('payment_events')
    .upsert(
      {
        stripe_event_id: event.id,
        event_type: event.type,
        organisation_id: orgId,
        payload: event.data.object as unknown as Record<string, unknown>,
        processed: false,
      },
      { onConflict: 'stripe_event_id' }
    )

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session)
        break
      case 'invoice.paid':
        await handleInvoicePaid(supabase, event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(supabase, event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription)
        break
      default:
        // Event logged but no handler
        break
    }

    // Mark event as processed
    await supabase
      .from('payment_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id)
  } catch (err) {
    console.error(`[stripe-webhook] Error processing ${event.type}:`, err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    await supabase
      .from('payment_events')
      .update({ error_message: errorMessage })
      .eq('stripe_event_id', event.id)
    // Still return 200 so Stripe doesn't retry indefinitely
  }

  return NextResponse.json({ received: true })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractOrgId(event: Stripe.Event): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = event.data.object as any
  // checkout.session has metadata.organisation_id
  if (obj.metadata?.organisation_id) return obj.metadata.organisation_id
  // invoices have parent.subscription_details.metadata
  if (obj.parent?.subscription_details?.metadata?.organisation_id) {
    return obj.parent.subscription_details.metadata.organisation_id
  }
  return null
}

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Find the subscription row by stripe_customer_id.
 * Falls back to organisation_id from metadata if available.
 */
async function findSubscription(supabase: AdminClient, stripeCustomerId: string | null, orgId?: string | null) {
  if (stripeCustomerId) {
    const { data } = await supabase
      .from('subscriptions')
      .select('id, organisation_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single()
    if (data) return data
  }
  if (orgId) {
    const { data } = await supabase
      .from('subscriptions')
      .select('id, organisation_id')
      .eq('organisation_id', orgId)
      .single()
    if (data) return data
  }
  return null
}

/** Extract period dates from a subscription's first item (Stripe v20+) */
function extractPeriodDates(stripeSub: Stripe.Subscription) {
  const item = stripeSub.items.data[0]
  if (!item) return { periodStart: null, periodEnd: null }
  const periodStart = new Date(item.current_period_start * 1000).toISOString().slice(0, 10)
  const periodEnd = new Date(item.current_period_end * 1000).toISOString().slice(0, 10)
  return { periodStart, periodEnd }
}

/** Extract billing interval from a subscription's first item */
function extractBillingInterval(stripeSub: Stripe.Subscription): 'monthly' | 'annual' {
  const item = stripeSub.items.data[0]
  return item?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly'
}

/** Get customer ID string from a customer field */
function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(supabase: AdminClient, session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.organisation_id
  if (!orgId) {
    console.error('[stripe-webhook] checkout.session.completed missing organisation_id in metadata')
    return
  }

  // Retrieve the full subscription from Stripe
  const stripeSubscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id
  if (!stripeSubscriptionId) return

  const stripeSub = await getStripe().subscriptions.retrieve(stripeSubscriptionId, {
    expand: ['items.data'],
  })

  const billingInterval = extractBillingInterval(stripeSub)
  const billedLots = stripeSub.items.data[0]?.quantity ?? 0
  const { periodStart, periodEnd } = extractPeriodDates(stripeSub)

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      stripe_customer_id: customerId(session.customer),
      stripe_subscription_id: stripeSubscriptionId,
      billing_interval: billingInterval,
      billed_lots_count: billedLots,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    })
    .eq('organisation_id', orgId)
}

async function handleInvoicePaid(supabase: AdminClient, invoice: Stripe.Invoice) {
  const custId = customerId(invoice.customer)
  const sub = await findSubscription(supabase, custId)
  if (!sub) {
    console.error('[stripe-webhook] invoice.paid: no matching subscription for customer', custId)
    return
  }

  // Get subscription ID from invoice's parent
  const stripeSubId = typeof invoice.parent?.subscription_details?.subscription === 'string'
    ? invoice.parent.subscription_details.subscription
    : invoice.parent?.subscription_details?.subscription?.id ?? null

  if (stripeSubId) {
    const stripeSub = await getStripe().subscriptions.retrieve(stripeSubId, {
      expand: ['items.data'],
    })
    const billedLots = stripeSub.items.data[0]?.quantity ?? 0
    const { periodStart, periodEnd } = extractPeriodDates(stripeSub)

    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: periodStart,
        current_period_end: periodEnd,
        billed_lots_count: billedLots,
      })
      .eq('id', sub.id)
  }

  // Upsert platform invoice
  // In Stripe v20, tax is computed from total_taxes array
  const subtotalExGst = (invoice.subtotal ?? 0) / 100
  const totalTax = (invoice.total_taxes ?? []).reduce(
    (sum, t) => sum + (t.amount ?? 0), 0
  ) / 100
  const totalIncGst = (invoice.total ?? 0) / 100
  const billedLotsFromLines = invoice.lines?.data?.[0]?.quantity ?? 0

  // Get interval from the first line item's pricing details (Stripe v20+)
  const pricingDetails = invoice.lines?.data?.[0]?.pricing?.price_details
  const priceRef = pricingDetails?.price
  const priceObj = (priceRef && typeof priceRef !== 'string') ? priceRef : null
  const lineInterval = priceObj?.recurring?.interval === 'year' ? 'annual' : 'monthly'

  await supabase
    .from('platform_invoices')
    .upsert(
      {
        organisation_id: sub.organisation_id,
        subscription_id: sub.id,
        stripe_invoice_id: invoice.id,
        invoice_number: invoice.number,
        subtotal_ex_gst: subtotalExGst,
        gst_amount: totalTax,
        total_inc_gst: totalIncGst,
        lots_billed: billedLotsFromLines,
        billing_interval: lineInterval,
        invoice_date: new Date(invoice.created * 1000).toISOString().slice(0, 10),
        due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString().slice(0, 10) : null,
        paid_at: new Date().toISOString(),
        status: 'paid',
        stripe_invoice_url: invoice.hosted_invoice_url ?? null,
        stripe_pdf_url: invoice.invoice_pdf ?? null,
      },
      { onConflict: 'stripe_invoice_id' }
    )
}

async function handleInvoicePaymentFailed(supabase: AdminClient, invoice: Stripe.Invoice) {
  const custId = customerId(invoice.customer)
  const sub = await findSubscription(supabase, custId)
  if (!sub) {
    console.error('[stripe-webhook] invoice.payment_failed: no matching subscription for customer', custId)
    return
  }

  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('id', sub.id)
}

async function handleSubscriptionUpdated(supabase: AdminClient, subscription: Stripe.Subscription) {
  const custId = customerId(subscription.customer)
  const sub = await findSubscription(supabase, custId, subscription.metadata?.organisation_id)
  if (!sub) {
    console.error('[stripe-webhook] subscription.updated: no matching subscription for customer', custId)
    return
  }

  const billedLots = subscription.items.data[0]?.quantity ?? 0
  const { periodStart, periodEnd } = extractPeriodDates(subscription)

  // Map Stripe status to our status values
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    trialing: 'trialing',
    paused: 'paused',
  }
  const mappedStatus = statusMap[subscription.status] ?? subscription.status

  const updateData: Record<string, unknown> = {
    status: mappedStatus,
    cancel_at_period_end: subscription.cancel_at_period_end,
    billed_lots_count: billedLots,
    current_period_start: periodStart,
    current_period_end: periodEnd,
  }

  // If subscription was canceled, set retention expiry
  if (subscription.canceled_at) {
    updateData.canceled_at = new Date(subscription.canceled_at * 1000).toISOString()
    const retentionDate = new Date()
    retentionDate.setDate(retentionDate.getDate() + 90)
    updateData.data_retention_expires_at = retentionDate.toISOString()
  }

  await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('id', sub.id)
}

async function handleSubscriptionDeleted(supabase: AdminClient, subscription: Stripe.Subscription) {
  const custId = customerId(subscription.customer)
  const sub = await findSubscription(supabase, custId, subscription.metadata?.organisation_id)
  if (!sub) {
    console.error('[stripe-webhook] subscription.deleted: no matching subscription for customer', custId)
    return
  }

  const now = new Date()
  const retentionDate = new Date()
  retentionDate.setDate(retentionDate.getDate() + 90)

  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: now.toISOString(),
      data_retention_expires_at: retentionDate.toISOString(),
    })
    .eq('id', sub.id)
}
