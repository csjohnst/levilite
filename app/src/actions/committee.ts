'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  return { user, supabase }
}

export async function getCommitteeMembers(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: members, error } = await supabase
    .from('committee_members')
    .select('*, owners(id, first_name, last_name, email, phone_mobile)')
    .eq('scheme_id', schemeId)
    .eq('is_active', true)
    .order('position')

  if (error) return { error: error.message }
  return { data: members }
}

export async function addCommitteeMember(
  schemeId: string,
  ownerId: string,
  position: 'chair' | 'treasurer' | 'secretary' | 'member',
  electedAt: string,
  termEndDate?: string | null
) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: member, error } = await supabase
    .from('committee_members')
    .insert({
      scheme_id: schemeId,
      owner_id: ownerId,
      position,
      elected_at: electedAt,
      term_end_date: termEndDate || null,
      is_active: true,
    })
    .select('*, owners(id, first_name, last_name, email, phone_mobile)')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/schemes/${schemeId}`)
  revalidatePath(`/dashboard/schemes/${schemeId}/committee`)
  return { data: member }
}

export async function updateCommitteeMember(
  id: string,
  data: {
    position?: 'chair' | 'treasurer' | 'secretary' | 'member'
    elected_at?: string
    term_end_date?: string | null
  }
) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: member, error } = await supabase
    .from('committee_members')
    .update(data)
    .eq('id', id)
    .select('*, owners(id, first_name, last_name, email, phone_mobile)')
    .single()

  if (error) return { error: error.message }
  if (member) {
    revalidatePath(`/dashboard/schemes/${member.scheme_id}`)
    revalidatePath(`/dashboard/schemes/${member.scheme_id}/committee`)
  }
  return { data: member }
}

export async function removeCommitteeMember(id: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: member, error } = await supabase
    .from('committee_members')
    .update({ is_active: false })
    .eq('id', id)
    .select('scheme_id')
    .single()

  if (error) return { error: error.message }
  if (member) {
    revalidatePath(`/dashboard/schemes/${member.scheme_id}`)
    revalidatePath(`/dashboard/schemes/${member.scheme_id}/committee`)
  }
  return { data: true }
}
