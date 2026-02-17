import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportsHub } from '@/components/reports/reports-hub'

export default async function ReportsIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgUser } = await supabase
    .from('organisation_users')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single()

  if (!orgUser) redirect('/')

  const { data: schemes } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number, status')
    .eq('organisation_id', orgUser.organisation_id)
    .eq('status', 'active')
    .order('scheme_name')

  return (
    <ReportsHub schemes={(schemes ?? []).map(s => ({
      id: s.id,
      scheme_name: s.scheme_name,
      scheme_number: s.scheme_number,
    }))} />
  )
}
