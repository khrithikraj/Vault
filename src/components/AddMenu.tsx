import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Archive, FolderLock, NotebookPen } from 'lucide-react'
import { layers } from '../design/layers'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

type AddMenuProps = {
  open: boolean
  onClose: () => void
  onPickItem: () => void
  onPickNote: () => void
  onPickDocument: () => void
}

type ActionItem = {
  id: string
  label: string
  sublabel: string
  icon: ReactNode
  accentClass: string
  onClick: () => void
}

/**
 * V2 — Quick Add radial action cluster.
 *
 * Replaces the old centered modal chooser. Actions bloom upward from
 * the FAB position with spring stagger when the + is tapped.
 * Each action reads as a distinct archival gesture:
 *   Archive → save an object to the vault
 *   Note    → write a thought
 *   Record  → upload a document
 *
 * Inspired by Watermelon gooey-menu + Motion add-to-basket philosophy.
 * Tap-first, hover is enhancement only.
 */
export function AddMenu({
  open,
  onClose,
  onPickItem,
  onPickNote,
  onPickDocument,
}: AddMenuProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    const frame = window.requestAnimationFrame(() => itemRefs.current[0]?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const items: ActionItem[] = [
    {
      id: 'item',
      label: 'Item',
      sublabel: 'Add an item',
      icon: <Archive size={17} strokeWidth={1.7} />,
      accentClass: 'text-accent',
      onClick: onPickItem,
    },
    {
      id: 'note',
      label: 'Note',
      sublabel: 'Write a thought',
      icon: <NotebookPen size={17} strokeWidth={1.7} />,
      accentClass: 'text-warn',
      onClick: onPickNote,
    },
    {
      id: 'doc',
      label: 'Document',
      sublabel: 'Upload a document',
      icon: <FolderLock size={17} strokeWidth={1.7} />,
      accentClass: 'text-ink-soft',
      onClick: onPickDocument,
    },
  ]

  return (
    <>
      {/* Backdrop — invisible tap target to close */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="add-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0"
            style={{ zIndex: layers.overlay }}
            onClick={onClose}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>

      {/* Action cluster */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="add-cluster"
            role="menu"
            aria-label="Quick add actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.15 }}
            className="fixed flex flex-col items-end gap-2"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                onClose()
                return
              }
              let next = activeIndex
              if (event.key === 'ArrowDown') next = (activeIndex + 1) % items.length
              else if (event.key === 'ArrowUp') next = (activeIndex - 1 + items.length) % items.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = items.length - 1
              else return
              event.preventDefault()
              setActiveIndex(next)
              itemRefs.current[next]?.focus()
            }}
            style={{
              right: 'max(env(safe-area-inset-right, 0px), 1rem)',
              bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 0.875rem) + 5rem)',
              zIndex: layers.modal,
            }}
          >
            <motion.div
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
                open: {
                  transition: {
                    staggerChildren: reducedMotion ? 0 : 0.055,
                    delayChildren: reducedMotion ? 0 : 0.02,
                  },
                },
                closed: {
                  transition: {
                    staggerChildren: reducedMotion ? 0 : 0.03,
                    staggerDirection: -1,
                  },
                },
              }}
              className="float-nav flex flex-col items-stretch gap-0.5 rounded-2xl px-2 py-2.5"
            >
              {items.map((item, index) => (
                <motion.button
                  key={item.id}
                  ref={(node) => {
                    itemRefs.current[index] = node
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={index === activeIndex ? 0 : -1}
                  onFocus={() => setActiveIndex(index)}
                  variants={{
                    closed: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
                    open: reducedMotion
                      ? { opacity: 1 }
                      : { opacity: 1, y: 0 },
                  }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: 0.2, ease: 'easeOut' }
                  }
                  whileTap={reducedMotion ? {} : { scale: 0.95 }}
                  onClick={item.onClick}
                  className="group flex min-w-[11rem] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink/[0.04]"
                >
                  {/* Icon badge */}
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-ink/[0.03] ${item.accentClass}`}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>

                  {/* Labels */}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight text-ink">
                      {item.label}
                    </span>
                    <span className="block text-[11px] leading-tight text-ink-soft/60 mt-0.5">
                      {item.sublabel}
                    </span>
                  </span>
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
