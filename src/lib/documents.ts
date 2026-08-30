/**
 * Pure Supabase helpers for the Documents feature.
 *
 * These functions contain no React state — they are called by useDocuments()
 * and can also be called from other contexts if needed.
 *
 * SECURITY NOTES:
 *  - The `vault-documents` bucket is PRIVATE. Never call getPublicUrl() here.
 *  - All file access goes through short-lived signed URLs generated server-side.
 *  - Storage path structure: <user_id>/<document_id>/<sanitized_filename>
 *    The first path segment is always the owner's user_id, which is what the
 *    Storage RLS policy verifies on every operation.
 *  - Signed URL TTL is kept short (60 s for preview & download).
 *  - User identity is derived from the authenticated Supabase session.
 */

import { supabase } from './supabase'
import { DOCUMENT_CATEGORIES } from '../types/app'
import type { DocumentCategory, VaultDocument } from '../types/app'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DOC_BUCKET = 'vault-documents'

/** 25 MB — matches schema CHECK constraint and Supabase bucket config. */
export const MAX_DOC_BYTES = 25 * 1024 * 1024

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/** Human-readable labels for validation messages. */
const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable error string if the file is invalid, or null if OK.
 * Checks both MIME type and size — does NOT rely on the filename extension.
 */
export function validateDocumentFile(file: File): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    const supported = Object.values(MIME_LABELS).join(', ')
    return `Unsupported file type "${file.type || 'unknown'}". Supported: ${supported}.`
  }
  if (file.size > MAX_DOC_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return `File is too large (${mb} MB). Maximum allowed size is 25 MB.`
  }
  if (file.size === 0) {
    return 'File appears to be empty.'
  }
  return null
}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

/**
 * Strip path separators and control characters so a filename cannot escape its
 * intended folder. Collapses runs of unsafe chars to a single underscore.
 */
export function sanitizeFilename(raw: string): string {
  return raw
    .replace(/[/\\?%*:|"<>]/g, '_')  // path separators + shell specials
    .replace(/\s+/g, '_')             // spaces
    .replace(/_+/g, '_')              // collapse repeated underscores
    .replace(/^_|_$/g, '')            // trim leading/trailing underscores
    .slice(0, 100)                    // cap length
    || 'file'
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Fetch all documents for the authenticated user (metadata only — RLS enforces isolation). */
export async function listDocuments(): Promise<VaultDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as VaultDocument[]) ?? []
}

/**
 * Upload a document to private storage and insert the DB row.
 * User ID is derived from the authenticated Supabase session.
 *
 * Orphan-prevention strategy:
 *   1. Upload to Storage first.
 *   2. Insert DB row.
 *   3. If DB insert fails, delete the Storage object before throwing.
 */
export async function uploadDocument(
  file: File,
  name: string,
  category: DocumentCategory,
): Promise<VaultDocument> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('You must be signed in to upload documents.')
  }
  const userId = user.id

  const validationError = validateDocumentFile(file)
  if (validationError) throw new Error(validationError)

  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Document name is required.')

  // Build safe storage path: <user_id>/<document_id>/<safe_filename>
  const docId = crypto.randomUUID()
  const ext = file.name.includes('.')
    ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')
    : ''
  const rawBase = file.name.includes('.')
    ? file.name.slice(0, file.name.lastIndexOf('.'))
    : file.name
  const safeBase = sanitizeFilename(rawBase)
  const safeFilename = ext ? `${safeBase}.${ext}` : safeBase
  const storagePath = `${userId}/${docId}/${safeFilename}`

  // 1. Upload file to private Storage.
  const { error: uploadError } = await supabase.storage
    .from(DOC_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  // 2. Insert the metadata row.
  const { data, error: dbError } = await supabase
    .from('documents')
    .insert({
      id: docId,
      user_id: userId,
      category,
      name: trimmedName,
      mime_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
    })
    .select('*')
    .single()

  if (dbError) {
    // Orphan prevention: remove uploaded storage object if DB insert fails
    await supabase.storage.from(DOC_BUCKET).remove([storagePath]).catch(() => {})
    throw new Error(`Failed to save document record: ${dbError.message}`)
  }

  return data as VaultDocument
}

/**
 * Generate a short-lived signed URL for authenticated document access.
 *
 * @param storagePath  The `storage_path` field from the documents table.
 * @param expiresIn    TTL in seconds. Kept short (60s) for secure preview and download.
 *
 * IMPORTANT: Never log or store signed URLs in persistent state.
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data?.signedUrl) {
    throw new Error(`Could not generate secure access URL: ${error?.message ?? 'Unknown error'}`)
  }

  return data.signedUrl
}

/**
 * Update ONLY the user-facing metadata of a document (name + category).
 *
 * The physical Storage object is deliberately left untouched: the
 * <user_id>/<document_id>/<filename> object and its `storage_path` never change,
 * so no file operations happen and the existing signed URL / download / preview
 * paths keep working unchanged.
 *
 * Ownership is enforced server-side by the `documents_update_own` RLS policy
 * (auth.uid() = user_id on both USING and WITH CHECK). The UI never sends a
 * user_id — the authenticated session is the only source of authority — so an
 * update targeting another user's row yields zero rows and fails safely.
 */
export async function updateDocumentMetadata(
  doc: VaultDocument,
  name: string,
  category: DocumentCategory,
): Promise<VaultDocument> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Document name is required.')
  if (trimmedName.length > 120) throw new Error('Document name must be 120 characters or fewer.')
  if (!(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error('Please choose a valid category.')
  }

  const { data, error } = await supabase
    .from('documents')
    .update({ name: trimmedName, category })
    .eq('id', doc.id)
    .select()
    .single()

  if (error) throw new Error(`Failed to save changes: ${error.message}`)

  return data as VaultDocument
}

/**
 * Delete a document completely: Storage object first, then the DB row.
 *
 * Partial-failure handling:
 *   - If Storage deletion fails: throw immediately — the DB row is kept so the
 *     user can try again. The file is still protected by private bucket + RLS.
 *   - If DB deletion fails after Storage succeeds: throw a clear error explaining
 *     that the storage file was deleted and the user may retry to remove the DB record.
 */
export async function deleteDocument(doc: VaultDocument): Promise<void> {
  // 1. Delete Storage object first (more dangerous to leave orphaned).
  const { error: storageError } = await supabase.storage
    .from(DOC_BUCKET)
    .remove([doc.storage_path])

  if (storageError) {
    throw new Error(`Could not delete document file from storage: ${storageError.message}. The record was kept so you can retry.`)
  }

  // 2. Delete DB row.
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', doc.id)

  if (dbError) {
    throw new Error(
      `Document file was removed from storage, but deleting the record failed: ${dbError.message}. Please retry to clear the record.`,
    )
  }
}
