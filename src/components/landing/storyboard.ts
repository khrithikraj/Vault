import { useTransform, type MotionValue } from 'motion/react'
import { Camera, FolderTree, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const BOOK_WIDTH = 240
export const BOOK_HEIGHT = 320

export const JOURNAL_PAGES: ReadonlyArray<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Camera,
    title: 'Capture',
    body: 'Snap a photo or drop a screenshot the moment you find something worth keeping.',
  },
  { icon: FolderTree, title: 'Organize', body: 'Sort it into a category with fields built for it.' },
  { icon: Search, title: 'Find', body: 'Jump back to it in seconds.' },
]

/** Single source of truth for the 9-beat scroll story, shared by the camera scene, the book's
 * flip-trigger logic, and every floating object layer — see /memories/session/plan.md for the
 * full narrative breakdown behind these numbers. */
export const STORY = {
  approach: [0, 0.1] as const,
  opening: [0.1, 0.18] as const,
  page1: [0.18, 0.34] as const,
  turn1: [0.34, 0.38] as const,
  page2: [0.38, 0.54] as const,
  turn2: [0.54, 0.58] as const,
  page3: [0.58, 0.74] as const,
  converge: [0.74, 0.84] as const,
  returnHome: [0.84, 1] as const,
} as const

/** Scroll checkpoints that trigger a discrete book flip (react-pageflip has no scrub API). */
export const FLIP_CHECKPOINTS = {
  coverOpens: 0.14,
  turnToPage2: 0.36,
  turnToPage3: 0.56,
} as const

/** Progress at which every floating layer starts, and finishes, retracting back into the book. */
export const RETRACT_RANGE = [0.84, 0.92] as const

/** The climax just before retraction: every emerged object sweeps into a full orbit around the
 * journal (memory objects circling before they collapse back into the pages). */
export const ORBIT_RANGE = [0.78, RETRACT_RANGE[0]] as const
export const ORBIT_RADIUS = 46

/** Derives a layer's own emerge->hold->retract curve from its stage's emerge window, sharing
 * the same retract window every layer uses so they all sink back into the page together. */
export function useEmergeProgress(
  progress: MotionValue<number>,
  emergeStart: number,
  emergeEnd: number,
): MotionValue<number> {
  return useTransform(
    progress,
    [emergeStart, emergeEnd, RETRACT_RANGE[0], RETRACT_RANGE[1]],
    [0, 1, 1, 0],
  )
}
