import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Check, KeyRound, Loader2, LogOut } from 'lucide-react'
import { VaultDialog } from './ui/VaultDialog'
import { VaultButton } from './ui/VaultButton'
import { ConfirmDialog } from './ConfirmDialog'

type AccountPanelProps = {
  open: boolean
  onClose: () => void
  session: Session | null
  preview: boolean
  onUpdateDisplayName: (name: string) => Promise<void>
  onResetPassword: (email: string) => Promise<void>
  onSignOut: () => void
  onReplayTour: () => void
}

const APP_VERSION = '1.0.0'

/** Profile / account sheet — identity first, then account details,
 * a quiet password-reset action, and sign-out. No decorative metadata. */
export function AccountPanel({
  open,
  onClose,
  session,
  preview,
  onUpdateDisplayName,
  onResetPassword,
  onSignOut,
  onReplayTour,
}: AccountPanelProps) {
  const email = session?.user?.email ?? ''
  const initialName = (session?.user?.user_metadata as Record<string, unknown> | undefined)?.full_name
  const [name, setName] = useState(typeof initialName === 'string' ? initialName : '')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  useEffect(() => {
    if (open) {
      setName(typeof initialName === 'string' ? initialName : '')
      setEditingName(false)
      setNameSaved(false)
      setResetSent(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const displayName = name.trim() || email.split('@')[0]?.trim() || ''

  const handleSaveName = async () => {
    if (!name.trim() || savingName) return
    setSavingName(true)
    try {
      await onUpdateDisplayName(name)
      setNameSaved(true)
      setEditingName(false)
      window.setTimeout(() => setNameSaved(false), 2500)
    } finally {
      setSavingName(false)
    }
  }

  const handleSendReset = async () => {
    if (!email || sendingReset) return
    setSendingReset(true)
    try {
      await onResetPassword(email)
      setResetSent(true)
    } finally {
      setSendingReset(false)
    }
  }

  return (
    <>
      <VaultDialog
        open={open}
        onClose={onClose}
        title="Account"
        showClose
        variant="sheet"
        bodyClassName="max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain"
      >
        <div className="flex flex-col gap-6">
          {preview ? (
            <p className="rounded border border-dashed border-ink/25 bg-ink/5 px-3 py-2 text-xs text-ink-soft">
              You're in preview mode — nothing here is saved to a real account.
            </p>
          ) : null}

          {/* Identity */}
          <header>
            <p className="vault-meta text-[10px] uppercase tracking-[0.2em] text-ink-soft/60">Account</p>
            {displayName ? (
              <h3 className="font-display mt-1.5 break-words text-2xl font-bold uppercase leading-none tracking-tight text-ink">
                {displayName}
              </h3>
            ) : null}
            {email ? (
              <p className="mt-2 break-all text-sm text-ink-soft">{email}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">No email on this session.</p>
            )}
          </header>

          {/* Account details */}
          <section className="border-t border-dashed border-ink/15 pt-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
              Account details
            </h4>

            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink">Display name</p>
              {editingName ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="vault-input w-full min-w-0 flex-1 rounded-none px-3 py-2 text-sm text-ink"
                  />
                  <VaultButton
                    variant="chip"
                    size="sm"
                    onClick={() => void handleSaveName()}
                    disabled={savingName || !name.trim()}
                  >
                    {savingName ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : nameSaved ? (
                      <Check size={14} />
                    ) : null}
                    Save
                  </VaultButton>
                  <VaultButton
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setName(typeof initialName === 'string' ? initialName : '')
                      setEditingName(false)
                    }}
                  >
                    Cancel
                  </VaultButton>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm text-ink-soft/80">
                    {displayName ? displayName : <em className="not-italic text-ink-soft/50">Not set</em>}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-ink-soft/70 transition-colors hover:text-ink"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink">Email</p>
              <p className="mt-1.5 truncate text-sm text-ink-soft/80">{email || '—'}</p>
            </div>
          </section>

          {/* Security */}
          <section className="border-t border-dashed border-ink/15 pt-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft">Security</h4>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink">Reset password</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft/80">
                  Send a password reset email
                </p>
              </div>
              <VaultButton
                variant="chip"
                size="sm"
                onClick={() => void handleSendReset()}
                disabled={sendingReset || !email || resetSent}
                className="shrink-0 uppercase"
              >
                {sendingReset ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : resetSent ? (
                  <>
                    <Check size={14} /> Email sent
                  </>
                ) : (
                  <>
                    <KeyRound size={14} /> Reset password
                  </>
                )}
              </VaultButton>
            </div>
          </section>

          {/* Sign out */}
          <section className="border-t border-dashed border-ink/15 pt-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft">Sign out</h4>
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="min-w-0 text-sm leading-relaxed text-ink-soft/80">
                {preview ? 'Exit preview mode. Nothing is saved to a real account.' : 'Sign out of Vault'}
              </p>
              <VaultButton
                variant="ghost"
                size="sm"
                icon={LogOut}
                onClick={() => setConfirmSignOut(true)}
                className="shrink-0 uppercase"
              >
                {preview ? 'Exit preview' : 'Sign out'}
              </VaultButton>
            </div>
          </section>

          {/* About */}
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => {
                onClose()
                onReplayTour()
              }}
              className="text-[11px] font-medium uppercase tracking-widest text-ink-soft/50 transition-colors hover:text-ink-soft"
            >
              Replay tour
            </button>
            <p className="text-[10px] uppercase tracking-widest text-ink-soft/40">
              Raj&apos;s Vault · v{APP_VERSION}
            </p>
          </div>
        </div>
      </VaultDialog>

      <ConfirmDialog
        open={confirmSignOut}
        title={preview ? 'Exit preview?' : 'Sign out?'}
        message={
          preview
            ? "You'll leave preview mode. Nothing was saved."
            : "You'll be signed out of Raj's Vault on this device."
        }
        confirmLabel={preview ? 'Exit preview' : 'Sign out'}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false)
          onClose()
          onSignOut()
        }}
      />
    </>
  )
}