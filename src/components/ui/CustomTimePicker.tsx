import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, Clock, X } from 'lucide-react'
import {
  formatReminderTime,
  parseLocalTime,
  stepHour12,
  stepMinute,
  timeDraftFromValue,
  timeDraftToValue,
  to24HourTime,
  type TimeDraft,
} from '../../lib/reminders'
import { cn } from '../../design/cn'
import { layers, NESTED_LAYER_ATTR } from '../../design/layers'
import {
  TimeWheel,
  WHEEL_ITEM_HEIGHT,
  WHEEL_VISIBLE_ROWS,
  type TimeWheelItem,
} from './TimeWheel'

export type CustomTimePickerProps = {
  value: string // 24-hour "HH:MM" format or "" for unselected
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
}

type TypedTimeDraft = { hour: string; minute: string; period: 'AM' | 'PM' }

/**
 * Touch-first detection.
 *
 * A phone is either narrow (the app's own `sm` breakpoint is 640 px, and the
 * reminder surfaces already switch layouts there) or reports a coarse pointer.
 * Either signal means "no hardware keyboard": the Gboard would pop up over the
 * dialog, the caret would land mid-number, and a long-press would start a text
 * selection on a control that is not really a text field.
 *
 * Desktop keeps the typed control, so pointing a mouse at Vault on a desktop
 * browser never loses the ability to type a time.
 */
const TOUCH_LAYOUT_QUERY = '(max-width: 639px), (pointer: coarse)'

function useTouchLayout(): boolean {
  const [touchLayout, setTouchLayout] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(TOUCH_LAYOUT_QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(TOUCH_LAYOUT_QUERY)
    const update = () => setTouchLayout(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return touchLayout
}

const HOUR_WHEEL_ITEMS: TimeWheelItem<number>[] = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: pad2(index + 1),
}))

const MINUTE_WHEEL_ITEMS: TimeWheelItem<number>[] = Array.from({ length: 60 }, (_, index) => ({
  value: index,
  label: pad2(index),
}))

const PERIOD_WHEEL_ITEMS: TimeWheelItem<'AM' | 'PM'>[] = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
]

/**
 * Vertical offset that lines a sibling element up with the centre row of a
 * wheel (the caption sits under the wheel, so the centre row is the wheel's
 * own vertical middle minus half a row).
 */
const WHEEL_CENTRE_OFFSET =
  (WHEEL_VISIBLE_ROWS * WHEEL_ITEM_HEIGHT) / 2 - WHEEL_ITEM_HEIGHT / 2

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Time picker.
 *
 * Two surfaces, one component and one value contract:
 *
 *  • **Typed (desktop)** — the original control: two numeric text fields with
 *    steppers and an AM/PM toggle. Unchanged, so desktop users keep typing a
 *    time exactly as before.
 *
 *  • **Tapped (touch)** — the status card becomes a button that opens a
 *    dedicated time sheet with three scroll wheels: hour, minute and AM/PM.
 *    The wheels are dragged with a finger, spin under a mouse wheel, and take
 *    keyboard input as spinbuttons. There is deliberately **no text field**
 *    here, so the Gboard never opens, no caret is ever placed, and a long-press
 *    cannot start a text selection. The sheet holds a draft and only commits
 *    when the user confirms, so cancelling never persists an unconfirmed time.
 *
 * The committed value is always the same canonical 24-hour "HH:MM" string, so
 * reminder scheduling, recurrence and timezone behaviour are untouched.
 */
export function CustomTimePicker({
  value,
  onChange,
  disabled = false,
  id,
}: CustomTimePickerProps) {
  const touchLayout = useTouchLayout()

  if (touchLayout) {
    return (
      <TouchTimePicker value={value} onChange={onChange} disabled={disabled} id={id} />
    )
  }

  return (
    <TypedTimePicker value={value} onChange={onChange} disabled={disabled} id={id} />
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Desktop: the typed control (unchanged behaviour).
 * ────────────────────────────────────────────────────────────────────────── */

function TypedTimePicker({
  value,
  onChange,
  disabled = false,
  id,
}: CustomTimePickerProps) {
  const parsed = parseLocalTime(value)
  const isSet = parsed !== null

  // Local draft states — these are the "raw" values while the user is typing
  const [draftHour, setDraftHour] = useState<string>(
    parsed ? String(parsed.hour12).padStart(2, '0') : '',
  )
  const [draftMinute, setDraftMinute] = useState<string>(
    parsed ? String(parsed.minute).padStart(2, '0') : '',
  )
  const [draftPeriod, setDraftPeriod] = useState<'AM' | 'PM'>(parsed?.period ?? 'AM')

  // Always-latest mirror so blur/step/toggle handlers never act on a stale closure.
  // Assigned during render and inside commitTime. React flushes state synchronously
  // between discrete events, so the mirror is current by the time the next handler runs.
  const draftRef = useRef<TypedTimeDraft>({ hour: draftHour, minute: draftMinute, period: draftPeriod })
  draftRef.current = { hour: draftHour, minute: draftMinute, period: draftPeriod }

  // Set whenever any control inside the picker has focus. The external-value sync
  // effect must NEVER clobber fields the user is actively editing — previously it
  // unconditionally reset the AM/PM period, so under load a freshly committed PM
  // selection could be reverted to AM before the assertion saw it.
  const pickerFocused = useRef(false)

  // Sync drafts from an external value change (e.g. the dialog reopens with a saved
  // reminder) only when the user isn't interacting with the picker. All user-driven
  // commits already update the drafts through commitTime, so this is purely for
  // outside-in changes while the picker is idle.
  useEffect(() => {
    if (pickerFocused.current) return
    const p = parseLocalTime(value)
    const next: TypedTimeDraft = p
      ? {
          hour: String(p.hour12).padStart(2, '0'),
          minute: String(p.minute).padStart(2, '0'),
          period: p.period,
        }
      : { hour: '', minute: '', period: 'AM' }
    setDraftHour(next.hour)
    setDraftMinute(next.minute)
    setDraftPeriod(next.period)
    draftRef.current = next
  }, [value])

  /** Clamp, normalise, and commit a complete time to the parent. */
  const commitTime = (hStr: string, mStr: string, period: 'AM' | 'PM') => {
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    const validH = isNaN(h) ? 9 : Math.max(1, Math.min(12, h))
    const validM = isNaN(m) ? 0 : Math.max(0, Math.min(59, m))
    const next: TypedTimeDraft = {
      hour: String(validH).padStart(2, '0'),
      minute: String(validM).padStart(2, '0'),
      period,
    }
    setDraftHour(next.hour)
    setDraftMinute(next.minute)
    setDraftPeriod(next.period)
    draftRef.current = next
    onChange(to24HourTime(validH, validM, period))
  }

  // ── Hour field ─────────────────────────────────────────────────────────────

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 2 chars
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2)
    setDraftHour(raw)
    // Eagerly commit only if it's already a fully valid value (1–12)
    // so the "Selected Time" badge updates live without breaking multi-digit entry.
    if (raw.length === 2) {
      const num = parseInt(raw, 10)
      if (!isNaN(num) && num >= 1 && num <= 12) {
        const { minute, period } = draftRef.current
        commitTime(String(num), minute, period)
      }
    }
  }

  const handleHourFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all on focus so typing immediately replaces the old value
    e.target.select()
  }

  const handleHourBlur = () => {
    const { hour, minute, period } = draftRef.current
    commitTime(hour, minute, period)
  }

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleHourBlur()
    if (e.key === 'ArrowUp') { e.preventDefault(); handleHourStep(1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); handleHourStep(-1) }
  }

  // ── Minute field ───────────────────────────────────────────────────────────

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 2 chars. Do NOT call onChange here — wait for blur/Enter
    // so the user can type "3" then "2" without the field being overwritten mid-entry.
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2)
    setDraftMinute(raw)
    // Only eagerly commit when we have a full 2-digit value that's in range
    if (raw.length === 2) {
      const num = parseInt(raw, 10)
      if (!isNaN(num) && num >= 0 && num <= 59) {
        const { hour, period } = draftRef.current
        commitTime(hour, String(num), period)
      }
    }
  }

  const handleMinuteFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all on focus so typing immediately replaces the old value
    e.target.select()
  }

  const handleMinuteBlur = () => {
    const { hour, minute, period } = draftRef.current
    commitTime(hour, minute, period)
  }

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleMinuteBlur()
    if (e.key === 'ArrowUp') { e.preventDefault(); handleMinuteStep(1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); handleMinuteStep(-1) }
  }

  // ── Stepper buttons ────────────────────────────────────────────────────────

  const handleHourStep = (delta: number) => {
    const { hour, minute, period } = draftRef.current
    const currentH = parseInt(hour, 10) || 9
    commitTime(String(stepHour12(currentH, delta)), minute, period)
  }

  const handleMinuteStep = (delta: number) => {
    const { hour, minute, period } = draftRef.current
    const currentM = parseInt(minute, 10)
    const base = isNaN(currentM) ? 0 : currentM
    commitTime(hour, String(stepMinute(base, delta)), period)
  }

  const handlePeriodToggle = (p: 'AM' | 'PM') => {
    const { hour, minute } = draftRef.current
    commitTime(hour, minute, p)
  }

  return (
    <div
      className="flex flex-col gap-2.5"
      id={id}
      onFocus={() => { pickerFocused.current = true }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) pickerFocused.current = false
      }}
    >
      {/* Time Display Status Card */}
      <div
        data-testid="reminder-time-trigger"
        className={`flex items-center justify-between rounded-lg px-3 py-2 border transition-all ${
          isSet
            ? 'bg-cloud/60 border-accent/40 text-ink shadow-sm'
            : 'bg-ink/5 border-dashed border-ink/25 text-ink-soft'
        }`}
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className={isSet ? 'text-accent' : 'text-ink-soft/60'} />
          <span className="vault-label">
            {isSet ? 'Selected Time' : 'Time'}
          </span>
        </div>
        <span
          className={`vault-data text-sm font-bold ${
            isSet ? 'text-accent' : 'text-ink-soft/70'
          }`}
        >
          {isSet ? formatReminderTime(value) : '--:-- --'}
        </span>
      </div>

      {/* Themed Interactive Time Control */}
      <div className="flex flex-col gap-2 rounded-lg border border-ink/15 bg-cloud/40 p-2.5">
        <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
          {/* Hour Column */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleHourStep(1)}
              aria-label="Increase hour"
              className="inline-flex h-10 w-10 items-center justify-center rounded text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
            >
              <ChevronUp size={16} />
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={disabled}
              value={draftHour}
              onChange={handleHourChange}
              onFocus={handleHourFocus}
              onBlur={handleHourBlur}
              onKeyDown={handleHourKeyDown}
              placeholder="09"
              aria-label="Hour"
              className="vault-data text-xl sm:text-2xl font-bold text-ink w-12 text-center bg-ink/5 rounded border border-ink/10 py-0.5 focus:border-accent focus:bg-cloud outline-none"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleHourStep(-1)}
              aria-label="Decrease hour"
              className="inline-flex h-10 w-10 items-center justify-center rounded text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
            >
              <ChevronDown size={16} />
            </button>
            <span className="vault-label mt-0.5 text-ink-soft/60">
              Hour
            </span>
          </div>

          <span className="vault-data text-xl sm:text-2xl font-bold text-ink-soft select-none pb-4">:</span>

          {/* Minute Column */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleMinuteStep(1)}
              aria-label="Increase minute"
              className="inline-flex h-10 w-10 items-center justify-center rounded text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
            >
              <ChevronUp size={16} />
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={disabled}
              value={draftMinute}
              onChange={handleMinuteChange}
              onFocus={handleMinuteFocus}
              onBlur={handleMinuteBlur}
              onKeyDown={handleMinuteKeyDown}
              placeholder="00"
              aria-label="Minute"
              className="vault-data text-xl sm:text-2xl font-bold text-ink w-12 text-center bg-ink/5 rounded border border-ink/10 py-0.5 focus:border-accent focus:bg-cloud outline-none"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleMinuteStep(-1)}
              aria-label="Decrease minute"
              className="inline-flex h-10 w-10 items-center justify-center rounded text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
            >
              <ChevronDown size={16} />
            </button>
            <span className="vault-label mt-0.5 text-ink-soft/60">
              Min
            </span>
          </div>

          {/* AM / PM Selector */}
          <div className="flex flex-col gap-1 pl-2 border-l border-ink/15 my-auto">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handlePeriodToggle('AM')}
              className={`inline-flex h-10 items-center justify-center rounded px-2.5 text-xs font-bold transition-all ${
                draftPeriod === 'AM' && isSet
                  ? 'bg-accent text-white shadow-sm'
                  : draftPeriod === 'AM'
                  ? 'bg-ink/15 text-ink font-semibold'
                  : 'text-ink-soft hover:text-ink hover:bg-ink/5'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handlePeriodToggle('PM')}
              className={`inline-flex h-10 items-center justify-center rounded px-2.5 text-xs font-bold transition-all ${
                draftPeriod === 'PM' && isSet
                  ? 'bg-accent text-white shadow-sm'
                  : draftPeriod === 'PM'
                  ? 'bg-ink/15 text-ink font-semibold'
                  : 'text-ink-soft hover:text-ink hover:bg-ink/5'
              }`}
            >
              PM
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Touch: the tapped time sheet.
 * ────────────────────────────────────────────────────────────────────────── */

function TouchTimePicker({
  value,
  onChange,
  disabled = false,
  id,
}: CustomTimePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const parsed = parseLocalTime(value)
  const isSet = parsed !== null
  const label = isSet ? formatReminderTime(value) : '--:-- --'

  // The sheet works on a draft and only commits on confirm, so cancelling (or
  // dismissing with Escape / the backdrop) can never persist a half-chosen time.
  const [draft, setDraft] = useState<TimeDraft>(() => timeDraftFromValue(value))

  // Re-seed the draft from the committed value whenever the sheet is closed.
  useEffect(() => {
    if (!open) setDraft(timeDraftFromValue(value))
  }, [value, open])

  // Escape closes the sheet without committing and returns focus to the trigger.
  // Capture phase + stopPropagation so the surrounding dialog/popover does not
  // also close itself behind the sheet. Tab is cycled inside the sheet so
  // focus can never wander back into the dialog underneath.
  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (event.key !== 'Tab') return
      const sheet = sheetRef.current
      if (!sheet) return
      const focusable = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (!sheet.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [open])

  // Move focus into the sheet so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => sheetRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const close = (commit: boolean) => {
    if (commit) onChange(timeDraftToValue(draft))
    setOpen(false)
    triggerRef.current?.focus()
  }

  const pick = (patch: Partial<TimeDraft>) => setDraft((prev) => ({ ...prev, ...patch }))

  return (
    <div className="flex flex-col gap-2.5">
      {/* The status card is the trigger: one big, comfortable tap target. */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={isSet ? `Reminder time: ${label}` : 'Reminder time'}
        data-testid="reminder-time-trigger"
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-3 text-left transition-colors',
          'select-none touch-manipulation disabled:cursor-not-allowed disabled:opacity-50',
          isSet
            ? 'bg-cloud/60 border-accent/40 text-ink shadow-sm'
            : 'bg-ink/5 border-dashed border-ink/25 text-ink-soft',
        )}
      >
        <span className="flex items-center gap-2">
          <Clock size={14} className={isSet ? 'text-accent' : 'text-ink-soft/60'} />
          <span className="vault-label">
            {isSet ? 'Selected Time' : 'Time'}
          </span>
        </span>
        <span
          className={cn(
            'vault-data text-sm font-bold',
            isSet ? 'text-accent' : 'text-ink-soft/70',
          )}
        >
          {label}
        </span>
      </button>

      {open && createPortal(
        <div
          {...{ [NESTED_LAYER_ATTR]: '' }}
          className="fixed inset-0 flex items-end justify-center sm:items-center"
          style={{ zIndex: layers.toast }}
        >
          {/* Backdrop — tapping it cancels, exactly like the Escape key. */}
          <div
            aria-hidden="true"
            data-testid="reminder-time-sheet-backdrop"
            className="absolute inset-0 bg-black/60"
            onClick={() => close(false)}
          />

          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Choose time"
            tabIndex={-1}
            className={cn(
              'vault-surface relative flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-ink/20',
              'text-ink shadow-overlay outline-none sm:rounded-2xl',
            )}
            style={{ maxHeight: 'calc(100dvh - 1.5rem)' }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-accent" />
                <h3 className="vault-card-title text-ink">Choose time</h3>
              </div>
              <button
                type="button"
                onClick={() => close(false)}
                aria-label="Close time picker"
                className="rounded p-1.5 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            {/* Wheels — the sheet body scrolls only if a short viewport (the
                on-screen keyboard) squeezes the columns. */}
            <div className="vault-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              <div className="flex items-start justify-center gap-1.5">
                <TimeWheel
                  label="Hour"
                  items={HOUR_WHEEL_ITEMS}
                  value={draft.hour12}
                  onChange={(hour12) => pick({ hour12 })}
                  caption="Hour"
                  className="w-[4.5rem]"
                  testId="reminder-time-hour-wheel"
                />

                <span
                  aria-hidden="true"
                  className="vault-data flex items-center text-2xl font-bold text-ink-soft"
                  style={{ height: WHEEL_ITEM_HEIGHT, marginTop: WHEEL_CENTRE_OFFSET }}
                >
                  :
                </span>

                <TimeWheel
                  label="Minute"
                  items={MINUTE_WHEEL_ITEMS}
                  value={draft.minute}
                  onChange={(minute) => pick({ minute })}
                  caption="Min"
                  className="w-[5rem]"
                  testId="reminder-time-minute-wheel"
                />

                <TimeWheel
                  label="Period"
                  items={PERIOD_WHEEL_ITEMS}
                  value={draft.period}
                  onChange={(period) => pick({ period })}
                  // AM/PM has only two states, so this column is bounded: it
                  // never wraps into an endless AM/PM/AM/PM strip. The other
                  // period is the adjacent option — tap it or swipe to switch.
                  bounded
                  caption="AM / PM"
                  className="w-[4.5rem]"
                  testId="reminder-time-period-wheel"
                />
              </div>

              {/* Live preview of the draft — it is what "Set time" commits. */}
              <p
                data-testid="reminder-time-preview"
                className="mt-4 text-center vault-data text-sm font-bold text-accent"
              >
                {formatReminderTime(timeDraftToValue(draft))}
              </p>
            </div>

            {/* Footer — Cancel discards the draft, Set time commits it. Pinned to
                the bottom of the sheet and padded for the home indicator. */}
            <div
              className="flex shrink-0 items-center gap-2 border-t border-ink/10 px-4 pt-3"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
            >
              <button
                type="button"
                onClick={() => close(false)}
                className="vault-action flex-1 rounded-lg border border-ink/15 bg-ink/5 px-3 py-2.5 text-xs text-ink-soft transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                data-testid="reminder-time-confirm"
                className="vault-btn-solid vault-action flex-1 rounded-lg px-3 py-2.5 text-xs"
              >
                Set time
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
