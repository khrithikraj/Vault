import type { ReactNode } from 'react'
import { cn } from '../../design/cn'

/**
 * VaultEmptyState — the centered empty state (icon + title + copy + action).
 * Standardizes the "nothing here yet" pattern used across sections.
 */
type VaultEmptyStateProps = {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function VaultEmptyState({ icon, title, description, action, className }: VaultEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 p-10 text-center', className)}>
      {icon ? (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-border-dash bg-cloud/60 text-ink-soft">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
