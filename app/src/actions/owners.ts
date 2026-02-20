'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const ownerSchema = z.object({
  title: z.string().optional().nullable(),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  middle_name: z.string().optional().nullable(),
  preferred_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  email_secondary: z.string().email().optional().nullable(),
  phone_mobile: z.string().optional().nullable(),
  phone_home: z.string().optional().nullable(),
  phone_work: z.string().optional().nullable(),
  postal_address_line1: z.string().optional().nullable(),
  postal_address_line2: z.string().optional().nullable(),
  postal_suburb: z.string().optional().nullable(),
  postal_state: z.string().optional().nullable(),
  postal_postcode: z.string().optional().nullable(),
  abn: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  correspondence_method: z.enum(['email', 'postal', 'both']),
  notes: z.string().optional().nullable(),
})

export type OwnerFormData = z.infer<typeof ownerSchema>

export interface LotAssignment {
  lot_id: string
  ownership_type: 'sole' | 'joint-tenants' | 'tenants-in-common'
  ownership_percentage: number
}

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  return { user, supabase }
}

export async function getOwners(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Get owners linked to lots in this scheme via lot_ownerships
  const { data: lots, error: lotsError } = await supabase
    .from('lots')
    .select('id')
    .eq('scheme_id', schemeId)
    .eq('status', 'active')

  if (lotsError) return { error: lotsError.message }
  if (!lots || lots.length === 0) return { data: [] }

  const lotIds = lots.map(l => l.id)

  const { data: ownerships, error } = await supabase
    .from('lot_ownerships')
    .select('*, owners(*), lots(id, lot_number, unit_number)')
    .in('lot_id', lotIds)
    .is('ownership_end_date', null)

  if (error) return { error: error.message }

  // Group by owner to deduplicate
  const ownerMap = new Map<string, { owner: Record<string, unknown>; lots: Record<string, unknown>[] }>()
  for (const ownership of ownerships || []) {
    const owner = ownership.owners as Record<string, unknown>
    if (!owner) continue
    const ownerId = owner.id as string
    if (!ownerMap.has(ownerId)) {
      ownerMap.set(ownerId, { owner, lots: [] })
    }
    if (ownership.lots) {
      ownerMap.get(ownerId)!.lots.push(ownership.lots as Record<string, unknown>)
    }
  }

  return { data: Array.from(ownerMap.values()) }
}

export async function getOwner(ownerId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: owner, error } = await supabase
    .from('owners')
    .select('*, lot_ownerships(*, lots(id, lot_number, unit_number, scheme_id))')
    .eq('id', ownerId)
    .single()

  if (error) return { error: error.message }
  return { data: owner }
}

export async function createOwner(
  data: OwnerFormData,
  lotAssignments?: LotAssignment[]
) {
  const parsed = ownerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const { data: owner, error } = await supabase
    .from('owners')
    .insert({
      ...parsed.data,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Create lot ownership records
  if (lotAssignments && lotAssignments.length > 0 && owner) {
    const ownershipRecords = lotAssignments.map(a => ({
      lot_id: a.lot_id,
      owner_id: owner.id,
      ownership_type: a.ownership_type,
      ownership_percentage: a.ownership_percentage,
      is_primary_contact: true,
      created_by: user.id,
    }))

    const { error: ownershipError } = await supabase
      .from('lot_ownerships')
      .insert(ownershipRecords)

    if (ownershipError) {
      return { error: `Owner created but lot assignment failed: ${ownershipError.message}`, data: owner }
    }

    // Revalidate the scheme pages that show this lot's owners
    for (const a of lotAssignments) {
      const { data: lot } = await supabase
        .from('lots')
        .select('scheme_id')
        .eq('id', a.lot_id)
        .single()
      if (lot) revalidatePath(`/schemes/${lot.scheme_id}`)
    }
  }

  return { data: owner }
}

export async function updateOwner(ownerId: string, data: OwnerFormData) {
  const parsed = ownerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const { data: owner, error } = await supabase
    .from('owners')
    .update({
      ...parsed.data,
      updated_by: user.id,
    })
    .eq('id', ownerId)
    .select()
    .single()

  if (error) return { error: error.message }

  // Revalidate scheme pages for lots this owner is assigned to
  const { data: ownerships } = await supabase
    .from('lot_ownerships')
    .select('lot_id, lots(scheme_id)')
    .eq('owner_id', ownerId)
    .is('ownership_end_date', null)
  const schemeIds = new Set<string>()
  for (const o of ownerships ?? []) {
    const lot = o.lots as unknown as { scheme_id: string } | null
    if (lot?.scheme_id) schemeIds.add(lot.scheme_id)
  }
  for (const sid of schemeIds) {
    revalidatePath(`/schemes/${sid}`)
  }

  return { data: owner }
}

export async function deleteOwner(ownerId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Get scheme IDs for revalidation before deleting
  const { data: ownerships } = await supabase
    .from('lot_ownerships')
    .select('lot_id, lots(scheme_id)')
    .eq('owner_id', ownerId)
  const schemeIds = new Set<string>()
  for (const o of ownerships ?? []) {
    const lot = o.lots as unknown as { scheme_id: string } | null
    if (lot?.scheme_id) schemeIds.add(lot.scheme_id)
  }

  const { error } = await supabase
    .from('owners')
    .delete()
    .eq('id', ownerId)

  if (error) return { error: error.message }

  for (const sid of schemeIds) {
    revalidatePath(`/schemes/${sid}`)
  }

  return { data: true }
}

export async function assignOwnerToLot(
  ownerId: string,
  lotId: string,
  ownershipData: {
    ownership_type: 'sole' | 'joint-tenants' | 'tenants-in-common'
    ownership_percentage: number
  }
) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const { data: ownership, error } = await supabase
    .from('lot_ownerships')
    .insert({
      lot_id: lotId,
      owner_id: ownerId,
      ownership_type: ownershipData.ownership_type,
      ownership_percentage: ownershipData.ownership_percentage,
      is_primary_contact: true,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data: ownership }
}

/**
 * Get ALL owners in the organisation — including those without lot assignments.
 * Used for the global owner directory page.
 *
 * Returns each owner with their lot assignments (may be empty for orphaned owners).
 */
export async function getGlobalOwners() {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  // Get user's organisation
  const { data: profile } = await supabase
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organisation_id) {
    return { error: 'No organisation found for user' }
  }

  // Get all owners for this org — including unassigned (created_by user or via org)
  // We join lot_ownerships LEFT JOIN to catch owners with no lots
  const { data: ownerships, error } = await supabase
    .from('lot_ownerships')
    .select(`
      *,
      owners(*),
      lots(id, lot_number, unit_number, scheme_id, schemes(id, name))
    `)
    .is('ownership_end_date', null)

  if (error) return { error: error.message }

  // Also get owners created by this user who may have no lot assignments
  const { data: allOwners, error: allOwnersError } = await supabase
    .from('owners')
    .select('*')
    .eq('created_by', user.id)
    .order('last_name')

  if (allOwnersError) return { error: allOwnersError.message }

  // Build a map of ownerId → { owner, lots: [...] }
  const ownerMap = new Map<string, {
    owner: Record<string, unknown>
    lots: Array<{ id: string; lot_number: string; unit_number: string | null; scheme_id: string; scheme_name: string }>
  }>()

  // First add all owners (even without lots)
  for (const owner of allOwners || []) {
    ownerMap.set(owner.id, { owner, lots: [] })
  }

  // Then fill in lot assignments
  for (const ownership of ownerships || []) {
    const owner = ownership.owners as Record<string, unknown>
    if (!owner) continue
    const ownerId = owner.id as string

    if (!ownerMap.has(ownerId)) {
      ownerMap.set(ownerId, { owner, lots: [] })
    }

    if (ownership.lots) {
      const lot = ownership.lots as {
        id: string; lot_number: string; unit_number: string | null;
        scheme_id: string; schemes: { id: string; name: string } | null
      }
      ownerMap.get(ownerId)!.lots.push({
        id: lot.id,
        lot_number: lot.lot_number,
        unit_number: lot.unit_number,
        scheme_id: lot.scheme_id,
        scheme_name: lot.schemes?.name ?? 'Unknown Scheme',
      })
    }
  }

  return {
    data: Array.from(ownerMap.values()).map(({ owner, lots }) => ({
      owner,
      lots,
      isOrphaned: lots.length === 0,
    }))
  }
}
