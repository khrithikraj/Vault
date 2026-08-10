import type { MotionValue } from 'motion/react'
import { Briefcase, Plane, ShoppingBag, Utensils } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandIcon } from '../../lib/icons'
import { EmergingObject } from './EmergingObject'
import { STORY, useEmergeProgress } from './storyboard'

type CategoryCardsLayerProps = {
  progress: MotionValue<number>
}

const CATEGORY_CARDS: Array<{
  label: string
  icon: LucideIcon
  restX: number
  restY: number
  restRotateDeg: number
  depthZ: number
  staggerStart: number
  orbitPhase: number
}> = [
  { label: 'Travel', icon: Plane, restX: 12, restY: 14, restRotateDeg: -6, depthZ: 60, staggerStart: 0, orbitPhase: 20 },
  {
    label: 'Food',
    icon: Utensils,
    restX: 70,
    restY: 12,
    restRotateDeg: 5,
    depthZ: 110,
    staggerStart: 0.015,
    orbitPhase: 110,
  },
  {
    label: 'Shopping',
    icon: ShoppingBag,
    restX: 8,
    restY: 62,
    restRotateDeg: 4,
    depthZ: 30,
    staggerStart: 0.03,
    orbitPhase: 200,
  },
  {
    label: 'Work',
    icon: Briefcase,
    restX: 74,
    restY: 64,
    restRotateDeg: -4,
    depthZ: 80,
    staggerStart: 0.045,
    orbitPhase: 290,
  },
]

/** The Stage 5 "Organize" beat: four category cards emerging from Page 2, each at its own
 * depth/stagger so they read as scattered around the journal rather than stacked flat. */
export function CategoryCardsLayer({ progress }: CategoryCardsLayerProps) {
  return (
    <>
      {CATEGORY_CARDS.map((card) => (
        <CategoryCard key={card.label} progress={progress} card={card} />
      ))}
    </>
  )
}

function CategoryCard({
  progress,
  card,
}: {
  progress: MotionValue<number>
  card: (typeof CATEGORY_CARDS)[number]
}) {
  const start = STORY.page2[0] + 0.02 + card.staggerStart
  const emerge = useEmergeProgress(progress, start, start + 0.06)

  return (
    <EmergingObject
      progress={progress}
      emergeProgress={emerge}
      depthZ={card.depthZ}
      restX={card.restX}
      restY={card.restY}
      restRotateDeg={card.restRotateDeg}
      orbitPhase={card.orbitPhase}
      idleDrift={{ y: -8, rotate: 3, duration: 6.5 }}
    >
      <div
        className="border-cloud/15 flex items-center gap-2 rounded-lg border bg-[#1a1410] px-3 py-2 shadow-2xl"
        style={{ width: 'clamp(90px, 13vmin, 118px)' }}
      >
        <BrandIcon icon={card.icon} size={16} />
        <span className="text-cloud/70 text-[10px] font-semibold uppercase tracking-wide">
          {card.label}
        </span>
      </div>
    </EmergingObject>
  )
}
