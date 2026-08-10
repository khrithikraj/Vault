import { CameraScene } from './landing/CameraScene'
import { JournalFallback } from './landing/JournalFallback'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

type LandingPageProps = {
  onGetStarted: () => void
}

/** Public entry point for the landing experience — picks between the full cinematic
 * scroll-driven journal scene and a calmer static-section fallback for reduced motion. */
export function LandingPage({ onGetStarted }: LandingPageProps) {
  const reducedMotion = usePrefersReducedMotion()

  if (reducedMotion) return <JournalFallback onGetStarted={onGetStarted} />
  return <CameraScene onGetStarted={onGetStarted} />
}
