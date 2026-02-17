'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const schemeSchema = z.object({
  scheme_number: z.string().regex(/^SP\s?\d{4,6}$/, 'Scheme number must be in format "SP 12345"'),
  scheme_name: z.string().min(3, 'Scheme name must be at least 3 characters').max(255),
  scheme_type: z.enum(['strata', 'survey-strata', 'community']),
  street_address: z.string().min(1, 'Street address is required'),
  suburb: z.string().min(1, 'Suburb is required'),
  state: z.enum(['WA', 'NSW', 'VIC', 'QLD', 'SA', 'TAS', 'NT', 'ACT']),
  postcode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
  abn: z.string().regex(/^\d{11}$/).optional().nullable(),
  acn: z.string().regex(/^\d{9}$/).optional().nullable(),
  registered_name: z.string().max(255).optional().nullable(),
  financial_year_end_month: z.number().min(1).max(12),
  financial_year_end_day: z.number().min(1).max(31),
  levy_frequency: z.enum(['monthly', 'quarterly', 'annual', 'custom']),
  levy_due_day: z.number().min(1).max(28),
  notes: z.string().optional().nullable(),
})

export type SchemeFormData = z.infer<typeof schemeSchema>

async function getOrgId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }

  const { data: orgUser } = await supabase
    .from('organisation_users')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single()
  if (!orgUser) return { error: 'No organisation found' as const }

  return { user, orgId: orgUser.organisation_id, supabase }
}

export async function getSchemes() {
  const result = await getOrgId()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, orgId } = result as Exclude<typeof result, { error: string }>

  const { data: schemes, error } = await supabase
    .from('schemes')
    .select('*, lots(count)')
    .eq('organisation_id', orgId)
    .neq('status', 'archived')
    .order('scheme_name')

  if (error) return { error: error.message }
  return { data: schemes }
}

export async function getScheme(id: string) {
  const result = await getOrgId()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: scheme, error } = await supabase
    .from('schemes')
    .select('*, lots(count)')
    .eq('id', id)
    .single()

  if (error) return { error: error.message }
  return { data: scheme }
}

export async function createScheme(data: SchemeFormData) {
  const parsed = schemeSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getOrgId()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, orgId, user } = result as Exclude<typeof result, { error: string }>

  const { data: scheme, error } = await supabase
    .from('schemes')
    .insert({
      ...parsed.data,
      organisation_id: orgId,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/schemes')
  return { data: scheme }
}

export async function updateScheme(id: string, data: SchemeFormData) {
  const parsed = schemeSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getOrgId()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const { data: scheme, error } = await supabase
    .from('schemes')
    .update({
      ...parsed.data,
      updated_by: user.id,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/schemes')
  revalidatePath(`/dashboard/schemes/${id}`)
  return { data: scheme }
}

export async function deleteScheme(id: string) {
  const result = await getOrgId()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const { error } = await supabase
    .from('schemes')
    .update({ status: 'archived', updated_by: user.id })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/schemes')
  return { data: true }
}
