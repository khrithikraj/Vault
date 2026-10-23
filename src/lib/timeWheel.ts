/**
 * Scroll-wheel maths.
 *
 * A wheel keeps an unbounded integer `anchor` (the row that sits in the centre
 * band when the strip is at rest) plus a pixel `offset` (how far the strip has
 * been dragged away from that rest position). The row framed by the centre
 * band is therefore `anchor - offset / itemHeight`, folded back into the item
 * list with a positive modulo — which is also what makes the wheel wrap
 * (12 → 1, 59 → 00) without ever running out of rows.
 *
 * These helpers are pure so the wrapping, the fling projection and the snap
 * can be pinned by tests without a DOM.
 *
 * The same maths serves two kinds of wheel. A **cyclic** wheel (hours,
 * minutes) folds every row back into the item list, so it wraps around
 * (12 → 1, 59 → 00) and never runs out of rows. A **bounded** wheel (the
 * AM/PM column) clips instead: the anchor, the travel of the strip and the
 * rows a throw may advance are all held inside the list, so the wheel has
 * ends and can never alternate between its two states forever.
 */

/** Positive modulo, so a negative anchor still maps onto a real row. */
export function wheelMod(value: number, size: number): number {
  if (size <= 0) return 0
  return ((value % size) + size) % size
}

/**
 * The row index framed by the centre band.
 *
 * A positive offset means the strip was dragged down, so the centre shows an
 * earlier row.
 */
export function wheelCentreIndex(anchor: number, offset: number, itemHeight: number): number {
  if (itemHeight <= 0) return anchor
  return anchor - offset / itemHeight
}

/**
 * How many whole rows a drag plus its throw travels.
 *
 * `offset` is the current pixel displacement and `velocity` the throw speed in
 * px/ms (positive while the finger moves down). The throw is projected
 * forward over `projectionMs`, the total is rounded to whole rows and clamped
 * so one violent flick can never skip half the list.
 */
export function wheelFlingAdvance(options: {
  offset: number
  velocity: number
  itemHeight: number
  projectionMs: number
  maxRows: number
}): number {
  const { offset, velocity, itemHeight, projectionMs, maxRows } = options
  if (itemHeight <= 0) return 0
  const dragged = -offset / itemHeight
  const thrown = (-velocity * projectionMs) / itemHeight
  const projected = dragged + thrown
  const rounded = Math.round(projected)
  return Math.max(-maxRows, Math.min(maxRows, rounded))
}

/**
 * The shortest way around a ring of `size` items from `current` to `target`.
 *
 * Used by the Home/End keys so the wheel never spins through the whole list
 * to reach the other end.
 */
export function wheelRingDelta(current: number, target: number, size: number): number {
  if (size <= 0) return 0
  const half = size / 2
  let delta = target - current
  if (delta > half) delta -= size
  if (delta < -half) delta += size
  return delta
}

/* ──────────────────────────────────────────────────────────────────────────
 * Bounded wheels — wheels with ends.
 *
 * A cyclic wheel has no ends: the anchor runs to infinity and every visible
 * row is folded back into the item list, so a two-item column renders an
 * endless `AM, PM, AM, PM …` strip. A bounded wheel clips instead, which
 * turns a two-item column into a two-state selector: the selected value stays
 * in the centre band, the other value is the adjacent option, and neither the
 * strip nor a throw can carry the wheel past an end.
 * ────────────────────────────────────────────────────────────────────────── */

/** Clamps `value` into the inclusive range [min, max]. */
export function wheelClamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * The anchor a bounded wheel may rest on: the index of a real item.
 *
 * A bounded wheel never wraps, so its anchor is clipped to the item list
 * instead of running off either end of it.
 */
export function wheelBoundedAnchor(anchor: number, size: number): number {
  if (size <= 0) return 0
  return wheelClamp(anchor, 0, size - 1)
}

/**
 * How far a bounded wheel may travel from its anchor, in pixels.
 *
 * The strip can move at most one row past the last item, so the centre band
 * always frames a real item and the wheel can never expose an endless
 * sequence of rows.
 */
export function wheelBoundedOffset(
  anchor: number,
  offset: number,
  itemHeight: number,
  size: number,
): number {
  const resting = wheelBoundedAnchor(anchor, size)
  const min = (resting - (size - 1)) * itemHeight
  const max = resting * itemHeight
  return wheelClamp(offset, min, max)
}

/**
 * How many rows a bounded wheel may advance from its anchor.
 *
 * The advance is clipped to the ends of the list, so a throw can move the
 * wheel by at most one state — it can never skip one, let alone several.
 */
export function wheelBoundedAdvance(anchor: number, advance: number, size: number): number {
  const resting = wheelBoundedAnchor(anchor, size)
  return wheelClamp(advance, -resting, size - 1 - resting)
}

/**
 * The item a bounded wheel shows in its centre band.
 *
 * The band of a bounded strip always frames a real item, so the row is
 * clipped into the list rather than folded back around it.
 */
export function wheelBoundedIndex(
  anchor: number,
  offset: number,
  itemHeight: number,
  size: number,
): number {
  if (size <= 0) return 0
  return wheelClamp(
    Math.round(wheelCentreIndex(anchor, offset, itemHeight)),
    0,
    size - 1,
  )
}
