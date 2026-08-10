import type { MotionValue } from 'motion/react'
import { Camera } from 'lucide-react'
import { BrandIcon } from '../../lib/icons'
import { EmergingObject } from './EmergingObject'
import { STORY, useEmergeProgress } from './storyboard'

type PhotoCardLayerProps = {
  progress: MotionValue<number>
}

/** The Stage 3 "Capture" beat: a single tilted photo card that rises out of Page 1, nearest to
 * the viewer of anything in the scene, and keeps drifting there through the rest of the story. */
export function PhotoCardLayer({ progress }: PhotoCardLayerProps) {
  const emerge = useEmergeProgress(progress, STORY.page1[0] + 0.02, STORY.page1[0] + 0.08)

  return (
    <EmergingObject
      progress={progress}
      emergeProgress={emerge}
      depthZ={170}
      restX={62}
      restY={18}
      restRotateDeg={-8}
      orbitPhase={0}
      idleDrift={{ y: -10, rotate: 2, duration: 7 }}
    >
      <div
        className="border-cloud/15 flex flex-col gap-2 rounded-lg border bg-[#efe3cc] p-2 shadow-2xl"
        style={{ width: 'clamp(96px, 15vmin, 132px)' }}
      >
        <div className="from-ink/70 to-ink/40 flex aspect-square items-center justify-center rounded bg-gradient-to-br">
          <BrandIcon icon={Camera} size={26} />
        </div>
        <p className="text-ink/60 text-center text-[9px] font-semibold uppercase tracking-widest">
          Captured
        </p>
      </div>
    </EmergingObject>
  )
}
