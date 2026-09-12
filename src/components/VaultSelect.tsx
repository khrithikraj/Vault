import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import { layers } from '../design/layers'

/**
 * VaultSelect — a custom dropdown that replaces the browser's native <select>
 * with one that matches the terminal/vault design language: a bordered trigger
 * and a floating "vault-surface" options list.
 *
 * The options list is rendered through a portal attached to document.body and
 * positioned with fixed coordinates taken from the trigger's real viewport
 * rect. Because it lives outside the modal tree, an ancestor's overflow /
 * rounded-corner clipping or transform can never cut it off. It also:
 *   - always stays aligned to and as wide as the trigger,
 *   - flips upward when there is more room above the trigger than below it,
 *   - constrains its own height to the free viewport space (internal scroll),
 *   - never causes horizontal overflow, and stays tappable on mobile.
 *
 * Note: AnimatePresence lives INSIDE the portal (it can only track motion
 * components as direct children — wrapping a React Portal in it makes it render
 * nothing and the menu silently disappears). The portal wraps AnimatePresence,
 * so enter/exit animations still run inside document.body.
 *
 * It accepts a list of { value, label } options and reports selection via onSelect.
 * Purely presentational — parent owns the selected value.
 */

export type VaultSelectOption<T extends string = string> = {
  value: T
  label: string
}

type VaultSelectProps<T extends string = string> = {
  options: VaultSelectOption<T>[]
  value: T
  onSelect: (value: T) => void
  disabled?: boolean
  /** Force the list to open upward instead of automatically choosing a direction. */
  up?: boolean
  className?: string
  ariaLabel?: string
}

type Placement = {
  left: number
  width: number
  maxHeight: number
  place: 'down' | 'up'
  top?: number
  bottom?: number
}

const GAP = 6
const MAX_MENU = 240
const MIN_MENU = 44

export function VaultSelect<T extends string = string>({
  options,
  value,
  onSelect,
  disabled = false,
  up = false,
  className = '',
  ariaLabel,
}: VaultSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()

  const current = options.find((option) => option.value === value)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))

  const measure = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const place = up || spaceBelow < spaceAbove ? 'up' : 'down'
    const available = (place === 'up' ? spaceAbove : spaceBelow) - GAP
    setPlacement({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(MIN_MENU, Math.min(MAX_MENU, available)),
      place,
      top: place === 'down' ? rect.bottom + GAP : undefined,
      bottom: place === 'up' ? window.innerHeight - rect.top + GAP : undefined,
    })
  }, [up])

  const openMenu = useCallback((index = selectedIndex) => {
    measure()
    setActiveIndex(index)
    setOpen(true)
  }, [measure, selectedIndex])

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      const insideRoot = rootRef.current?.contains(target)
      const insideList = listRef.current?.contains(target)
      if (!insideRoot && !insideList) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setOpen(false)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeMenu(true)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIndex((currentIndex) => {
          if (e.key === 'Home') return 0
          if (e.key === 'End') return options.length - 1
          const offset = e.key === 'ArrowDown' ? 1 : -1
          return (currentIndex + offset + options.length) % options.length
        })
        return
      }
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement !== triggerRef.current) {
        e.preventDefault()
        e.stopPropagation()
        const option = options[activeIndex]
        if (option) {
          onSelect(option.value)
          closeMenu(true)
        }
      }
    }
    const recompute = () => {
      if (open) measure()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    window.addEventListener('orientationchange', recompute)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
      window.removeEventListener('orientationchange', recompute)
    }
  }, [activeIndex, closeMenu, onSelect, open, options, measure])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [activeIndex, open])

  const toggle = () => {
    if (open) closeMenu()
    else openMenu()
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openMenu(event.key === 'ArrowDown' ? selectedIndex : Math.max(0, options.length - 1))
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        className="vault-input flex w-full items-center justify-between gap-2 rounded-none px-2.5 py-2 text-left text-sm font-medium text-ink disabled:opacity-60"
      >
        <span className="truncate capitalize">{current?.label ?? 'Select…'}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && placement ? (
            <motion.div
              key="listbox"
              id={listboxId}
              ref={listRef}
              role="listbox"
              initial={{ opacity: 0, y: placement.place === 'up' ? 4 : -4, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: placement.place === 'up' ? 4 : -4, scale: 0.99 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                left: placement.left,
                width: placement.width,
                maxHeight: placement.maxHeight,
                top: placement.top,
                bottom: placement.bottom,
                zIndex: layers.popover,
              }}
              className="vault-surface vault-scrollbar overflow-y-auto rounded border bg-cloud p-1 shadow-xl"
            >
              {options.map((option, index) => {
                const selected = option.value === value
                return (
                  <button
                    ref={(element) => { optionRefs.current[index] = element }}
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onSelect(option.value)
                      closeMenu(true)
                    }}
                    tabIndex={index === activeIndex ? 0 : -1}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-sm transition-colors ${
                      selected ? 'bg-ink/10 text-ink' : 'text-ink-soft hover:bg-ink/5 hover:text-ink'
                    }`}
                  >
                    <span className="capitalize">{option.label}</span>
                    {selected ? <Check size={14} className="text-accent shrink-0" /> : null}
                  </button>
                )
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}