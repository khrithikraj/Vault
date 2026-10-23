import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../design/cn'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import {
  wheelBoundedAdvance,
  wheelBoundedAnchor,
  wheelBoundedIndex,
  wheelBoundedOffset,
  wheelCentreIndex,
  wheelFlingAdvance,
  wheelMod,
  wheelRingDelta,
} from '../../lib/timeWheel'

/**
 * A single-column scroll wheel.
 *
 * The wheel is a *virtual* strip: there is no scroll container and no scroll
 * bar. The component keeps an unbounded integer `anchor` (the row that sits in
 * the centre band when the strip is at rest) plus a pixel `offset` (how far the
 * strip has been dragged away from that rest position). Dragging moves the
 * offset; releasing projects the throw velocity forward, snaps to the nearest
 * row and folds the travelled distance into the anchor. The visible value is
 * always `anchor - offset / WHEEL_ITEM_HEIGHT`, so the strip follows the finger
 * exactly and the centre band always frames one row.
 *
 * Because the anchor is unbounded the strip never runs out: wrapping (12 → 1,
 * 59 → 00) is just the anchor crossing the end of the item list.
 *
 * A wheel can also be **bounded** instead. A bounded wheel has ends: the
 * anchor is clipped to the item list, the strip may only travel as far as the
 * last item, and a throw may advance it by a single row. Rows are rendered
 * only for real items, so the wheel shows a short list rather than an endless
 * sequence. That is what turns the two-item AM/PM column into a two-state
 * selector instead of an `AM, PM, AM, PM …` strip: the selected period stays
 * in the centre band, the other period is the adjacent option, and a tap on
 * that option selects it.
 */

/** Row height in px. Also the touch target height, so it stays tappable. */
export const WHEEL_ITEM_HEIGHT = 44
/** Rows visible at once: two above, the selection, two below. */
export const WHEEL_VISIBLE_ROWS = 5
/** Extra rows rendered above/below the visible window so a fast drag never
 *  exposes an empty gap. */
const RENDER_MARGIN = 3
/** How long a throw is projected forward, in ms. */
const FLING_PROJECTION_MS = 120
/** Upper bound on the rows a single throw may skip. */
const MAX_FLING_ROWS = 8
const MIN_SETTLE_MS = 120
const MAX_SETTLE_MS = 420
/** Weight of the previous sample in the velocity average. */
const VELOCITY_SMOOTHING = 0.6
/** A gesture that has been still this long is released without a throw. */
const IDLE_THROW_MS = 90
/** A press that travels less than this counts as a tap, not a drag. */
const TAP_SLOP_PX = 10

export type TimeWheelItem<T> = {
  value: T
  label: string
}

export type TimeWheelProps<T> = {
  /** Accessible name of the column, e.g. "Hour". */
  label: string
  items: readonly TimeWheelItem<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  testId?: string
  className?: string
  /** Small caption rendered under the wheel (HOUR / MIN / AM-PM). */
  caption?: string
  /**
   * Give the wheel ends instead of letting it wrap.
   *
   * The anchor is clipped to the item list, the strip stops at the last item
   * and a throw advances the wheel by at most one row, so a two-item column
   * behaves as a two-state selector (AM ⇄ PM) rather than as an endless
   * alternation. Tapping a visible option selects it.
   */
  bounded?: boolean
}

type PointerState = {
  id: number
  startY: number
  lastY: number
  lastTime: number
  velocity: number
}

export function TimeWheel<T extends string | number>({
  label,
  items,
  value,
  onChange,
  disabled = false,
  bounded = false,
  testId,
  className,
  caption,
}: TimeWheelProps<T>) {
  const reducedMotion = usePrefersReducedMotion()
  const elementRef = useRef<HTMLDivElement>(null)

  const [anchor, setAnchor] = useState(() => {
    const found = items.findIndex((item) => Object.is(item.value, value))
    return found >= 0 ? found : 0
  })
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  // Mirrors of the state above so event handlers never act on a stale closure.
  const anchorRef = useRef(anchor)
  const offsetRef = useRef(offset)
  const itemsRef = useRef(items)
  const onChangeRef = useRef(onChange)
  const emittedRef = useRef<unknown>(null)
  const pointerRef = useRef<PointerState | null>(null)
  const frameRef = useRef<number | null>(null)

  itemsRef.current = items
  onChangeRef.current = onChange

  const stopAnimation = useCallback(() => {
    if (frameRef.current === null) return
    cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }, [])

  /**
   * Tell the parent which row is selected, but only when it really changed.
   *
   * `row` is the fractional row framed by the centre band. A cyclic wheel
   * folds it back into the item list and so wraps around; a bounded wheel
   * clips it, so only a real item is ever emitted.
   */
  const emit = useCallback(
    (row: number) => {
      const list = itemsRef.current
      if (!list.length) return
      const index = bounded
        ? wheelBoundedAnchor(Math.round(row), list.length)
        : wheelMod(Math.round(row), list.length)
      const item = list[index]
      if (!item) return
      if (Object.is(item.value, emittedRef.current)) return
      emittedRef.current = item.value
      onChangeRef.current(item.value)
    },
    [bounded],
  )

  /** Move the strip by whole rows and settle immediately. */
  const moveBy = useCallback(
    (delta: number) => {
      stopAnimation()
      const list = itemsRef.current
      const next = bounded
        ? wheelBoundedAnchor(anchorRef.current + delta, list.length)
        : anchorRef.current + delta
      anchorRef.current = next
      setAnchor(next)
      offsetRef.current = 0
      setOffset(0)
      emit(next)
    },
    [bounded, emit, stopAnimation],
  )

  const moveByRef = useRef(moveBy)
  moveByRef.current = moveBy

  /** Animate the strip to `target` and fold the travelled rows into the anchor. */
  const animateTo = useCallback(
    (target: number, advance: number) => {
      const from = offsetRef.current
      const distance = Math.abs(target - from)

      const settle = () => {
        const next = anchorRef.current + advance
        anchorRef.current = next
        setAnchor(next)
        offsetRef.current = 0
        setOffset(0)
        emit(next)
      }

      if (distance < 0.5 || reducedMotion) {
        settle()
        return
      }

      const duration = Math.min(MAX_SETTLE_MS, MIN_SETTLE_MS + distance * 6)
      const start = performance.now()
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = from + (target - from) * eased
        offsetRef.current = current
        setOffset(current)
        // The highlighted row moves with the animation, so the value follows.
        emit(wheelCentreIndex(anchorRef.current, current, WHEEL_ITEM_HEIGHT))
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(step)
          return
        }
        frameRef.current = null
        settle()
      }
      frameRef.current = requestAnimationFrame(step)
    },
    [emit, reducedMotion],
  )

  /** End a drag: project the throw forward and snap onto the nearest row. */
  const settleDrag = useCallback(
    (velocity: number) => {
      const raw = wheelFlingAdvance({
        offset: offsetRef.current,
        velocity,
        itemHeight: WHEEL_ITEM_HEIGHT,
        projectionMs: FLING_PROJECTION_MS,
        maxRows: MAX_FLING_ROWS,
      })
      // A bounded wheel may only advance to the next real item, so a throw can
      // move it by at most one state.
      const list = itemsRef.current
      const advance = bounded
        ? wheelBoundedAdvance(anchorRef.current, raw, list.length)
        : raw
      animateTo(-advance * WHEEL_ITEM_HEIGHT, advance)
    },
    [animateTo, bounded],
  )

  // A value pushed in from outside (the sheet re-seeded, the parent reset the
  // draft) re-centres the wheel. Our own emissions are echoed back by the
  // parent and ignored, so the wheel is never yanked mid-gesture.
  useEffect(() => {
    const list = itemsRef.current
    const emitted = emittedRef.current
    emittedRef.current = null
    if (emitted !== null && Object.is(emitted, value)) return
    const index = list.findIndex((item) => Object.is(item.value, value))
    if (index < 0) return
    const resting = bounded
      ? wheelBoundedAnchor(anchorRef.current, list.length)
      : wheelMod(anchorRef.current, list.length)
    if (index === resting) return
    stopAnimation()
    anchorRef.current = index
    setAnchor(index)
    offsetRef.current = 0
    setOffset(0)
  }, [value, bounded, stopAnimation])

  // A mouse wheel over the column spins it too. React registers `onWheel` as a
  // passive listener, which cannot cancel the page scroll, so the listener is
  // attached by hand with `{ passive: false }`.
  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (disabled) return
      event.preventDefault()
      moveByRef.current(event.deltaY > 0 ? 1 : -1)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [disabled])

  useEffect(() => stopAnimation, [stopAnimation])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    stopAnimation()
    // Capture keeps the gesture on the wheel even when the finger slides off
    // it. Some engines refuse the capture for a pointer that is not active,
    // which must never break the gesture.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* the gesture still works without capture */
    }
    pointerRef.current = {
      id: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
    }
    setDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    const delta = event.clientY - pointer.lastY
    const elapsed = event.timeStamp - pointer.lastTime
    if (elapsed > 0) {
      const instant = delta / elapsed
      pointer.velocity = pointer.velocity * VELOCITY_SMOOTHING + instant * (1 - VELOCITY_SMOOTHING)
    }
    pointer.lastY = event.clientY
    pointer.lastTime = event.timeStamp

    const raw = offsetRef.current + delta
    // A bounded wheel stops at the end of its list, so the band always frames
    // a real item and the strip never runs off into empty rows.
    const next = bounded
      ? wheelBoundedOffset(anchorRef.current, raw, WHEEL_ITEM_HEIGHT, itemsRef.current.length)
      : raw
    offsetRef.current = next
    setOffset(next)
    emit(wheelCentreIndex(anchorRef.current, next, WHEEL_ITEM_HEIGHT))
  }

  /**
   * Select the option under a tap.
   *
   * Only a bounded wheel answers a tap this way: the row the finger landed on
   * is turned into the selected one, so the visible alternative (the other
   * period) can be picked directly.
   */
  const selectRowAt = useCallback((clientY: number) => {
    const element = elementRef.current
    const list = itemsRef.current
    if (!element || !list.length) return
    const rect = element.getBoundingClientRect()
    const bandCentre = rect.top + rect.height / 2
    const row = Math.round((clientY - bandCentre - offsetRef.current) / WHEEL_ITEM_HEIGHT)
    const candidate = anchorRef.current + row
    // A tap on empty space (past the end of the list) changes nothing.
    if (candidate < 0 || candidate >= list.length) return
    const target = wheelBoundedAnchor(candidate, list.length)
    moveByRef.current(target - anchorRef.current)
  }, [])

  /** Release the pointer and hand back the gesture that ended it. */
  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return null
    pointerRef.current = null
    setDragging(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* the capture was already released */
    }
    return pointer
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = finishDrag(event)
    if (!pointer) return
    // A press that never really moved is a tap, not a drag.
    if (bounded && Math.abs(event.clientY - pointer.startY) <= TAP_SLOP_PX) {
      selectRowAt(event.clientY)
      return
    }
    // A finger that came to rest before lifting lets go of the wheel where it
    // is — the throw only counts while the gesture is still moving.
    const idle = event.timeStamp - pointer.lastTime
    settleDrag(idle > IDLE_THROW_MS ? 0 : pointer.velocity)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = finishDrag(event)
    if (!pointer) return
    const idle = event.timeStamp - pointer.lastTime
    settleDrag(idle > IDLE_THROW_MS ? 0 : pointer.velocity)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const list = itemsRef.current
    if (!list.length) return

    let delta: number | null = null
    if (event.key === 'ArrowUp') delta = -1
    else if (event.key === 'ArrowDown') delta = 1
    else if (event.key === 'PageUp') delta = -5
    else if (event.key === 'PageDown') delta = 5
    else if (event.key === 'Home') {
      // A bounded wheel walks straight to the first item instead of taking
      // the short way around a ring.
      delta = bounded
        ? -wheelBoundedAnchor(anchorRef.current, list.length)
        : wheelRingDelta(wheelMod(anchorRef.current, list.length), 0, list.length)
    } else if (event.key === 'End') {
      delta = bounded
        ? list.length - 1 - wheelBoundedAnchor(anchorRef.current, list.length)
        : wheelRingDelta(wheelMod(anchorRef.current, list.length), list.length - 1, list.length)
    } else return

    event.preventDefault()
    moveBy(delta)
  }

  const centre = wheelCentreIndex(anchor, offset, WHEEL_ITEM_HEIGHT)
  const selectedIndex = bounded
    ? wheelBoundedIndex(anchor, offset, WHEEL_ITEM_HEIGHT, items.length)
    : wheelMod(Math.round(centre), items.length)
  const selected = items[selectedIndex]
  const base = Math.round(centre)
  const first = base - RENDER_MARGIN
  const last = base + RENDER_MARGIN

  const rows = []
  for (let index = first; index <= last; index += 1) {
    // A bounded wheel renders real items only, so the strip ends at the last
    // row of the list instead of folding back to its first row.
    const itemIndex = bounded ? index : wheelMod(index, items.length)
    if (itemIndex < 0 || itemIndex >= items.length) continue
    const item = items[itemIndex]
    if (!item) continue
    const distance = Math.abs(index - centre)
    rows.push(
      <div
        key={index}
        aria-hidden="true"
        className={cn(
          'vault-data absolute inset-x-0 flex items-center justify-center text-xl font-bold',
          distance < 0.5
            ? 'text-ink'
            : distance < 1.5
              ? 'text-ink/55'
              : distance < 2.5
                ? 'text-ink/30'
                : 'text-ink/15',
        )}
        style={{
          height: WHEEL_ITEM_HEIGHT,
          top: '50%',
          transform: `translateY(calc(-50% + ${(index - anchor) * WHEEL_ITEM_HEIGHT}px))`,
        }}
      >
        {item.label}
      </div>,
    )
  }

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div
        ref={elementRef}
        role="spinbutton"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, items.length - 1)}
        aria-valuenow={selectedIndex}
        aria-valuetext={selected?.label ?? ''}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        data-testid={testId}
        data-value={selected ? String(selected.value) : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative w-full overflow-hidden rounded-lg outline-none',
          'touch-none select-none overscroll-contain',
          disabled ? 'cursor-not-allowed opacity-50' : dragging ? 'cursor-grabbing' : 'cursor-grab',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
        style={{ height: WHEEL_VISIBLE_ROWS * WHEEL_ITEM_HEIGHT }}
      >
        {/* The selection band: a restrained burnt-orange stripe over the centre row. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 rounded-md border-y border-accent/45 bg-accent/15"
          style={{ top: `calc(50% - ${WHEEL_ITEM_HEIGHT / 2}px)`, height: WHEEL_ITEM_HEIGHT }}
        />
        {/* The strip itself. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ transform: `translateY(${offset}px)` }}
        >
          {rows}
        </div>
      </div>
      {caption ? (
        <span className="vault-label text-ink-soft/60">
          {caption}
        </span>
      ) : null}
    </div>
  )
}
