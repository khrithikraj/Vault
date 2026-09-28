import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  formatReminderDate,
  formatWeekdayLabel,
  isValidFireOnDate,
  MONTH_NAMES,
  parseFireOnDate,
  WEEKDAYS,
} from '../../lib/reminders'
import { cn } from '../../design/cn'
import { layers, NESTED_LAYER_ATTR } from '../../design/layers'

export type CustomDatePickerProps = {
  /** Canonical "YYYY-MM-DD", or "" when nothing is selected. */
  value: string
  onChange: (value: string) => void
  /** "YYYY-MM-DD" lower bound — the reminder's own "today", so past days are unreachable. */
  min?: string
  id?: string
  disabled?: boolean
}

const GRID_COLS = 7
// Always six rows. A fixed cell count means the panel never changes height as the
// user pages between months, so nothing below it shifts.
const GRID_CELLS = GRID_COLS * 6
const PANEL_MARGIN = 8
const PANEL_GAP = 6

/** "YYYY-MM-DD" from plain numbers — no Date parsing involved. */
function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Adds (or subtracts) whole days using UTC arithmetic, exactly like `addDay`.
 *  UTC maths is safe for day counting: the value is never interpreted in the
 *  machine's timezone, so the calendar day can never shift. */
function addDays(dateStr: string, days: number): string {
  const parsed = parseFireOnDate(dateStr)
  if (!parsed) return dateStr
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
    .toISOString()
    .slice(0, 10)
}

/** 0 = Sunday … 6 = Saturday, derived from UTC so no timezone is involved. */
function weekdayIndex(dateStr: string): number {
  const parsed = parseFireOnDate(dateStr)
  if (!parsed) return 0
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()
}

/** The Monday-on-or-before the 1st, so the grid leads with Monday (the Vault
 *  convention — `WEEKDAYS` starts on Monday). */
function monthGridStart(year: number, month: number): string {
  const first = toDateStr(year, month, 1)
  const lead = (weekdayIndex(first) + 6) % GRID_COLS
  return addDays(first, -lead)
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = month - 1 + delta
  return {
    year: year + Math.floor(zeroBased / 12),
    month: ((zeroBased % 12) + 12) % 12 + 1,
  }
}

/** The six-week grid for a month, as "YYYY-MM-DD" strings. */
function buildMonthGrid(year: number, month: number): string[] {
  const start = monthGridStart(year, month)
  return Array.from({ length: GRID_CELLS }, (_, i) => addDays(start, i))
}

/** Long form for screen readers, e.g. "24 March 2027". */
function formatDateAriaLabel(dateStr: string): string {
  const parsed = parseFireOnDate(dateStr)
  if (!parsed) return ''
  return `${parsed.day} ${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`
}

/**
 * Date field for a one-time reminder, with a custom Vault calendar.
 *
 * Deliberately NOT an `<input type="date">`: the native control opens the
 * browser's own calendar popup, which is light-themed, oversized and completely
 * outside Raj's Vault's visual language. This is a real popup instead — a small
 * editorial panel portalled to <body> so the reminder dialog can never clip it,
 * and positioned against the trigger with the same flip-and-clamp logic the
 * reminder popover uses.
 *
 * Date semantics are unchanged: the value is always a plain "YYYY-MM-DD" string
 * in the REMINDER's timezone, and every calculation here is UTC-arithmetic on
 * that string, so the day the user taps is the day that gets stored and
 * scheduled. The display month is UI state only; `fireOn_date` stays canonical.
 */
export function CustomDatePicker({
  value,
  onChange,
  min,
  id,
  disabled = false,
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dayRefs = useRef(new Map<string, HTMLButtonElement>())
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)

  const minDate = isValidFireOnDate(min) ? (min as string) : undefined
  const selected = isValidFireOnDate(value) ? (value as string) : null
  const label = selected ? formatReminderDate(selected) : 'Select date'

  // The month on screen. Seeded from the selected date (or today) whenever the
  // panel opens, so reopening always lands on the saved date's month.
  const seed = parseFireOnDate(selected ?? minDate ?? '')
  const [view, setView] = useState(() => ({
    year: seed?.year ?? new Date().getFullYear(),
    month: seed?.month ?? new Date().getMonth() + 1,
  }))

  // Keyboard focus target inside the grid; follows the selected day by default.
  const [focusDate, setFocusDate] = useState<string>(selected ?? minDate ?? toDateStr(view.year, view.month, 1))

  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view.year, view.month])

  // Yesterday relative to the minimum is the last selectable day, and the day
  // before this month's 1st bounds how far back navigation may go.
  const canGoPrev = minDate ? addDays(toDateStr(view.year, view.month, 1), -1) >= minDate : true

  useEffect(() => {
    if (!open) return
    // Re-anchor the month and the focus target to the saved date on every open.
    const anchor = parseFireOnDate(selected ?? minDate ?? '')
    if (anchor) {
      setView({ year: anchor.year, month: anchor.month })
      setFocusDate(selected ?? minDate ?? '')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the focused day inside the month on screen (arrow keys can page it).
  useEffect(() => {
    if (!open) return
    const target = dayRefs.current.get(focusDate)
    if (target) target.focus()
  }, [open, focusDate])

  // Click outside closes, Escape closes and returns focus to the trigger.
  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  // Place the panel: below the trigger when it fits, above it when it doesn't,
  // always clamped inside the viewport. Recomputed on resize/scroll like the
  // reminder popover, so it can never end up off-screen on a phone.
  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null)
      return
    }
    const panel = panelRef.current
    const trigger = triggerRef.current
    if (!panel || !trigger) return

    const place = () => {
      const panel = panelRef.current
      const trigger = triggerRef.current
      if (!panel || !trigger) return

      // Clamp against the *client* box, not `innerWidth`/`innerHeight`: those
      // include any classic scrollbar gutter, and under mobile emulation they can
      // exceed the layout viewport, which lets the panel hang off-screen.
      const doc = document.documentElement
      const clientWidth = doc.clientWidth || window.innerWidth
      const clientHeight = doc.clientHeight || window.innerHeight

      // Cap the width *before* measuring, otherwise `offsetWidth` reports the
      // unconstrained 19.5rem and the horizontal clamp below is a lie.
      panel.style.maxWidth = `${clientWidth - PANEL_MARGIN * 2}px`

      const rect = trigger.getBoundingClientRect()
      const width = panel.offsetWidth
      const height = panel.offsetHeight

      const maxTop = Math.max(PANEL_MARGIN, clientHeight - height - PANEL_MARGIN)
      const below = rect.bottom + PANEL_GAP
      const above = rect.top - height - PANEL_GAP
      let top: number
      if (below + height <= clientHeight - PANEL_MARGIN) top = below
      else if (above >= PANEL_MARGIN) top = above
      else top = Math.max(PANEL_MARGIN, Math.min(below, maxTop))

      // Centred on the trigger, then clamped — the panel is never wider than the
      // client area minus the margins, so this can always succeed.
      const maxLeft = Math.max(PANEL_MARGIN, clientWidth - width - PANEL_MARGIN)
      let left = rect.left + rect.width / 2 - width / 2
      left = Math.max(PANEL_MARGIN, Math.min(left, maxLeft))

      setPanelStyle({ top: Math.round(top), left: Math.round(left) })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  function commit(next: string) {
    onChange(next)
    const parsed = parseFireOnDate(next)
    if (parsed) setView({ year: parsed.year, month: parsed.month })
    setOpen(false)
  }

  function handleGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -GRID_COLS,
      ArrowDown: GRID_COLS,
    }
    const step = steps[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = addDays(focusDate, step)
    const parsed = parseFireOnDate(next)
    if (parsed) {
      // Page the view when the focus steps into an adjacent month.
      if (parsed.month !== view.month || parsed.year !== view.year) {
        setView({ year: parsed.year, month: parsed.month })
      }
      setFocusDate(next)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Date</span>

      {/* The field itself. A real button so it is focusable and operable from the
          keyboard, with the chosen date spelled out in Vault typography. */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={selected ? `Reminder date: ${label}` : 'Reminder date'}
        data-testid="reminder-date-trigger"
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          selected
            ? 'border-accent/40 bg-cloud/60 text-ink'
            : 'border-dashed border-ink/25 bg-ink/5 text-ink-soft',
        )}
      >
        <span className={cn('truncate font-semibold', selected ? 'text-ink' : 'text-ink-soft')}>{label}</span>
        <CalendarDays size={14} className={cn('shrink-0', selected ? 'text-accent' : 'text-ink-soft/60')} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose date"
          {...{ [NESTED_LAYER_ATTR]: '' }}
          onKeyDown={handleGridKeyDown}
          style={{
            // `layers.toast` is the first rung above `popover`, which is what the
            // reminder dialog itself uses — this panel nests inside it.
            zIndex: layers.toast,
            ...(panelStyle
              ? { position: 'fixed', top: panelStyle.top, left: panelStyle.left }
              : { position: 'fixed', top: 0, left: 0 }),
            // Hidden until measured, so it never flashes in the wrong place.
            opacity: panelStyle ? 1 : 0,
          }}
          className={cn(
            'vault-surface w-[19.5rem] max-w-[calc(100vw-1rem)] select-none rounded-lg p-2.5',
            'text-ink shadow-glass',
          )}
        >
          {/* Month header + quiet navigation */}
          <div className="mb-2 flex items-center justify-between gap-1 px-0.5">
            <button
              type="button"
              onClick={() => setView((prev) => shiftMonth(prev.year, prev.month, -1))}
              disabled={!canGoPrev}
              aria-label="Previous month"
              className={cn(
                'rounded p-1.5 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink',
                'disabled:pointer-events-none disabled:opacity-25',
              )}
            >
              <ChevronLeft size={16} />
            </button>

            <div aria-live="polite" className="font-display text-sm font-semibold tracking-wide text-ink">
              {MONTH_NAMES[view.month - 1]}{' '}
              <span className="text-ink-soft">{view.year}</span>
            </div>

            <button
              type="button"
              onClick={() => setView((prev) => shiftMonth(prev.year, prev.month, 1))}
              aria-label="Next month"
              className="rounded p-1.5 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday row — Monday first, matching the reminder's day picker */}
          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[9px] font-bold uppercase tracking-wider text-ink-soft/60"
              >
                {formatWeekdayLabel(day).slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Day grid — 40px targets, fixed six rows so the panel never resizes. */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((dateStr) => {
              const parsed = parseFireOnDate(dateStr)!
              const inMonth = parsed.month === view.month && parsed.year === view.year
              const isSelected = dateStr === selected
              const isToday = dateStr === minDate
              // "YYYY-MM-DD" compares lexicographically exactly as it compares
              // chronologically, so a plain string compare is the whole test.
              const isDisabled = minDate ? dateStr < minDate : false

              return (
                <button
                  key={dateStr}
                  type="button"
                  ref={(element) => {
                    if (element) dayRefs.current.set(dateStr, element)
                    else dayRefs.current.delete(dateStr)
                  }}
                  disabled={isDisabled}
                  onClick={() => commit(dateStr)}
                  onFocus={() => setFocusDate(dateStr)}
                  aria-current={isToday && !isSelected ? 'date' : undefined}
                  aria-label={formatDateAriaLabel(dateStr)}
                  className={cn(
                    'mx-auto flex h-10 w-full max-w-10 items-center justify-center rounded-full text-xs tabular-nums transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent',
                    isSelected
                      ? 'bg-accent font-bold text-ink'
                      : isDisabled
                        ? 'cursor-not-allowed text-ink-soft/25'
                        : inMonth
                          ? 'text-ink hover:bg-ink/10'
                          : 'text-ink-soft/40 hover:bg-ink/5',
                    // Today, when it is not the selection, gets a restrained ring.
                    isToday && !isSelected && 'ring-1 ring-inset ring-accent/40',
                  )}
                >
                  {parsed.day}
                </button>
              )
            })}
          </div>

          {/* Quick jump back to today; closes like any other selection. */}
          <div className="mt-1 flex items-center justify-between border-t border-ink/10 pt-1.5">
            <button
              type="button"
              onClick={() => minDate && commit(minDate)}
              disabled={!minDate}
              className="rounded px-1.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft transition-colors hover:text-ink disabled:opacity-25"
            >
              Today
            </button>
            <span className="pr-1.5 text-[10px] text-ink-soft/50">Esc to close</span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
