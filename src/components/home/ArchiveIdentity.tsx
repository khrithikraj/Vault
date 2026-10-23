import { Lock, User } from 'lucide-react'
import { AnimatedNumber } from '../AnimatedNumber'

type ArchiveIdentityProps = {
  savedCount: number
  doneCount: number
  onOpenAccount: () => void
  preview?: boolean
}

/**
 * V2 — Archive identity header.
 *
 * PHONE (< 640px) — one quiet row, nothing crowding it:
 *
 *   (o) RAJ'S VAULT                                   (person)
 *
 *   The brand is a single unbroken line, "Private catalogue" is gone, and the
 *   account entry point is the icon alone (its accessible name and tooltip are
 *   unchanged). The saved/done tallies are NOT here on a phone — they live in
 *   the `VaultStatusCapsule` under the header.
 *
 * WIDE (>= 640px) — unchanged two-column hierarchy, each column owning its
 * primary label plus subordinate metadata tucked underneath:
 *
 *   RAJ'S VAULT                        ACCOUNT
 *   Private catalogue                  22 SAVED | 1 DONE
 */
export function ArchiveIdentity({
  savedCount,
  doneCount,
  onOpenAccount,
  preview = false,
}: ArchiveIdentityProps) {
  const accountLabel = preview ? 'Preview' : 'Account'

  return (
    <header className="flex items-center justify-between gap-3 sm:items-start">
      <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
        <div
          aria-hidden="true"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center"
        >
          {/* Outer ring */}
          <span className="absolute inset-0 rounded-full border border-ink/12" />
          {/* Inner fill */}
          <span className="absolute inset-1.5 rounded-full bg-accent/8" />
          <Lock size={15} className="relative text-accent" strokeWidth={2} />
        </div>

        <div className="min-w-0">
          <h1
            className="vault-page-title min-w-0 text-ink"
            aria-label="Raj's Vault"
          >
            {/* Phone: one single line, never wrapping. */}
            <span className="block whitespace-nowrap sm:hidden">Raj&apos;s Vault</span>
            {/* Wide: the original stacked treatment. */}
            <span className="hidden sm:block">Raj&apos;s</span>
            <span className="hidden sm:block text-ink-soft/70">Vault</span>
          </h1>
          <p className="vault-meta mt-1.5 hidden text-ink-soft/60 sm:mt-2 sm:block">
            Private catalogue
          </p>
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={onOpenAccount}
          className="vault-label group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 sm:h-auto sm:w-auto sm:shrink sm:items-center sm:gap-1.5 sm:rounded sm:py-1.5 sm:pl-2 sm:pr-1.5 sm:text-ink-soft sm:transition-colors sm:hover:text-ink sm:active:scale-100"
          aria-label={preview ? 'Preview mode account panel' : 'Account settings'}
          title={preview ? 'Preview mode account panel' : 'Account settings'}
          data-tour="account"
        >
          {/* Mobile: counterpart to the lock badge */}
          <span className="absolute inset-0 rounded-full border border-ink/12 transition-colors group-hover:border-ink/25 sm:hidden" />
          <span className="absolute inset-1.5 rounded-full bg-accent/8 transition-colors group-hover:bg-accent/12 sm:hidden" />
          <User
            size={15}
            strokeWidth={2}
            className="relative text-accent sm:hidden"
            aria-hidden="true"
          />

          {/* Wide (sm+): text-button with quiet icon */}
          <User size={12} className="hidden sm:inline" aria-hidden="true" />
          <span className="hidden sm:inline">{accountLabel}</span>
        </button>

        {/* Subordinate tallies — phone reads them in the status capsule. */}
        <div className="vault-meta hidden items-center gap-1.5 text-ink-soft/55 sm:flex">
          <AnimatedNumber
            value={savedCount}
            className="vault-data text-ink"
          />
          <span className="vault-label text-ink-label">saved</span>
          <span className="h-3 w-px bg-ink/10" aria-hidden="true" />
          <AnimatedNumber
            value={doneCount}
            className="vault-data text-ink"
          />
          <span className="vault-label text-ink-label">done</span>
        </div>
      </div>
    </header>
  )
}
