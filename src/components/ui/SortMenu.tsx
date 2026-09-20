import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownUp, Check } from 'lucide-react'
import { layers } from '../../design/layers'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

type SortOption<T extends string> = { value: T; label: string }

type SortMenuProps<T extends string> = {
  value: T
  options: SortOption<T>[]
  onChange: (value: T) => void
}

const PANEL_MARGIN = 8

/** Small dropdown button used in the toolbar row above Items/Docs/Notes grids.
 *  The panel is portaled to <body> with fixed positioning so it can never be
 *  clipped by a reflowed section header or overflow ancestor, and it stays fully
 *  inside the viewport: it flips above the trigger when there is no room below,
 *  and clamps left/right so it never spills off-screen on narrow mobile widths. */
export function SortMenu<T extends string>({ value, options, onChange }: SortMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLUListElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const current = options.find((option) => option.value === value)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))

  const closeMenu = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    if (!open) return
    const onClickAway = (event: MouseEvent) => {
      const target = event.target as Node
      const insideRoot = ref.current?.contains(target)
      const insidePanel = panelRef.current?.contains(target)
      if (!insideRoot && !insidePanel) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        setOpen(false)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu(true)
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        setActiveIndex((currentIndex) => {
          if (event.key === 'Home') return 0
          if (event.key === 'End') return options.length - 1
          const offset = event.key === 'ArrowDown' ? 1 : -1
          return (currentIndex + offset + options.length) % options.length
        })
        return
      }
      if ((event.key === 'Enter' || event.key === ' ') && document.activeElement !== triggerRef.current) {
        event.preventDefault()
        const option = options[activeIndex]
        if (option) {
          onChange(option.value)
          closeMenu(true)
        }
      }
    }
    document.addEventListener('mousedown', onClickAway)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickAway)
      document.removeEventListener('keydown', onKey)
    }
  }, [activeIndex, onChange, open, options])

  useEffect(() => {
    if (!open) return
    optionRefs.current[activeIndex]?.focus()
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

      // Anchor the menu's right edge to the trigger (matches the old right-aligned
      // dropdown), then clamp horizontally so it never leaves the viewport.
      const left = Math.max(
        PANEL_MARGIN,
        Math.min(rect.right - width, window.innerWidth - width - PANEL_MARGIN),
      )

      setPosition({ top: Math.round(top), left: Math.round(left) })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, options.length])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) closeMenu()
          else {
            setActiveIndex(selectedIndex)
            setOpen(true)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex(event.key === 'ArrowDown' ? selectedIndex : Math.max(0, options.length - 1))
            setOpen(true)
          }
        }}
        className="vault-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={`Sort by ${current?.label ?? 'selected option'}`}
      >
        <ArrowDownUp size={13} aria-hidden="true" />
        <span className="hidden sm:inline">{current?.label ?? 'Sort'}</span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.ul
              ref={panelRef}
              id={listboxId}
              role="listbox"
              onMouseDown={(event) => event.stopPropagation()}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
              className="vault-surface w-44 overflow-hidden rounded p-1 shadow-glass"
              style={{
                position: 'fixed',
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                visibility: position ? 'visible' : 'hidden',
                zIndex: layers.dropdown,
              }}
            >
              {options.map((option, index) => (
                <li key={option.value}>
                  <button
                    ref={(element) => { optionRefs.current[index] = element }}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    onClick={() => {
                      onChange(option.value)
                      closeMenu(true)
                    }}
                    tabIndex={index === activeIndex ? 0 : -1}
                    className="flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium text-ink-soft hover:bg-ink/5 hover:text-ink"
                  >
                    {option.label}
                    {option.value === value ? <Check size={13} className="text-accent" /> : null}
                  </button>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}