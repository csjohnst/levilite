import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey)

const email = process.argv[2]
if (!email) {
  console.error('Usage: bun scripts/reset-owner-portal.ts <email>')
  process.exit(1)
}

const { data, error } = await supabase
  .from('owners')
  .update({
    portal_user_id: null,
    portal_invite_sent_at: null,
    portal_invite_accepted_at: null,
    portal_activated_at: null,
  })
  .eq('email', email)
  .select('id, first_name, last_name, email')

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

if (!data || data.length === 0) {
  console.log(`No owner found with email: ${email}`)
} else {
  console.log(`Reset portal fields for: ${data[0].first_name} ${data[0].last_name} (${data[0].email})`)
}
