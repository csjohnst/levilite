import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

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

    // Get stripe_customer_id for this organisation
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('organisation_id', orgUser.organisation_id)
      .single()

    if (subError || !subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/settings/billing`,
    })

    return NextResponse.json({ portalUrl: portalSession.url })
  } catch (err) {
    console.error('[create-portal-session] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
