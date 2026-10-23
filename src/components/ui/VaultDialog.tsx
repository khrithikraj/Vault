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
 * Layout contract (owns it so consumers do not have to):
 *   overlay (also the layout shell) > panel (capped by the shell) > surface
 *   (flex column) > header (shrink-0) + body (flex-1, own scroll) + footer
 *   (shrink-0).
 * The panel is capped by the overlay's height, so on Android the dialog can
 * never grow past the space left by the soft keyboard, and the body is the
 * only part that scrolls. Consumers only override padding/styling.
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
  /** Replaces the default body padding — the body is the scrolling region. */
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
          className={cn(
            // The overlay doubles as the layout shell: a fixed, full-height
            // flex column gives the panel a definite height to be capped by,
            // so on Android a dialog can never grow past the space the soft
            // keyboard left. `min-h-0` on the panel lets it shrink instead of
            // overflowing (which is what let dialogs run under the keyboard).
            // Sheets dock to the bottom via the consumer's mt-auto className;
            // dialogs centre via items-center justify-center.
            // px-3 provides a safe 12 px gutter at 360 px viewport widths.
            'fixed inset-0 flex h-full w-full flex-col overflow-x-hidden overflow-y-auto px-3 py-4',
            isSheet ? '' : 'items-center justify-center',
          )}
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
            data-dialog-panel=""
            className={cn('relative flex w-full min-h-0 flex-col', className)}
          >
            <div
              data-dialog-surface=""
              className={cn(
                'vault-surface-overlay flex w-full min-h-0 flex-col overflow-hidden rounded',
                surfaceClassName,
              )}
            >
              {title || showClose ? (
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-dash p-4 sm:p-5">
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
                      className="-mr-1 -mt-1 shrink-0"
                    />
                  ) : null}
                </div>
              ) : null}
              <div
                data-dialog-body=""
                className={cn(
                  'min-w-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain',
                  bodyClassName ?? 'p-4 sm:p-5',
                )}
              >
                {children}
              </div>
              {footer ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-dash p-3 sm:gap-3 sm:p-4">
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
