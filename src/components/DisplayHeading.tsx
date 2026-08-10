import type { ReactNode } from 'react'

type DisplayHeadingProps = {
  as?: 'h1' | 'h2' | 'h3'
  children: ReactNode
  className?: string
  /** Optional eyebrow/folio tag rendered above the display line, e.g. "01 — Capture". */
  eyebrow?: ReactNode
}

/** The giant editorial display heading (uppercase, weight 500, line-height 0.9 — the Oryzo
 * sculptural block). Optionally pairs with a small uppercase eyebrow/folio above it. */
export function DisplayHeading({
  as: Tag = 'h1',
  children,
  className = '',
  eyebrow,
}: DisplayHeadingProps) {
  return (
    <div className={className}>
      {eyebrow ? (
        <div className="text-micro mb-4 flex items-center gap-3 text-ink-soft">
          {eyebrow}
          <span className="bg-ink/30 h-px w-8" aria-hidden="true" />
        </div>
      ) : null}
      <Tag className="text-display">{children}</Tag>
    </div>
  )
}
