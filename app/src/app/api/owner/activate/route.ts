import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    let decoded: { ownerId: string; portalUserId: string; ts: number }
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'))
    } catch {
      return NextResponse.json(
        { error: 'Invalid activation token' },
        { status: 400 }
      )
    }

    if (!decoded.ownerId || !decoded.portalUserId) {
      return NextResponse.json(
        { error: 'Invalid activation token' },
        { status: 400 }
      )
    }

    // Check expiry (7 days)
    if (decoded.ts && Date.now() - decoded.ts > 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: 'Activation link has expired. Please contact your strata manager.' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    // Fetch the owner record
    const { data: owner, error: ownerError } = await adminSupabase
      .from('owners')
      .select('id, email, first_name, last_name, portal_user_id, portal_invite_accepted_at')
      .eq('id', decoded.ownerId)
      .single()

    if (ownerError || !owner) {
      return NextResponse.json(
        { error: 'Owner record not found' },
        { status: 404 }
      )
    }

    if (!owner.portal_user_id) {
      return NextResponse.json(
        { error: 'No portal invitation found. Please contact your strata manager.' },
        { status: 400 }
      )
    }

    // Already activated
    if (owner.portal_invite_accepted_at) {
      return NextResponse.json({
        email: owner.email,
        alreadyActivated: true,
      })
    }

    // Set the password on the auth user via admin API
    const { error: updateUserError } = await adminSupabase.auth.admin.updateUserById(
      decoded.portalUserId,
      { password }
    )

    if (updateUserError) {
      return NextResponse.json(
        { error: `Failed to set password: ${updateUserError.message}` },
        { status: 500 }
      )
    }

    // Mark as activated
    const { error: updateError } = await adminSupabase
      .from('owners')
      .update({
        portal_invite_accepted_at: new Date().toISOString(),
        portal_activated_at: new Date().toISOString(),
      })
      .eq('id', decoded.ownerId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to activate account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      email: owner.email,
      alreadyActivated: false,
    })
  } catch (err) {
    console.error('[api/owner/activate] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
