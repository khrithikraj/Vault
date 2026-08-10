import type { MotionValue } from 'motion/react'
import { Hash, MapPin, Search, Tag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandIcon } from '../../lib/icons'
import { EmergingObject } from './EmergingObject'
import { STORY, useEmergeProgress } from './storyboard'

type SearchElementsLayerProps = {
  progress: MotionValue<number>
}

const SEARCH_ELEMENTS: Array<{
  key: string
  icon: LucideIcon
  label: string
  restX: number
  restY: number
  restRotateDeg: number
  depthZ: number
  staggerStart: number
  orbitPhase: number
  kind: 'card' | 'pill'
}> = [
  {
    key: 'result',
    icon: Search,
    label: 'Ramen place',
    restX: 66,
    restY: 16,
    restRotateDeg: -5,
    depthZ: 130,
    staggerStart: 0,
    orbitPhase: 65,
    kind: 'card',
  },
  {
    key: 'tag',
    icon: Tag,
    label: 'Food Spots',
    restX: 10,
    restY: 20,
    restRotateDeg: 4,
    depthZ: 20,
    staggerStart: 0.015,
    orbitPhase: 155,
    kind: 'pill',
  },
  {
    key: 'pin',
    icon: MapPin,
    label: 'Saved',
    restX: 78,
    restY: 58,
    restRotateDeg: 6,
    depthZ: 70,
    staggerStart: 0.03,
    orbitPhase: 245,
    kind: 'pill',
  },
  {
    key: 'keyword',
    icon: Hash,
    label: 'weekend',
    restX: 14,
    restY: 66,
    restRotateDeg: -3,
    depthZ: 45,
    staggerStart: 0.045,
    orbitPhase: 335,
    kind: 'pill',
  },
]

/** The Stage 7 "Find" beat: search results, a tag, a pin, and a keyword chip surfacing from
 * Page 3 — small UI fragments that read as pulled straight out of the journal's contents. */
export function SearchElementsLayer({ progress }: SearchElementsLayerProps) {
  return (
    <>
      {SEARCH_ELEMENTS.map((item) => (
        <SearchElement key={item.key} progress={progress} item={item} />
      ))}
    </>
  )
}

function SearchElement({
  progress,
  item,
}: {
  progress: MotionValue<number>
  item: (typeof SEARCH_ELEMENTS)[number]
}) {
  const start = STORY.page3[0] + 0.02 + item.staggerStart
  const emerge = useEmergeProgress(progress, start, start + 0.06)

  return (
    <EmergingObject
      progress={progress}
      emergeProgress={emerge}
      depthZ={item.depthZ}
      restX={item.restX}
      restY={item.restY}
      restRotateDeg={item.restRotateDeg}
      orbitPhase={item.orbitPhase}
      idleDrift={{ y: -7, rotate: 2.5, duration: 6 }}
    >
      {item.kind === 'card' ? (
        <div
          className="border-cloud/15 flex items-center gap-2 rounded-lg border bg-[#1a1410] px-3 py-2 shadow-2xl"
          style={{ width: 'clamp(110px, 16vmin, 148px)' }}
        >
          <BrandIcon icon={item.icon} size={16} />
          <span className="text-cloud/70 truncate text-[10px] font-semibold">{item.label}</span>
        </div>
      ) : (
        <div className="border-cloud/15 flex items-center gap-1.5 rounded-full border bg-[#1a1410] px-2.5 py-1 shadow-xl">
          <BrandIcon icon={item.icon} size={12} />
          <span className="text-cloud/70 text-[9px] font-semibold uppercase tracking-wide">
            {item.label}
          </span>
        </div>
      )}
    </EmergingObject>
  )
}
