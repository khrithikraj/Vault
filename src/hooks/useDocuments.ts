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
  deleteDocument,
  validateDocumentFile,
} from '../lib/documents'
import type { DocumentCategory, VaultDocument } from '../types/app'

export function useDocuments() {
  const [documents, setDocuments] = useState<VaultDocument[]>([])
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
      const docs = await listDocuments()
      setDocuments(docs)
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
  // Delete
  // ---------------------------------------------------------------------------

  const removeDocument = useCallback(async (doc: VaultDocument): Promise<boolean> => {
    setMessage('')
    try {
      await deleteDocument(doc)
      setDocuments((current) => current.filter((d) => d.id !== doc.id))
      return true
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Delete failed.')
      return false
    }
  }, [])

  return {
    documents,
    loading,
    uploading,
    message,
    setMessage,
    load,
    addDocument,
    removeDocument,
  }
}
