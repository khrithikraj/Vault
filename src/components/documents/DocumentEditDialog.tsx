/**
 * DocumentEditDialog — small modal for editing ONLY a document's name + category.
 *
 * Mirrors DocumentDeleteDialog's overlay pattern (AnimatePresence → backdrop →
 * panel) and reuses the existing design tokens (term-panel, term-brackets,
 * term-input, VaultSelect, term-btn-primary). The stored file is never touched
 * here — metadata only.
 *
 * Flow: validate locally → call onSave (which updates Supabase server-side and
 * only touches local state after a confirmed response) → close on success. On
 * failure the dialog stays open and shows the returned error; Cancel discards
 * the entered values.
 */

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Loader2, Pencil, X } from 'lucide-react'
import { VaultSelect } from '../VaultSelect'
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

  // Reset the form whenever the dialog opens / switches document.
  useEffect(() => {
    if (doc) {
      setName(doc.name)
      setCategory(doc.category)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  // Escape cancels (matches all other overlays).
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])

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
    if (!result.ok) {
      setError(result.error ?? 'Could not save changes.')
    }
  }

  return (
    <AnimatePresence>
      {doc && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { if (!saving) onCancel() }}
        >
          <motion.div
            className="term-panel term-brackets relative w-full max-w-sm overflow-hidden rounded p-6"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="term-chip absolute right-3 top-3 rounded-full p-1.5 text-ink-soft hover:text-ink disabled:opacity-40"
              aria-label="Cancel edit"
            >
              <X size={15} />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <Pencil
                size={18}
                strokeWidth={2}
                className="mt-0.5 shrink-0 text-accent"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-display text-base font-bold uppercase tracking-tight text-ink">
                  Edit document
                </h2>
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  Only the name and category change — the stored file is untouched.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
              <div>
                <label
                  htmlFor="doc-edit-name"
                  className="text-xs font-semibold uppercase tracking-widest text-ink-soft"
                >
                  Document name *
                </label>
                <input
                  id="doc-edit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Driving Licence 2026"
                  required
                  maxLength={120}
                  autoFocus
                  className="term-input mt-1.5 w-full rounded-none px-3 py-2.5 text-sm text-ink"
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

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="term-btn-primary flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wide disabled:opacity-40"
                >
                  {saving
                    ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
                    : 'Save changes'
                  }
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={saving}
                  className="rounded-outline border border-ink/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-soft hover:text-ink disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}