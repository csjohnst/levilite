import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organisation and verify manager role
    const { data: orgUser, error: orgError } = await supabase
      .from('organisation_users')
      .select('organisation_id, role')
      .eq('user_id', user.id)
      .single()

    if (orgError || !orgUser) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 400 })
    }
    if (orgUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only managers can manage billing' }, { status: 403 })
    }

    const { billingInterval } = await request.json() as { billingInterval: 'monthly' | 'annual' }
    if (!billingInterval || !['monthly', 'annual'].includes(billingInterval)) {
      return NextResponse.json({ error: 'Invalid billing interval' }, { status: 400 })
    }

    const orgId = orgUser.organisation_id

    // Get subscription + paid plan price ID
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, stripe_customer_id, plan_id')
      .eq('organisation_id', orgId)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 })
    }

    // Get the paid plan's stripe price ID
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('stripe_monthly_price_id, stripe_annual_price_id')
      .eq('plan_code', 'paid')
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Paid plan not found' }, { status: 500 })
    }

    const priceId = billingInterval === 'annual'
      ? plan.stripe_annual_price_id
      : plan.stripe_monthly_price_id

    if (!priceId) {
      return NextResponse.json({ error: 'Stripe price not configured for this plan' }, { status: 500 })
    }

    // Count lots for the organisation
    const { count: lotCount, error: lotError } = await supabase
      .from('lots')
      .select('id, schemes!inner(organisation_id)', { count: 'exact', head: true })
      .eq('schemes.organisation_id', orgId)

    if (lotError) {
      return NextResponse.json({ error: 'Failed to count lots' }, { status: 500 })
    }

    const quantity = Math.max(lotCount ?? 1, 1) // Minimum 1 lot

    // Get or create Stripe customer
    let stripeCustomerId = subscription.stripe_customer_id

    if (!stripeCustomerId) {
      // Get org name for customer creation
      const { data: org } = await supabase
        .from('organisations')
        .select('name')
        .eq('id', orgId)
        .single()

      const customer = await getStripe().customers.create({
        email: user.email,
        name: org?.name ?? undefined,
        metadata: { organisation_id: orgId },
      })

      stripeCustomerId = customer.id

      // Store customer ID using admin client to bypass RLS for this update
      const adminSupabase = createAdminClient()
      await adminSupabase
        .from('subscriptions')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('organisation_id', orgId)
    }

    // Create checkout session
    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
    const session = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card', 'au_becs_debit'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      metadata: { organisation_id: orgId },
      subscription_data: {
        metadata: { organisation_id: orgId },
      },
      success_url: `${origin}/settings/billing?success=true`,
      cancel_url: `${origin}/settings/billing`,
    })

    return NextResponse.json({ sessionUrl: session.url })
  } catch (err) {
    console.error('[create-checkout-session] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
