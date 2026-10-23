import { useEffect, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import {
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  Plus,
  Lock,
  NotebookPen,
  StickyNote,
  Square,
} from 'lucide-react'
import { Atmosphere } from './Atmosphere'
import { CategoryIcon } from '../lib/icons'
import { fetchSharedItem } from '../lib/share'
import type { SharedItem, SharedNote, SharedSnapshot } from '../lib/share'

type SharedItemViewProps = {
  token: string
  signedIn: boolean
  onAddToVault: (shared: SharedSnapshot) => Promise<boolean>
  onBack: () => void
}

function FieldRows({ item }: { item: SharedItem }) {
  return (
    <dl className="mt-5 grid gap-3">
      {item.fields.map((field, index) => {
        const isUrl = field.value.kind === 'url'
        const isCurrency = field.value.kind === 'currency'
        return (
          <div
            key={`${field.label}-${index}`}
            className="flex flex-col gap-0.5 border-b border-ink/10 pb-3 last:border-0"
          >
            <dt className="vault-label text-ink-soft">
              {field.label}
            </dt>
            <dd className="vault-body-secondary break-words font-medium text-ink">
              {isCurrency ? '₹' : ''}
              {isUrl ? (
                <a
                  href={/^https?:\/\//i.test(field.value.value) ? field.value.value : `https://${field.value.value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent break-all underline hover:opacity-80"
                >
                  {field.value.value}
                </a>
              ) : (
                field.value.value
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function Checklist({ checklist }: { checklist: SharedNote['checklist'] }) {
  const done = checklist.filter((i) => i.done).length
  return (
    <div className="mt-4 rounded border border-ink/15 bg-ink/5 p-3.5">
      <p className="vault-label flex items-center gap-2 text-ink-soft">
        <NotebookPen size={13} /> Checklist ({done}/{checklist.length})
      </p>
      <ul className="mt-3 flex min-w-0 flex-col gap-2">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-center gap-2.5">
            <Square
              size={14}
              className={item.done ? 'text-accent' : 'text-ink-soft/50'}
              fill={item.done ? 'currentColor' : 'none'}
            />
            <span
              className={`vault-body-secondary min-w-0 break-words ${
                item.done ? 'text-ink-soft line-through' : 'text-ink'
              }`}
            >
              {item.text || 'Untitled'}
            </span>
            {item.done ? (
              <span className="vault-label shrink-0 rounded-sm border border-accent px-1  text-accent">
                ✓
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SharedItemView({ token, signedIn, onAddToVault, onBack }: SharedItemViewProps) {
  const [item, setItem] = useState<SharedSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setItem(null)
    fetchSharedItem(token).then((data) => {
      if (!active) return
      setItem(data)
      setLoading(false)
      if (!data) setError('This share link is invalid, revoked, or was deleted.')
    })
    return () => {
      active = false
    }
  }, [token])

  const handleAdd = useCallback(async () => {
    if (!item || added || adding) return
    setAdding(true)
    try {
      const ok = await onAddToVault(item)
      if (ok) setAdded(true)
    } finally {
      setAdding(false)
    }
  }, [item, added, adding, onAddToVault])

  const handleCopy = useCallback(() => {
    if (!item) return
    const url = `${window.location.origin}${window.location.pathname}`
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
    }
  }, [item])

  const isNote = item?.kind === 'note'
  const note = isNote ? (item as SharedNote) : null

  return (
    <main className="relative min-h-screen">
      <Atmosphere variant="void" />
      <div className="relative mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-10">
        <button
          type="button"
          onClick={onBack}
          className="vault-action mb-6 flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={13} /> Back
        </button>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-ink-soft">
            <Loader2 size={22} className="animate-spin" />
            <span className="vault-label">Loading share…</span>
          </div>
        ) : error || !item ? (
          <div className="vault-surface vault-brackets w-full rounded p-8 text-center">
            <h1 className="vault-section-title text-ink">
              Link not found
            </h1>
            <p className="vault-body-secondary mt-2 text-ink-soft">{error ?? 'Nothing to show.'}</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            className="vault-surface vault-brackets w-full overflow-hidden rounded"
            style={
              {
                '--vault-accent': isNote ? '#dc5000' : (item as SharedItem).category_color,
              } as React.CSSProperties
            }
          >
            {!isNote && (item as SharedItem).image_url ? (
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <img
                  src={(item as SharedItem).image_url!}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0" />
              </div>
            ) : null}

            <div className="p-6 sm:p-7">
              <p className="vault-meta mb-3 flex items-center gap-2 text-ink-soft">
                {isNote ? (
                  <>
                    <StickyNote size={15} className="text-accent" />
                    <span className="vault-label">Shared Note</span>
                  </>
                ) : (
                  <>
                    <CategoryIcon
                      icon={(item as SharedItem).category_icon}
                      color={(item as SharedItem).category_color}
                      size={15}
                    />
                    <span className="vault-label">{(item as SharedItem).category_name}</span>
                  </>
                )}
                <span className="text-ink-soft/50">·</span>
                <Lock size={11} className="text-ink-soft/50" />
                <span className="text-ink-soft/50">Shared by the vault owner</span>
              </p>

              <h1 className="vault-page-title text-ink">
                {item.title}
              </h1>

              {!isNote ? (
                <>
                  <FieldRows item={item as SharedItem} />
                  {item.notes ? (
                    <p className="vault-body mt-4 whitespace-pre-wrap border-t border-ink/10 pt-4 text-ink-soft">
                      {item.notes}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  {note?.notes ? (
                    <p className="vault-body mt-4 whitespace-pre-wrap border-t border-ink/10 pt-4 text-ink-soft">
                      {note.notes}
                    </p>
                  ) : null}
                  {note && note.checklist.length > 0 ? <Checklist checklist={note.checklist} /> : null}
                </>
              )}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleAdd()}
                  disabled={added || adding}
                  className="vault-btn-solid vault-action flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs disabled:opacity-50"
                >
                  {added ? (
                    <><Check size={13} /> Added to your vault</>
                  ) : adding ? (
                    <><Loader2 size={13} className="animate-spin" /> Adding…</>
                  ) : signedIn ? (
                    <><Plus size={13} /> Add to My Vault</>
                  ) : (
                    <><Plus size={13} /> Sign in to add this</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="vault-action flex items-center justify-center gap-1.5 rounded-full border border-ink/30 px-4 py-2.5 text-xs text-ink-soft hover:text-ink"
                >
                  {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy link</>}
                </button>
              </div>

              {!signedIn && !added ? (
                <p className="vault-meta mt-3 flex items-start gap-1.5 text-ink-soft">
                  <Lock size={11} className="mt-0.5 shrink-0" />
                  You'll be prompted to sign in to add this item to your own vault.
                </p>
              ) : null}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  )
}
