/** Vertical "serial number" label fixed to the left edge — the Oryzo branding device that makes
 * the app read like a numbered artifact. Reads bottom-up; hidden on small screens. */
export function VerticalSerial({
  label = "RAJ'S — VAULT 01",
  className = '',
}: {
  label?: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`text-micro pointer-events-none fixed left-4 top-1/2 z-20 hidden -translate-y-1/2 rotate-180 text-ink-soft/50 lg:block ${className}`}
      style={{ writingMode: 'vertical-rl' }}
    >
      {label}
    </span>
  )
}
