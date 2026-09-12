import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Check, KeyRound, LogOut, Loader2, User } from 'lucide-react'
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

/** Profile / account settings — name, email, change-password, sign-out, about. */
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
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  useEffect(() => {
    if (open) {
      setName(typeof initialName === 'string' ? initialName : '')
      setNameSaved(false)
      setResetSent(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSaveName = async () => {
    if (!name.trim() || savingName) return
    setSavingName(true)
    try {
      await onUpdateDisplayName(name)
      setNameSaved(true)
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
      <VaultDialog open={open} onClose={onClose} title="Account" showClose variant="sheet">
        <div className="flex flex-col gap-5">
          {preview ? (
            <p className="rounded border border-dashed border-ink/25 bg-ink/5 px-3 py-2 text-xs text-ink-soft">
              You're in preview mode — nothing here is saved to a real account.
            </p>
          ) : null}

          {/* Display name */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink-soft">
              <User size={12} /> Display name
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="vault-input w-full min-w-0 flex-1 rounded-none px-3 py-2 text-sm text-ink"
              />
              <VaultButton
                variant="solid"
                size="sm"
                onClick={() => void handleSaveName()}
                disabled={savingName || !name.trim()}
              >
                {savingName ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : nameSaved ? (
                  <Check size={14} />
                ) : (
                  'Save'
                )}
              </VaultButton>
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Email
            </label>
            <p className="vault-input mt-1.5 w-full truncate rounded-none px-3 py-2 text-sm text-ink-soft opacity-70">
              {email || 'Preview session (no email)'}
            </p>
          </div>

          {/* Change password */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink-soft">
              <KeyRound size={12} /> Password
            </label>
            <div className="mt-1.5">
              <VaultButton
                variant="ghost"
                size="sm"
                onClick={() => void handleSendReset()}
                disabled={sendingReset || !email}
              >
                {sendingReset ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : resetSent ? (
                  <Check size={14} />
                ) : null}
                {resetSent ? 'Reset email sent' : 'Send password reset email'}
              </VaultButton>
            </div>
          </div>

          {/* Sign out */}
          <div className="border-t border-dashed border-ink/15 pt-4">
            <VaultButton
              variant="danger"
              size="sm"
              icon={LogOut}
              onClick={() => setConfirmSignOut(true)}
            >
              {preview ? 'Exit preview' : 'Sign out'}
            </VaultButton>
          </div>

          {/* About */}
          <div className="flex items-center justify-between">
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
