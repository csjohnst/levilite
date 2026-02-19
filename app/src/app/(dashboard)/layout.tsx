import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { TrialBanner } from '@/components/trial-banner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch organisation membership
  const { data: orgUser } = await supabase
    .from('organisation_users')
    .select('organisation_id, role, organisations(id, name)')
    .eq('user_id', user.id)
    .single()

  // Fetch schemes for this org
  const { data: schemes } = await supabase
    .from('schemes')
    .select('id, scheme_name, scheme_number, status')
    .eq('organisation_id', orgUser?.organisation_id)
    .eq('status', 'active')
    .order('scheme_name')

  const organisation = orgUser?.organisations as
    | { id: string; name: string }
    | null
    | undefined

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        organisation={organisation}
        schemes={schemes ?? []}
      />
      <SidebarInset>
        <DashboardHeader />
        <div className="px-4 pt-4 md:px-6 md:pt-6">
          <TrialBanner />
        </div>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
