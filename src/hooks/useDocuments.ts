/**
 * useDocuments — React hook for the Documents feature.
 *
 * Follows the exact same pattern as useVault():
 *   - string-based message for user-visible errors
 *   - boolean loading/uploading states
 *   - local state updated after confirmed server operations
 *
 * This hook is separate from useVault() to keep both hooks focused.
 *
 * `sessionUserId` is the id of the user currently signed in (null when signed out).
 * Documents and trashedDocuments are exposed only while that id matches the owner the
 * stored arrays were loaded for, so a previous user's documents can never be returned
 * (and therefore rendered) under the next user's session — even on the single render
 * between the session state update and App's reset() effect.
 */

import { useState, useCallback, useRef } from 'react'
import {
  listDocuments,
  uploadDocument,
  updateDocumentMetadata as updateDocumentMetadataRecord,
  deleteDocument,
  validateDocumentFile,
} from '../lib/documents'
import {
  advanceSessionGeneration,
  createSessionGeneration,
  emptyDocumentState,
  isSessionStateVisible,
  type SessionGeneration,
} from '../lib/sessionGeneration'
import { supabase } from '../lib/supabase'
import { sortTrashedByDeletedAt } from '../lib/trash'
import type { DocumentCategory, VaultDocument } from '../types/app'

export function useDocuments(sessionUserId: string | null) {
  const [documents, setDocuments] = useState<VaultDocument[]>([])
  const [trashedDocuments, setTrashedDocuments] = useState<VaultDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  // The session owner is claimed directly from the passed sessionUserId rather than
  // only via App's reset() effect, so the boundary is established from the prop before
  // any load effect can capture a stale, unclaimed generation (owner null).
  const sessionGenerationRef = useRef<SessionGeneration>(
    advanceSessionGeneration(createSessionGeneration(), sessionUserId).next,
  )

  // Render-time privacy gate. The stored arrays may belong to an older session until
  // reset() runs after the user change — before that starts, report them as empty so a
  // previous user's documents are logically invisible from the very first render.
  const docsVisible = isSessionStateVisible(sessionGenerationRef.current.owner, sessionUserId)
  const visibleDocuments = docsVisible ? documents : []
  const visibleTrashedDocuments = docsVisible ? trashedDocuments : []

  /**
   * Advance the session boundary (App calls this on any auth user change). Bumps the
   * generation and synchronously clears documents so a previous user's documents can
   * never bleed into the next session, and in-flight loads from the old session go stale.
   */
  const reset = useCallback((userId: string | null) => {
    const { next, changed } = advanceSessionGeneration(sessionGenerationRef.current, userId)
    sessionGenerationRef.current = next
    if (!changed) {
      return
    }
    const cleared = emptyDocumentState()
    setDocuments(cleared.documents)
    setTrashedDocuments(cleared.trashedDocuments)
    setLoading(false)
    setMessage('')
  }, [])

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    // Staleness is identity-based: a load may only write while the owner of the stored
    // document state is still the session user this load was started for. This keeps an
    // initial signed-in load current even when the boundary reset for the SAME user runs
    // after the load starts (cold signed-in: load → reset claims user A → still current),
    // while a load belonging to a previous user or the signed-out state goes stale the
    // moment the owner changes.
    const startedForUser = sessionUserId
    const stale = () => sessionGenerationRef.current.owner !== startedForUser

    setLoading(true)
    setMessage('')
    try {
      // Fetched unfiltered and split client-side: deleted rows stay restorable
      // without needing a `.not('deleted_at','is',null)` filter query.
      const docs = await listDocuments()
      // The session moved on while this request was in flight — drop the response so
      // a previous user's documents can never populate the current session.
      if (stale()) {
        return
      }
      setDocuments(docs.filter((doc) => !doc.deleted_at))
      setTrashedDocuments(sortTrashedByDeletedAt(docs.filter((doc) => doc.deleted_at)))
    } catch (err) {
      if (stale()) {
        return
      }
      setMessage(err instanceof Error ? err.message : 'Failed to load documents.')
    } finally {
      if (!stale()) {
        setLoading(false)
      }
    }
  }, [sessionUserId])

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
      isFavorite?: boolean,
    ): Promise<{ ok: boolean; error?: string }> => {
      setMessage('')
      try {
        const updated = await updateDocumentMetadataRecord(doc, name, category, isFavorite)
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

  const toggleFavorite = useCallback(async (doc: VaultDocument): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({ is_favorite: !doc.is_favorite })
        .eq('id', doc.id)
        .select()
        .single()
      if (error) throw error
      const updated = data as VaultDocument
      setDocuments((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
      setTrashedDocuments((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
      return true
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not update favorite.')
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
    documents: visibleDocuments,
    trashedDocuments: visibleTrashedDocuments,
    loading,
    uploading,
    message,
    setMessage,
    reset,
    load,
    addDocument,
    updateDocument,
    toggleFavorite,
    removeDocument,
    restoreDocument,
    purgeDocument,
  }
}
