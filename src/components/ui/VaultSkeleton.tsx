import type { HTMLAttributes } from 'react'
import { cn } from '../../design/cn'

/**
 * VaultSkeleton — a subtle loading placeholder surface.
 * Respects reduced motion by swapping the pulse for a static dim state.
 */
export function VaultSkeleton({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'term-panel h-32 animate-pulse rounded',
        'motion-reduce:animate-none motion-reduce:opacity-60',
        className,
      )}
      {...rest}
    />
  )
}
