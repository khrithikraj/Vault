import { Lock, LogOut } from 'lucide-react'
import { AnimatedNumber } from '../AnimatedNumber'

type ArchiveIdentityProps = {
  savedCount: number
  doneCount: number
  onSignOut: () => void
  preview?: boolean
}

/**
 * V2 — Archive identity header.
 *
 * Compact editorial brandmark. A two-line wordmark ("RAJ'S" / "VAULT")
 * paired with live tallies and a quiet sign-out action.
 * Reads as an expensive archival colophon — not a marketing hero banner.
 *
 * The lock icon reinforces the private/secure character of the archive.
 */
export function ArchiveIdentity({
  savedCount,
  doneCount,
  onSignOut,
  preview = false,
}: ArchiveIdentityProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      {/* Brandmark — lock glyph + stacked wordmark */}
      <div className="flex min-w-0 items-center gap-3.5">
        {/* Archive sigil */}
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

        {/* Wordmark */}
        <div className="min-w-0">
          <p
            className="font-display text-[1.35rem] font-semibold uppercase leading-[0.88] tracking-[0.09em] text-ink sm:text-[1.6rem]"
            aria-label="Raj's Vault"
          >
            Raj&apos;s
          </p>
          <p className="font-display text-[1.35rem] font-semibold uppercase leading-[0.88] tracking-[0.22em] text-ink-soft/60 sm:text-[1.6rem]">
            Vault
          </p>
        </div>
      </div>

      {/* Right column — tallies + sign-out */}
      <div className="flex shrink-0 flex-col items-end gap-2.5">
        {/* Live counts */}
        <div className="flex items-baseline gap-4">
          <span className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={savedCount}
              className="font-display text-base font-semibold tabular-nums text-ink sm:text-lg"
            />
            <span className="vault-meta text-ink-soft/55">saved</span>
          </span>
          <span className="h-4 w-px bg-ink/10 self-center" aria-hidden="true" />
          <span className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={doneCount}
              className="font-display text-base font-semibold tabular-nums text-ink sm:text-lg"
            />
            <span className="vault-meta text-ink-soft/55">done</span>
          </span>
        </div>

        {/* Sign-out / exit preview */}
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft/40 transition-colors hover:text-ink-soft"
          aria-label={preview ? 'Exit preview mode' : 'Sign out of Raj\'s Vault'}
        >
          <LogOut size={10} aria-hidden="true" />
          {preview ? 'Exit preview' : 'Sign out'}
        </button>
      </div>
    </header>
  )
}
