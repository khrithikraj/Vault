import type { HTMLAttributes } from 'react'
import { cn } from '../../design/cn'

/**
 * VaultSkeleton — a subtle loading placeholder surface.
 * Respects reduced motion by swapping the pulse for a static dim state.
 */
export function VaultSkeleton({
  className,
  'aria-label': ariaLabel,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role={ariaLabel ? 'status' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn(
        'h-32 animate-pulse border border-dashed border-ink/10 bg-ink/[0.02]',
        'motion-reduce:animate-none motion-reduce:opacity-60',
        className,
      )}
      {...rest}
    />
  )
}
