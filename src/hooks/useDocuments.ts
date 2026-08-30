/**
 * useDocuments — React hook for the Documents feature.
 *
 * Follows the exact same pattern as useVault():
 *   - string-based message for user-visible errors
 *   - boolean loading/uploading states
 *   - local state updated after confirmed server operations
 *
 * This hook is separate from useVault() to keep both hooks focused.
 */

import { useState, useCallback } from 'react'
import {
  listDocuments,
  uploadDocument,
  updateDocumentMetadata as updateDocumentMetadataRecord,
  deleteDocument,
  validateDocumentFile,
} from '../lib/documents'
import { supabase } from '../lib/supabase'
import { sortTrashedByDeletedAt } from '../lib/trash'
import type { DocumentCategory, VaultDocument } from '../types/app'

export function useDocuments() {
  const [documents, setDocuments] = useState<VaultDocument[]>([])
  const [trashedDocuments, setTrashedDocuments] = useState<VaultDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      // Fetched unfiltered and split client-side: deleted rows stay restorable
      // without needing a `.not('deleted_at','is',null)` filter query.
      const docs = await listDocuments()
      setDocuments(docs.filter((doc) => !doc.deleted_at))
      setTrashedDocuments(sortTrashedByDeletedAt(docs.filter((doc) => doc.deleted_at)))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load documents.')
    } finally {
      setLoading(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Add
  // ---------------------------------------------------------------------------

  const addDocument = useCallback(
    async (
      file: File,
      name: string,
      category: DocumentCategory,
    ): Promise<VaultDocument | null> => {
      const validationError = validateDocumentFile(file)
      if (validationError) {
        setMessage(validationError)
        return null
      }
      if (!name.trim()) {
        setMessage('Document name is required.')
        return null
      }

      setUploading(true)
      setMessage('')
      try {
        const doc = await uploadDocument(file, name, category)
        setDocuments((current) => [doc, ...current])
        return doc
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Upload failed.')
        return null
      } finally {
        setUploading(false)
      }
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Edit metadata (name + category only — the Storage object is untouched).
  // Local state is updated ONLY after Supabase confirms the row was updated.
  // RLS (`documents_update_own`) protects the row server-side.
  // ---------------------------------------------------------------------------

  const updateDocument = useCallback(
    async (
      doc: VaultDocument,
      name: string,
      category: DocumentCategory,
    ): Promise<{ ok: boolean; error?: string }> => {
      setMessage('')
      try {
        const updated = await updateDocumentMetadataRecord(doc, name, category)
        setDocuments((current) => current.map((d) => (d.id === updated.id ? updated : d)))
        setTrashedDocuments((current) => current.map((d) => (d.id === updated.id ? updated : d)))
        return { ok: true }
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Could not save changes.'
        setMessage(error)
        return { ok: false, error }
      }
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Delete → Recently Deleted (soft). The storage object is KEPT so the record
  // can be restored; it is only removed on a permanent purge.
  // ---------------------------------------------------------------------------

  const removeDocument = useCallback(async (doc: VaultDocument): Promise<boolean> => {
    setMessage('')
    try {
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', doc.id)
        .select()
        .single()
      if (error) throw error
      setDocuments((current) => current.filter((d) => d.id !== doc.id))
      setTrashedDocuments((current) =>
        sortTrashedByDeletedAt([{ ...doc, deleted_at: new Date().toISOString() }, ...current]),
      )
      return true
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Delete failed.')
      return false
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Restore from Recently Deleted
  // ---------------------------------------------------------------------------

  const restoreDocument = useCallback(async (doc: VaultDocument): Promise<boolean> => {
    setMessage('')
    try {
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: null })
        .eq('id', doc.id)
        .select()
        .single()
      if (error) throw error
      setTrashedDocuments((current) => current.filter((d) => d.id !== doc.id))
      setDocuments((current) => [{ ...doc, deleted_at: null }, ...current])
      return true
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Restore failed.')
      return false
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Permanent delete — storage object first, then the DB row (reuses the existing
  // hard-delete helper so orphan-protection semantics stay identical).
  // ---------------------------------------------------------------------------

  const purgeDocument = useCallback(async (doc: VaultDocument): Promise<boolean> => {
    setMessage('')
    try {
      await deleteDocument(doc)
      setTrashedDocuments((current) => current.filter((d) => d.id !== doc.id))
      return true
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Delete failed.')
      return false
    }
  }, [])

  return {
    documents,
    trashedDocuments,
    loading,
    uploading,
    message,
    setMessage,
    load,
    addDocument,
    updateDocument,
    removeDocument,
    restoreDocument,
    purgeDocument,
  }
}
