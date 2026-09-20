import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '../../design/cn'
import { layers } from '../../design/layers'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export type MoreActionItem = {
  id: string
  label: ReactNode
  icon?: LucideIcon
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
  divider?: boolean
  trailing?: ReactNode
  title?: string
}

type MoreActionsMenuProps = {
  triggerLabel: string
  items: MoreActionItem[]
  align?: 'left' | 'right'
  triggerRef?: Ref<HTMLButtonElement>
  className?: string
}

const PANEL_MARGIN = 8

/** Quiet ellipsis (⋯) overflow menu. Actions that would clutter a surface live here.
 *  The panel is portaled to <body> with fixed positioning so no `overflow` ancestor
 *  (cards, scrollable dialog bodies) can clip it, and it flips upward when there is
 *  no room below the trigger. */
export function MoreActionsMenu({
  triggerLabel,
  items,
  align = 'right',
  triggerRef: triggerRefProp,
  className,
}: MoreActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLUListElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()
  const reducedMotion = usePrefersReducedMotion()

  const navigableIndices = items
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index >= 0)

  const closeMenu = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const setTriggerRef = (node: HTMLButtonElement | null) => {
    ;(triggerRef as { current: HTMLButtonElement | null }).current = node
    if (!triggerRefProp) return
    if (typeof triggerRefProp === 'function') {
      ;(triggerRefProp as (node: HTMLButtonElement | null) => void)(node)
    } else {
      ;(triggerRefProp as { current: HTMLButtonElement | null }).current = node
    }
  }

  useEffect(() => {
    if (!open) return
    const onClickAway = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        setOpen(false)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeMenu(true)
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        setActiveIndex((currentIndex) => {
          if (navigableIndices.length === 0) return currentIndex
          if (event.key === 'Home') return navigableIndices[0]
          if (event.key === 'End') return navigableIndices[navigableIndices.length - 1]
          const positionInList = navigableIndices.indexOf(currentIndex)
          const offset = event.key === 'ArrowDown' ? 1 : -1
          const next =
            positionInList === -1 ? 0 : (positionInList + offset + navigableIndices.length) % navigableIndices.length
          return navigableIndices[next]
        })
        return
      }
      if ((event.key === 'Enter' || event.key === ' ') && document.activeElement !== triggerRef.current) {
        event.preventDefault()
        const item = items[activeIndex]
        if (item && !item.disabled) {
          item.onSelect()
          closeMenu(true)
        }
      }
    }
    document.addEventListener('mousedown', onClickAway)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onClickAway)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [activeIndex, items, navigableIndices, open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => itemRefs.current[activeIndex]?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [activeIndex, open])

  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return

    const place = () => {
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      const rect = trigger.getBoundingClientRect()

      let top = rect.bottom + PANEL_MARGIN
      const above = rect.top - height - PANEL_MARGIN
      const roomBelow = top + height <= window.innerHeight - PANEL_MARGIN
      if (!roomBelow && above >= PANEL_MARGIN) top = above
      top = Math.max(PANEL_MARGIN, Math.min(top, window.innerHeight - height - PANEL_MARGIN))

      const left = align === 'right' ? rect.right - width : rect.left
      const clampedLeft = Math.max(PANEL_MARGIN, Math.min(left, window.innerWidth - width - PANEL_MARGIN))

      setPosition({ top, left: clampedLeft })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, items.length, align])

  return (
    <div ref={ref} className={cn('relative shrink-0', className)}>
      <button
        ref={setTriggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (open) closeMenu()
          else {
            const first = navigableIndices[0] ?? 0
            setActiveIndex(first)
            setOpen(true)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            event.stopPropagation()
            const first =
              event.key === 'ArrowDown'
                ? (navigableIndices[0] ?? 0)
                : (navigableIndices[navigableIndices.length - 1] ?? 0)
            setActiveIndex(first)
            setOpen(true)
          }
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      {open
        ? createPortal(
            <motion.ul
              ref={panelRef}
              id={menuId}
              role="menu"
              onMouseDown={(event) => event.stopPropagation()}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
              className="vault-surface min-w-48 overflow-hidden rounded p-1.5 shadow-glass"
              style={{
                position: 'fixed',
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                visibility: position ? 'visible' : 'hidden',
                zIndex: layers.popover,
              }}
            >
              {items.map((item, index) => (
                <li key={item.id} className={item.divider ? 'mt-1.5 border-t border-ink/10 pt-1.5' : ''}>
                  <button
                    ref={(element) => {
                      itemRefs.current[index] = element
                    }}
                    type="button"
                    role="menuitem"
                    tabIndex={index === activeIndex ? 0 : -1}
                    disabled={item.disabled}
                    title={item.title}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (item.disabled) return
                      item.onSelect()
                      closeMenu(true)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-xs font-medium transition-colors',
                      item.disabled
                        ? 'cursor-not-allowed text-ink-soft/50'
                        : item.danger
                          ? 'text-red-400 hover:bg-red-950/50 hover:text-red-300'
                          : 'text-ink-soft hover:bg-ink/5 hover:text-ink',
                    )}
                  >
                    {item.icon ? (
                      <item.icon size={15} className="shrink-0" aria-hidden="true" />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.trailing ? (
                      <span className="shrink-0 text-[10px] font-semibold text-ink-soft">{item.trailing}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </motion.ul>,
            document.body,
          )
        : null}
    </div>
  )
}