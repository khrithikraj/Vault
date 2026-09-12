/**
 * DocumentEditDialog — small modal for editing ONLY a document's name + category.
 *
 * The stored file is never touched here — metadata only.
 *
 * Flow: validate locally → call onSave (which updates Supabase server-side and
 * only touches local state after a confirmed response) → close on success. On
 * failure the dialog stays open and shows the returned error; Cancel discards
 * the entered values.
 */

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { VaultSelect } from '../VaultSelect'
import { VaultButton } from '../ui/VaultButton'
import { VaultDialog } from '../ui/VaultDialog'
import { VaultInput } from '../ui/VaultInput'
import { DOCUMENT_CATEGORIES } from '../../types/app'
import type { DocumentCategory, VaultDocument } from '../../types/app'

type SaveResult = { ok: boolean; error?: string }

type DocumentEditDialogProps = {
  doc: VaultDocument | null
  onSave: (name: string, category: DocumentCategory) => Promise<SaveResult>
  onCancel: () => void
}

const CATEGORY_OPTIONS = DOCUMENT_CATEGORIES.map((cat) => ({ value: cat, label: cat }))

export function DocumentEditDialog({ doc, onSave, onCancel }: DocumentEditDialogProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('Identity')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Reset the form whenever the dialog opens / switches document.
  useEffect(() => {
    if (doc) {
      setName(doc.name)
      setCategory(doc.category)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!name.trim()) {
      setError('Document name is required.')
      return
    }
    setError(null)
    setSaving(true)
    const result = await onSave(name.trim(), category)
    setSaving(false)
    if (result.ok) {
      onCancel()
    } else {
      setError(result.error ?? 'Could not save changes.')
    }
  }

  return (
    <VaultDialog
      open={doc !== null}
      onClose={saving ? undefined : onCancel}
      title="Edit document"
      showClose={!saving}
      closeLabel="Cancel edit"
      className="max-w-sm"
      initialFocusRef={nameInputRef}
      footer={
        <>
          <VaultButton
            type="submit"
            form="document-edit-form"
            variant="solid"
            size="md"
            disabled={saving}
            className="flex-1"
          >
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save changes'}
          </VaultButton>
          <VaultButton type="button" variant="ghost" size="md" onClick={onCancel} disabled={saving}>
            Cancel
          </VaultButton>
        </>
      }
    >
      {doc ? (
        <>
          <p className="mb-5 text-xs leading-relaxed text-ink-soft">
            Only the name and category change. The stored file is untouched.
          </p>
          <form id="document-edit-form" onSubmit={handleSubmit} className="grid gap-4">
              <div>
                <label
                  htmlFor="doc-edit-name"
                  className="text-xs font-semibold uppercase tracking-widest text-ink-soft"
                >
                  Document name *
                </label>
                <VaultInput
                  ref={nameInputRef}
                  id="doc-edit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Driving Licence 2026"
                  required
                  maxLength={120}
                  className="mt-1.5 rounded-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  Category *
                </label>
                <VaultSelect<DocumentCategory>
                  options={CATEGORY_OPTIONS}
                  value={category}
                  onSelect={setCategory}
                  ariaLabel="Document category"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded border border-red-900/50 bg-red-950/40 px-3 py-2.5 text-xs text-red-400">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

            </form>
        </>
      ) : null}
    </VaultDialog>
  )
}