import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Check, ChevronDown, Trash2, X } from 'lucide-react'
import type { ChecklistReminder, DailyChecklistCompletion, Weekday } from '../../types/app'
import {
  browserTimezone,
  formatRecurrenceLabel,
  formatReminderTime,
  formatWeekdayLabel,
  isCompletedToday,
  type ReminderRecurrence,
  WEEKDAYS,
  zonedWeekday,
} from '../../lib/reminders'
import { CustomTimePicker } from '../ui/CustomTimePicker'
import { layers } from '../../design/layers'

export type ReminderControlProps = {
  reminder?: ChecklistReminder
  dailyCompletions: DailyChecklistCompletion[]
  targetTitle?: string
  targetType?: 'note' | 'item'
  onSaveReminder: (localTime: string, recurrence?: ReminderRecurrence, dayOfWeek?: Weekday | null) => void
  onRemoveReminder: () => void
  onToggleDailyCompletion: (reminder: ChecklistReminder) => void
  variant?: 'chip' | 'item-button'
  triggerClassName?: string
}

const RECURRENCE_OPTIONS: ReminderRecurrence[] = ['once', 'daily', 'weekdays', 'weekly']

export function ReminderControl({
  reminder,
  dailyCompletions,
  targetTitle,
  targetType = 'note',
  onSaveReminder,
  onRemoveReminder,
  variant = 'chip',
  triggerClassName,
}: ReminderControlProps) {
  const [open, setOpen] = useState(false)
  // No default 9:00 AM when creating a new reminder
  const [localTime, setLocalTime] = useState<string>(
    reminder && reminder.enabled ? reminder.local_time.slice(0, 5) : '',
  )
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>(
    reminder?.recurrence ?? 'daily',
  )
  const [dayOfWeek, setDayOfWeek] = useState<Weekday>(() => {
    if (reminder?.day_of_week) return reminder.day_of_week
    return zonedWeekday(new Date(), reminder?.timezone ?? browserTimezone())
  })

  const [recurrenceMenuOpen, setRecurrenceMenuOpen] = useState(false)
  const [dayMenuOpen, setDayMenuOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})

  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const isDoneToday = Boolean(reminder && isCompletedToday(reminder, dailyCompletions))

  useEffect(() => {
    if (reminder && reminder.enabled) {
      setLocalTime(reminder.local_time.slice(0, 5))
      setRecurrence(reminder.recurrence ?? 'daily')
      if (reminder.day_of_week) {
        setDayOfWeek(reminder.day_of_week)
      } else {
        setDayOfWeek(zonedWeekday(new Date(), reminder.timezone || browserTimezone()))
      }
    } else if (!open) {
      setLocalTime('')
      setRecurrence('daily')
      setDayOfWeek(zonedWeekday(new Date(), browserTimezone()))
    }
  }, [reminder, open])

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
        setRecurrenceMenuOpen(false)
        setDayMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (recurrenceMenuOpen) {
          setRecurrenceMenuOpen(false)
          return
        }
        if (dayMenuOpen) {
          setDayMenuOpen(false)
          return
        }
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, recurrenceMenuOpen, dayMenuOpen])

  // Clamp the popover inside the viewport once it opens. On desktop the popover is a
  // fixed overlay anchored to the trigger so it can never be clipped by the scrollable
  // dialog body; on mobile the centered modal classes already keep it inside the viewport.
  useLayoutEffect(() => {
    if (!open) {
      setPopoverStyle({})
      return
    }
    const popover = popoverRef.current
    const trigger = triggerRef.current
    if (!popover || !trigger) return

    const place = () => {
      if (!window.matchMedia('(min-width: 640px)').matches) {
        setPopoverStyle({})
        return
      }
      const margin = 8
      const triggerRect = trigger.getBoundingClientRect()
      const width = popover.offsetWidth
      const height = popover.offsetHeight

      const below = triggerRect.bottom + margin
      const above = triggerRect.top - height - margin
      let top = below + height <= window.innerHeight - margin ? below : above
      top = Math.max(margin, Math.min(top, window.innerHeight - height - margin))

      let left = triggerRect.right - width
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))

      setPopoverStyle({ position: 'fixed', top: `${Math.round(top)}px`, left: `${Math.round(left)}px` })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, recurrenceMenuOpen, dayMenuOpen])

  const handleSave = () => {
    if (!localTime) return
    onSaveReminder(
      localTime,
      recurrence,
      recurrence === 'weekly' ? dayOfWeek : null,
    )
    setOpen(false)
  }

  const handleRemove = () => {
    onRemoveReminder()
    setOpen(false)
  }

  const headerLabel = reminder && reminder.enabled
    ? isDoneToday
      ? `Done today · ${formatReminderTime(reminder.local_time)}`
      : `${formatRecurrenceLabel(reminder.recurrence)} · ${formatReminderTime(reminder.local_time)}`
    : 'Set reminder'

  return (
    <div className="relative inline-block text-left">
      {/* Trigger: Note-level Chip or Item-level Button */}
      {variant === 'chip' ? (
        <button
          ref={triggerRef}
          type="button"
          id="note-reminder-trigger"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={
            triggerClassName ||
            `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-all ${
              reminder && reminder.enabled
                ? isDoneToday
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25'
                : 'vault-chip text-ink-soft opacity-75 hover:opacity-100'
            }`
          }
        >
          {reminder && reminder.enabled ? (
            isDoneToday ? (
              <>
                <Check size={12} className="shrink-0 stroke-[2.5]" />
                <span>{headerLabel}</span>
              </>
            ) : (
              <>
                <Bell size={12} className="shrink-0" />
                <span>{headerLabel}</span>
              </>
            )
          ) : (
            <>
              <Bell size={12} className="shrink-0 opacity-60" />
              <span>Set reminder</span>
            </>
          )}
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={
            reminder && reminder.enabled
              ? isDoneToday
                ? `Done today · ${formatReminderTime(reminder.local_time)}`
                : `${formatRecurrenceLabel(reminder.recurrence)} reminder at ${formatReminderTime(reminder.local_time)}`
              : 'Set item reminder'
          }
          title={
            reminder && reminder.enabled
              ? `${formatRecurrenceLabel(reminder.recurrence)} reminder at ${formatReminderTime(reminder.local_time)}`
              : 'Set item reminder'
          }
          className={
            triggerClassName ||
            (reminder && reminder.enabled
              ? `inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all ${
                  isDoneToday
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25'
                }`
              : 'p-1 text-ink-soft/40 hover:text-accent transition-colors')
          }
        >
          {reminder && reminder.enabled ? (
            <>
              {isDoneToday ? (
                <Check size={11} className="stroke-[2.5]" />
              ) : (
                <Bell size={11} />
              )}
              <span className="font-mono text-[10px]">
                {formatReminderTime(reminder.local_time)}
              </span>
            </>
          ) : (
            <Bell size={13} />
          )}
        </button>
      )}

      {/* Backdrop for Mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Unified Popover Dialog (portal: fixed at body level so no transformed
          ancestor clips or mis-anchors it, and it can never overflow the viewport) */}
      {open && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Reminder settings"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(20rem,calc(100vw-24px))] max-h-[calc(100dvh-24px)] overflow-y-auto overflow-x-hidden rounded-xl border border-ink/20 bg-cloud shadow-2xl p-4 flex flex-col gap-3.5 text-ink sm:left-auto sm:top-auto sm:w-80 sm:translate-x-0 sm:translate-y-0"
          style={{ zIndex: layers.popover, ...popoverStyle }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink/10 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Bell size={14} className="text-accent" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                {targetType === 'item' ? 'Item Reminder' : 'Daily Reminder'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-ink-soft hover:text-ink hover:bg-ink/5 transition-colors"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Context / Target display */}
          {targetTitle ? (
            <div className="rounded bg-ink/5 px-2.5 py-1.5 border border-ink/10">
              <p className="text-xs text-ink-soft line-clamp-2 font-medium italic">
                &ldquo;{targetTitle.trim()}&rdquo;
              </p>
            </div>
          ) : null}

          {/* Custom Time Picker */}
          <div className="flex flex-col gap-1.5">
            <CustomTimePicker
              value={localTime}
              onChange={(time) => setLocalTime(time)}
            />
          </div>

          {/* Repeat Selector */}
          <div className="flex flex-col gap-1 relative">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
              Repeat
            </span>
            <button
              type="button"
              onClick={() => {
                setRecurrenceMenuOpen((prev) => !prev)
                setDayMenuOpen(false)
              }}
              aria-haspopup="listbox"
              aria-expanded={recurrenceMenuOpen}
              className="flex items-center justify-between rounded px-3 py-2 text-xs font-medium text-ink bg-ink/5 border border-ink/10 hover:border-ink/25 transition-all text-left"
            >
              <span className="font-semibold">{formatRecurrenceLabel(recurrence)}</span>
              <ChevronDown size={14} className="text-ink-soft" />
            </button>

            {recurrenceMenuOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-ink/20 bg-cloud shadow-xl py-1">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setRecurrence(opt)
                      setRecurrenceMenuOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                      recurrence === opt
                        ? 'bg-accent/15 text-accent font-bold'
                        : 'text-ink hover:bg-ink/5'
                    }`}
                  >
                    <span>{formatRecurrenceLabel(opt)}</span>
                    {recurrence === opt && <Check size={12} className="stroke-[2.5]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Day Selector (only when recurrence is Weekly) */}
          {recurrence === 'weekly' && (
            <div className="flex flex-col gap-1 relative">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                Day
              </span>
              <button
                type="button"
                onClick={() => {
                  setDayMenuOpen((prev) => !prev)
                  setRecurrenceMenuOpen(false)
                }}
                aria-haspopup="listbox"
                aria-expanded={dayMenuOpen}
                className="flex items-center justify-between rounded px-3 py-2 text-xs font-medium text-ink bg-ink/5 border border-ink/10 hover:border-ink/25 transition-all text-left"
              >
                <span className="font-semibold">{formatWeekdayLabel(dayOfWeek)}</span>
                <ChevronDown size={14} className="text-ink-soft" />
              </button>

              {dayMenuOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-ink/20 bg-cloud shadow-xl py-1">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setDayOfWeek(day)
                        setDayMenuOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                        dayOfWeek === day
                          ? 'bg-accent/15 text-accent font-bold'
                          : 'text-ink hover:bg-ink/5'
                      }`}
                    >
                      <span>{formatWeekdayLabel(day)}</span>
                      {dayOfWeek === day && <Check size={12} className="stroke-[2.5]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 border-t border-ink/10 pt-3">
            {reminder && reminder.enabled ? (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
              >
                <Trash2 size={12} />
                <span>Remove</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-2.5 py-1 text-xs font-medium text-ink-soft hover:text-ink hover:bg-ink/5 transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              disabled={!localTime}
              onClick={handleSave}
              className={`vault-btn-solid rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide transition-opacity ${
                !localTime ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              Save
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
