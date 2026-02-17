'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// --- Auth helper ---

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  return { user, supabase }
}

// --- Zod Schemas ---

const documentMetadataSchema = z.object({
  document_name: z.string().min(1, 'Document name is required').max(500),
  category: z.enum([
    'agm', 'levy-notices', 'financial', 'insurance', 'bylaws',
    'correspondence', 'maintenance', 'contracts', 'building-reports', 'other',
  ]),
  document_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)'),
  description: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  visibility: z.enum(['owners', 'committee', 'manager_only']).optional().default('manager_only'),
})

const updateDocumentSchema = z.object({
  document_name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum([
    'agm', 'levy-notices', 'financial', 'insurance', 'bylaws',
    'correspondence', 'maintenance', 'contracts', 'building-reports', 'other',
  ]).optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['owners', 'committee', 'manager_only']).optional(),
  version_status: z.enum(['draft', 'final', 'superseded']).optional(),
})

export type DocumentMetadataFormData = z.infer<typeof documentMetadataSchema>
export type UpdateDocumentFormData = z.infer<typeof updateDocumentSchema>

// --- Document Actions ---

/**
 * Upload a document file to Supabase Storage and create a documents record.
 * Expects FormData with: file, document_name, category, document_date, description?, tags?, visibility?
 */
export async function uploadDocument(schemeId: string, formData: FormData) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  // Extract file from FormData
  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File)) {
    return { error: 'No file provided' }
  }
  if (file.size === 0) {
    return { error: 'File is empty' }
  }
  if (file.size > 52428800) {
    return { error: 'File exceeds 50MB limit' }
  }

  // Extract and validate metadata
  const tagsRaw = formData.get('tags') as string | null
  const metadata = {
    document_name: formData.get('document_name') as string,
    category: formData.get('category') as string,
    document_date: formData.get('document_date') as string,
    description: formData.get('description') as string | null,
    tags: tagsRaw ? JSON.parse(tagsRaw) : [],
    visibility: (formData.get('visibility') as string) || 'manager_only',
  }

  const parsed = documentMetadataSchema.safeParse(metadata)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Build storage path: {scheme_id}/{category}/{year}/{sanitized-filename}
  const year = parsed.data.document_date.substring(0, 4)
  const sanitizedName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
  const timestamp = Date.now()
  const storagePath = `${schemeId}/${parsed.data.category}/${year}/${timestamp}_${sanitizedName}`

  // Upload to Supabase Storage
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from('scheme-documents')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) return { error: `File upload failed: ${uploadError.message}` }

  // Create document record
  const { data: document, error: insertError } = await supabase
    .from('documents')
    .insert({
      scheme_id: schemeId,
      document_name: parsed.data.document_name,
      description: parsed.data.description || null,
      category: parsed.data.category,
      document_date: parsed.data.document_date,
      file_path: storagePath,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      tags: parsed.data.tags,
      visibility: parsed.data.visibility,
      uploaded_by: user.id,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    // Try to clean up the uploaded file
    await supabase.storage.from('scheme-documents').remove([storagePath])
    return { error: `Failed to create document record: ${insertError.message}` }
  }

  // Create initial version record
  await supabase
    .from('document_versions')
    .insert({
      document_id: document.id,
      version_number: 1,
      file_path: storagePath,
      file_size: file.size,
      uploaded_by: user.id,
    })

  // Log the upload audit event
  await supabase.rpc('log_document_audit', {
    p_document_id: document.id,
    p_user_id: user.id,
    p_action: 'upload',
    p_event_details: { file_name: file.name, file_size: file.size, mime_type: file.type },
  })

  revalidatePath(`/schemes/${schemeId}/documents`)
  return { data: document }
}

/**
 * List documents for a scheme with optional filters and pagination.
 */
export async function getDocuments(
  schemeId: string,
  filters?: {
    category?: string
    search?: string
    tags?: string[]
    visibility?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    perPage?: number
  },
) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const page = filters?.page ?? 1
  const perPage = filters?.perPage ?? 20
  const offset = (page - 1) * perPage

  let query = supabase
    .from('documents')
    .select('*', { count: 'exact' })
    .eq('scheme_id', schemeId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.visibility) {
    query = query.eq('visibility', filters.visibility)
  }

  if (filters?.dateFrom) {
    query = query.gte('document_date', filters.dateFrom)
  }

  if (filters?.dateTo) {
    query = query.lte('document_date', filters.dateTo)
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags)
  }

  if (filters?.search) {
    query = query.textSearch('search_vector', filters.search, { type: 'websearch' })
  }

  query = query.range(offset, offset + perPage - 1)

  const { data: documents, error, count } = await query

  if (error) return { error: error.message }
  return {
    data: {
      documents: documents ?? [],
      total: count ?? 0,
      page,
      perPage,
      totalPages: Math.ceil((count ?? 0) / perPage),
    },
  }
}

/**
 * Get a single document with its version history.
 */
export async function getDocument(documentId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  const { data: document, error } = await supabase
    .from('documents')
    .select(`
      *,
      document_versions(id, version_number, file_path, file_size, uploaded_by, created_at)
    `)
    .eq('id', documentId)
    .single()

  if (error) return { error: error.message }
  return { data: document }
}

/**
 * Update document metadata.
 */
export async function updateDocument(documentId: string, data: UpdateDocumentFormData) {
  const parsed = updateDocumentSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  // Build update payload (only include provided fields)
  const updatePayload: Record<string, unknown> = {}
  if (parsed.data.document_name !== undefined) updatePayload.document_name = parsed.data.document_name
  if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description
  if (parsed.data.category !== undefined) updatePayload.category = parsed.data.category
  if (parsed.data.tags !== undefined) updatePayload.tags = parsed.data.tags
  if (parsed.data.visibility !== undefined) updatePayload.visibility = parsed.data.visibility
  if (parsed.data.version_status !== undefined) updatePayload.version_status = parsed.data.version_status

  if (Object.keys(updatePayload).length === 0) {
    return { error: 'No fields to update' }
  }

  const { data: document, error } = await supabase
    .from('documents')
    .update(updatePayload)
    .eq('id', documentId)
    .select('*, scheme_id')
    .single()

  if (error) return { error: error.message }

  // Log the metadata update
  await supabase.rpc('log_document_audit', {
    p_document_id: documentId,
    p_user_id: user.id,
    p_action: 'metadata_update',
    p_event_details: { updated_fields: Object.keys(updatePayload) },
  })

  revalidatePath(`/schemes/${document.scheme_id}/documents`)
  return { data: document }
}

/**
 * Soft delete a document (sets deleted_at timestamp).
 */
export async function deleteDocument(documentId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const { data: document, error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
    .is('deleted_at', null)
    .select('scheme_id')
    .single()

  if (error) return { error: error.message }

  // Log deletion
  await supabase.rpc('log_document_audit', {
    p_document_id: documentId,
    p_user_id: user.id,
    p_action: 'delete',
  })

  revalidatePath(`/schemes/${document.scheme_id}/documents`)
  return { data: true }
}

/**
 * Generate a signed download URL for a document (1 hour expiry).
 * Logs the download in the audit log.
 */
export async function downloadDocument(documentId: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('file_path, document_name, mime_type')
    .eq('id', documentId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (!document) return { error: 'Document not found' }

  const { data: signedUrl, error: urlError } = await supabase.storage
    .from('scheme-documents')
    .createSignedUrl(document.file_path, 60 * 60) // 1 hour expiry

  if (urlError) return { error: `Failed to generate download URL: ${urlError.message}` }

  // Log the download
  await supabase.rpc('log_document_audit', {
    p_document_id: documentId,
    p_user_id: user.id,
    p_action: 'download',
  })

  return {
    data: {
      url: signedUrl.signedUrl,
      document_name: document.document_name,
      mime_type: document.mime_type,
    },
  }
}

/**
 * Upload a new version of a document.
 * Marks the current version as superseded and creates a new version record.
 */
export async function uploadNewVersion(documentId: string, formData: FormData) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase, user } = result as Exclude<typeof result, { error: string }>

  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File)) {
    return { error: 'No file provided' }
  }
  if (file.size === 0) {
    return { error: 'File is empty' }
  }
  if (file.size > 52428800) {
    return { error: 'File exceeds 50MB limit' }
  }

  // Get current document to determine next version number
  const { data: currentDoc, error: fetchError } = await supabase
    .from('documents')
    .select('scheme_id, category, document_date, version_number, file_path')
    .eq('id', documentId)
    .single()

  if (fetchError) return { error: fetchError.message }

  const nextVersion = currentDoc.version_number + 1

  // Build storage path for new version
  const year = currentDoc.document_date.substring(0, 4)
  const sanitizedName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
  const timestamp = Date.now()
  const newStoragePath = `${currentDoc.scheme_id}/${currentDoc.category}/${year}/${timestamp}_v${nextVersion}_${sanitizedName}`

  // Upload new file
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from('scheme-documents')
    .upload(newStoragePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) return { error: `File upload failed: ${uploadError.message}` }

  // Mark current document as superseded
  const { error: supersededError } = await supabase
    .from('documents')
    .update({
      is_latest_version: false,
      version_status: 'superseded',
    })
    .eq('id', documentId)

  if (supersededError) return { error: `Failed to mark current version: ${supersededError.message}` }

  // Update the document record with new version info
  const { data: updatedDoc, error: updateError } = await supabase
    .from('documents')
    .update({
      version_number: nextVersion,
      file_path: newStoragePath,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      is_latest_version: true,
      version_status: 'final',
      uploaded_by: user.id,
    })
    .eq('id', documentId)
    .select()
    .single()

  if (updateError) return { error: `Failed to update document record: ${updateError.message}` }

  // Create version record
  await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_number: nextVersion,
      file_path: newStoragePath,
      file_size: file.size,
      uploaded_by: user.id,
    })

  // Log the version event
  await supabase.rpc('log_document_audit', {
    p_document_id: documentId,
    p_user_id: user.id,
    p_action: 'version',
    p_event_details: { version_number: nextVersion, file_name: file.name },
  })

  revalidatePath(`/schemes/${currentDoc.scheme_id}/documents`)
  return { data: updatedDoc }
}

/**
 * Full-text search documents using the search_vector column.
 * Returns ranked results.
 */
export async function searchDocuments(schemeId: string, query: string) {
  const result = await getAuth()
  if ('error' in result && !('supabase' in result)) return { error: result.error }
  const { supabase } = result as Exclude<typeof result, { error: string }>

  if (!query || query.trim().length === 0) {
    return { error: 'Search query is required' }
  }

  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .eq('scheme_id', schemeId)
    .is('deleted_at', null)
    .textSearch('search_vector', query, { type: 'websearch' })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { error: error.message }
  return { data: documents ?? [] }
}
