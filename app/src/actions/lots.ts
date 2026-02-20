'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const lotSchema = z.object({
  lot_number: z.string().min(1, 'Lot number is required'),
  unit_number: z.string().optional().nullable(),
  street_address: z.string().optional().nullable(),
  lot_type: z.enum(['residential', 'commercial', 'parking', 'storage', 'common-property', 'other']),
  unit_entitlement: z.number().int().min(0, 'Unit entitlement must be 0 or greater'),
  voting_entitlement: z.number().int().positive().optional().nullable(),
  floor_area_sqm: z.number().positive().optional().nullable(),
  balcony_area_sqm: z.number().positive().optional().nullable(),
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().min(0).optional().nullable(),
  car_bays: z.number().int().min(0).optional().nullable(),
  occupancy_status: z.enum(['owner-occupied', 'tenanted', 'vacant', 'common-property', 'unknown']),
  notes: z.string().optional().nullable(),
})

export type LotFormData = z.infer<typeof lotSchema>

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  return { user, supabase }
}

export async function getLots(schemeId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: lots, error } = await supabase
    .from('lots')
    .select('*, lot_ownerships(*, owners(id, first_name, last_name, email))')
    .eq('scheme_id', schemeId)
    .eq('status', 'active')
    .order('lot_number')

  if (error) return { error: error.message }
  return { data: lots }
}

export async function getLot(lotId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: lot, error } = await supabase
    .from('lots')
    .select('*, lot_ownerships(*, owners(id, first_name, last_name, email, phone_mobile))')
    .eq('id', lotId)
    .single()

  if (error) return { error: error.message }
  return { data: lot }
}

export async function createLot(schemeId: string, data: LotFormData) {
  const parsed = lotSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const { data: lot, error } = await supabase
    .from('lots')
    .insert({
      ...parsed.data,
      scheme_id: schemeId,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/schemes/${schemeId}`)
  return { data: lot }
}

export async function updateLot(lotId: string, data: LotFormData) {
  const parsed = lotSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const { data: lot, error } = await supabase
    .from('lots')
    .update({
      ...parsed.data,
      updated_by: user.id,
    })
    .eq('id', lotId)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/schemes/${lot.scheme_id}`)
  return { data: lot }
}

export async function deleteLot(lotId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  // Get scheme_id before deleting for revalidation
  const { data: lot } = await supabase
    .from('lots')
    .select('scheme_id')
    .eq('id', lotId)
    .single()

  const { error } = await supabase
    .from('lots')
    .delete()
    .eq('id', lotId)

  if (error) return { error: error.message }
  if (lot) revalidatePath(`/schemes/${lot.scheme_id}`)
  return { data: true }
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    fields.push(current.trim())
    return fields
  }

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))
  const rows = lines.slice(1).filter(line => line.trim()).map(parseLine)

  return { headers, rows }
}

export async function importLotsFromCSV(schemeId: string, csvText: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const { headers, rows } = parseCSV(csvText)
  if (headers.length === 0) return { error: 'CSV file is empty or has no headers' }

  const lotNumberIdx = headers.indexOf('lot_number')
  const unitEntitlementIdx = headers.indexOf('unit_entitlement')
  if (lotNumberIdx === -1) return { error: 'CSV must have a "lot_number" column' }
  if (unitEntitlementIdx === -1) return { error: 'CSV must have a "unit_entitlement" column' }

  const errors: { row: number; message: string }[] = []
  const lotsToInsert: Record<string, unknown>[] = []
  const ownersByLot: Map<number, { first_name: string; last_name: string; email?: string; phone_mobile?: string }> = new Map()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const getValue = (col: string) => {
      const idx = headers.indexOf(col)
      return idx !== -1 && idx < row.length ? row[idx] || null : null
    }

    const lotNumber = getValue('lot_number')
    const unitEntitlement = getValue('unit_entitlement')

    if (!lotNumber) {
      errors.push({ row: i + 2, message: 'lot_number is required' })
      continue
    }
    if (!unitEntitlement || isNaN(Number(unitEntitlement)) || Number(unitEntitlement) <= 0) {
      errors.push({ row: i + 2, message: 'unit_entitlement must be a non-negative number (0 is valid for Common Property)' })
      continue
    }

    const lotType = getValue('lot_type') || 'residential'
    const validTypes = ['residential', 'commercial', 'parking', 'storage', 'other']
    if (!validTypes.includes(lotType)) {
      errors.push({ row: i + 2, message: `Invalid lot_type: ${lotType}` })
      continue
    }

    const lotData: Record<string, unknown> = {
      scheme_id: schemeId,
      lot_number: lotNumber,
      unit_entitlement: Number(unitEntitlement),
      lot_type: lotType,
      created_by: user.id,
    }

    const unitNumber = getValue('unit_number')
    if (unitNumber) lotData.unit_number = unitNumber

    const votingEntitlement = getValue('voting_entitlement')
    if (votingEntitlement && !isNaN(Number(votingEntitlement))) {
      lotData.voting_entitlement = Number(votingEntitlement)
    }

    const floorArea = getValue('floor_area_sqm')
    if (floorArea && !isNaN(Number(floorArea))) lotData.floor_area_sqm = Number(floorArea)

    const bedrooms = getValue('bedrooms')
    if (bedrooms && !isNaN(Number(bedrooms))) lotData.bedrooms = Number(bedrooms)

    const bathrooms = getValue('bathrooms')
    if (bathrooms && !isNaN(Number(bathrooms))) lotData.bathrooms = Number(bathrooms)

    const carBays = getValue('car_bays')
    if (carBays && !isNaN(Number(carBays))) lotData.car_bays = Number(carBays)

    const notes = getValue('notes')
    if (notes) lotData.notes = notes

    lotsToInsert.push(lotData)

    // Check for owner info
    const ownerFirst = getValue('owner_first_name')
    const ownerLast = getValue('owner_last_name')
    if (ownerFirst && ownerLast) {
      ownersByLot.set(lotsToInsert.length - 1, {
        first_name: ownerFirst,
        last_name: ownerLast,
        email: getValue('owner_email') || undefined,
        phone_mobile: getValue('owner_phone') || undefined,
      })
    }
  }

  if (lotsToInsert.length === 0) {
    return { error: 'No valid lots found in CSV', errors }
  }

  const { data: insertedLots, error: lotError } = await supabase
    .from('lots')
    .insert(lotsToInsert)
    .select()

  if (lotError) return { error: lotError.message, errors }

  // Create owners and link them
  let ownersCreated = 0
  if (insertedLots) {
    for (const [idx, ownerData] of ownersByLot.entries()) {
      const lot = insertedLots[idx]
      if (!lot) continue

      const { data: owner, error: ownerError } = await supabase
        .from('owners')
        .insert({
          first_name: ownerData.first_name,
          last_name: ownerData.last_name,
          email: ownerData.email || null,
          phone_mobile: ownerData.phone_mobile || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (ownerError || !owner) continue

      await supabase
        .from('lot_ownerships')
        .insert({
          lot_id: lot.id,
          owner_id: owner.id,
          ownership_type: 'sole',
          ownership_percentage: 100,
          is_primary_contact: true,
          created_by: user.id,
        })

      ownersCreated++
    }
  }

  revalidatePath(`/schemes/${schemeId}`)
  return {
    data: {
      lotsCreated: insertedLots?.length ?? 0,
      ownersCreated,
    },
    errors: errors.length > 0 ? errors : undefined,
  }
}
