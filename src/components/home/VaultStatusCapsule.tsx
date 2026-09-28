import { AnimatedNumber } from '../AnimatedNumber'

type VaultStatusCapsuleProps = {
  savedCount: number
  doneCount: number
}

/**
 * Fixed Vault status capsule (phone only).
 *
 * A small, persistent status object parked directly under the Vault identity —
 * a dark pill with a hairline rim and a whisper of depth. It borrows the
 * "floating island" gesture already established by `DynamicIsland`, but is
 * deliberately its own thing: quieter, always present, and carrying the
 * catalogue's saved/done tallies rather than a transient message.
 *
 * It is rendered inside the `.vault-chrome` header wrapper (see
 * `AuthenticatedPublication`), which is ordinary document flow, so the capsule
 * sits directly under the identity it belongs to and scrolls away with the
 * header and the catalogue as one. Purely presentational — no button semantics,
 * because the tallies are a read-out, not an action.
 */
export function VaultStatusCapsule({ savedCount, doneCount }: VaultStatusCapsuleProps) {
  return (
    // `mx-[calc(50%_-_50vw)]` makes this row exactly 100vw wide and centred on the
    // viewport, so the pill is centred on the *screen* rather than on whatever the
    // page column happens to measure. That keeps it visually balanced even though
    // the Vault title and the account icon are very different widths — the pill is
    // not centred between them, it is centred on the screen.
    //
    // `mt-4` is half the search's own margin, so the air above the pill and the
    // air below it measure the same and the row still clears the identity rather
    // than crowding it.
    <div className="mx-[calc(50%_-_50vw)] mt-4 flex justify-center sm:hidden">
      <p
        className="vault-capsule inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-1"
        aria-label={`${savedCount} saved, ${doneCount} done`}
      >
        <span className="flex shrink-0 items-baseline gap-1">
          <AnimatedNumber
            value={savedCount}
            className="vault-meta font-display text-[10px] font-semibold tabular-nums text-ink"
          />
          <span className="vault-meta text-[9px] text-ink-soft/60">saved</span>
        </span>

        <span className="h-2.5 w-px shrink-0 bg-ink/12" aria-hidden="true" />

        <span className="flex shrink-0 items-baseline gap-1">
          <AnimatedNumber
            value={doneCount}
            className="vault-meta font-display text-[10px] font-semibold tabular-nums text-ink"
          />
          <span className="vault-meta text-[9px] text-ink-soft/60">done</span>
        </span>
      </p>
    </div>
  )
}
