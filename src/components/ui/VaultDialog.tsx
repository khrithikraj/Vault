import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '../../design/cn'
import { layers } from '../../design/layers'
import { motionTokens } from '../../design/motion'
import { VaultIconButton } from './VaultButton'
import { VaultHeading } from './VaultTypography'

/**
 * VaultDialog — the shared overlay/modal/sheet layer.
 *
 * Standardizes the backdrop + motion panel pattern that was previously
 * copy-pasted across 8+ overlay components with slightly different springs
 * and backdrop opacities. Use `variant` to switch between:
 *   - dialog (default): centered, springs in with a scale/pop
 *   - sheet: docked to the bottom, slides up (mobile-friendly)
 *
 * Fully controlled via `open` / `onClose`. Closes on Escape; renders a
 * close icon button by default when `showClose` is set.
 */
type VaultDialogProps = {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  /** Centered dialog, or bottom-docked sheet. */
  variant?: 'dialog' | 'sheet'
  /** Backdrop opacity 0-1 ('0.75' matches the most common V1 value). */
  backdropOpacity?: number
  showClose?: boolean
  closeLabel?: string
  className?: string
  bodyClassName?: string
  /** Extra content rendered in the footer. */
  footer?: ReactNode
  children?: ReactNode
  /** Respect reduced-motion: set false only when a screen needs full control. */
  honorReducedMotion?: boolean
}

const backdropTransition = { duration: 200, ease: 'easeOut' } as const

export function VaultDialog({
  open,
  onClose,
  title,
  variant = 'dialog',
  backdropOpacity = 0.75,
  showClose = false,
  closeLabel = 'Close',
  className,
  bodyClassName,
  footer,
  children,
  honorReducedMotion = true,
}: VaultDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const isSheet = variant === 'sheet'
  const panelMotion = honorReducedMotion ? (isSheet ? motionTokens.sheet : motionTokens.overlay) : { duration: 0 }

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 flex overflow-y-auto"
          style={{ zIndex: layers.overlay }}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
        >
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            onClick={onClose}
            className="absolute inset-0 bg-black"
            style={{ opacity: backdropOpacity }}
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: isSheet ? 1 : 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isSheet ? 40 : 16, scale: isSheet ? 1 : 0.96 }}
            transition={panelMotion}
            style={{ transformPerspective: 1200 }}
            className={cn('relative mx-auto my-auto w-full p-4', className)}
          >
            <div className="vault-surface-overlay w-full rounded">
              {title || showClose ? (
                <div className="flex items-start justify-between gap-3 border-b border-border-dash p-5">
                  {title ? (
                    <VaultHeading as="h3" className="pt-1">
                      {title}
                    </VaultHeading>
                  ) : null}
                  {showClose ? (
                    <VaultIconButton
                      icon={X}
                      label={closeLabel}
                      onClick={onClose}
                      className="-mr-1 -mt-1"
                    />
                  ) : null}
                </div>
              ) : null}
              <div className={cn('p-5', bodyClassName)}>{children}</div>
              {footer ? (
                <div className="flex items-center justify-end gap-3 border-t border-border-dash p-4">
                  {footer}
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
