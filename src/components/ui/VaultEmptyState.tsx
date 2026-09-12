import type { ReactNode } from 'react'
import { cn } from '../../design/cn'

/**
 * A dashed, quiet placeholder for first-use and filtered-empty states.
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
    <div
      className={cn(
        'flex min-h-40 flex-col items-center justify-center gap-3 border border-dashed border-ink/10 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-1 flex h-10 w-10 items-center justify-center border border-border-dash text-ink-soft">
          {icon}
        </div>
      ) : null}
      <p className="vault-meta text-ink-soft/55">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-soft/70">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
