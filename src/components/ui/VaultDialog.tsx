import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '../../design/cn'
import { layers } from '../../design/layers'
import { motionTokens } from '../../design/motion'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
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
  surfaceClassName?: string
  bodyClassName?: string
  /** Extra content rendered in the footer. */
  footer?: ReactNode
  children?: ReactNode
  initialFocusRef?: RefObject<HTMLElement | null>
  returnFocusRef?: RefObject<HTMLElement | null>
  /** Respect reduced-motion: set false only when a screen needs full control. */
  honorReducedMotion?: boolean
}

const backdropTransition = { duration: 0.2, ease: 'easeOut' } as const
const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

let bodyScrollLockCount = 0
let bodyOverflowBeforeLock = ''

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  bodyScrollLockCount += 1
}

function unlockBodyScroll() {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = bodyOverflowBeforeLock
  }
}

export function VaultDialog({
  open,
  onClose,
  title,
  variant = 'dialog',
  backdropOpacity = 0.75,
  showClose = false,
  closeLabel = 'Close',
  className,
  surfaceClassName,
  bodyClassName,
  footer,
  children,
  initialFocusRef,
  returnFocusRef,
  honorReducedMotion = true,
}: VaultDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const returnFocusTarget = returnFocusRef?.current ?? previouslyFocused
    const overlay = overlayRef.current
    const dialog = dialogRef.current
    const parent = overlay?.parentElement
    const backgroundSiblings = parent
      ? Array.from(parent.children).filter((element): element is HTMLElement => (
          element instanceof HTMLElement && element !== overlay
        ))
      : []
    const previouslyInert = backgroundSiblings.map((element) => element.inert)

    backgroundSiblings.forEach((element) => {
      element.inert = true
    })
    lockBodyScroll()

    const focusFrame = window.requestAnimationFrame(() => {
      const focusable = dialog?.querySelector<HTMLElement>(focusableSelector)
      ;(initialFocusRef?.current ?? focusable ?? dialog)?.focus()
    })

    const onKey = (event: KeyboardEvent) => {
      const openDialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
      if (openDialogs[openDialogs.length - 1] !== dialog) return

      if (event.key === 'Escape' && onClose) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKey)
      unlockBodyScroll()
      backgroundSiblings.forEach((element, index) => {
        element.inert = previouslyInert[index]
      })
      returnFocusTarget?.focus()
    }
  }, [initialFocusRef, open, onClose, returnFocusRef])

  const isSheet = variant === 'sheet'
  const disableMotion = honorReducedMotion && reducedMotion
  const panelMotion = disableMotion ? { duration: 0 } : (isSheet ? motionTokens.sheet : motionTokens.overlay)

  return (
    <AnimatePresence>
      {open ? (
        <div
          ref={overlayRef}
          className="fixed inset-0 flex overflow-y-auto"
          style={{ zIndex: layers.modal }}
        >
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={disableMotion ? { duration: 0 } : backdropTransition}
            onClick={onClose}
            className="absolute inset-0 bg-black"
            style={{ opacity: backdropOpacity }}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : closeLabel}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: isSheet ? 1 : 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isSheet ? 40 : 16, scale: isSheet ? 1 : 0.96 }}
            transition={panelMotion}
            style={{ transformPerspective: 1200 }}
            className={cn('relative mx-auto my-auto w-full p-4', className)}
          >
            <div className={cn('vault-surface-overlay w-full rounded', surfaceClassName)}>
              {title || showClose ? (
                <div className="flex items-start justify-between gap-3 border-b border-border-dash p-5">
                  {title ? (
                    <VaultHeading as="h2" id={titleId} className="pt-1">
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
