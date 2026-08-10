import { useRef } from 'react'
import { motion, useMotionTemplate, useScroll, useSpring, useTransform } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { Atmosphere } from '../Atmosphere'
import { Magnetic } from '../Magnetic'
import { ShimmerText } from '../ShimmerText'
import { ParticleField } from './ParticleField'
import { JournalBook } from './JournalBook'
import { PhotoCardLayer } from './PhotoCardLayer'
import { CategoryCardsLayer } from './CategoryCardsLayer'
import { SearchElementsLayer } from './SearchElementsLayer'
import { STORY } from './storyboard'

type CameraSceneProps = {
  onGetStarted: () => void
}

// Whole-page scroll distance for the 9-beat continuous scene — kept close to the previous
// single-object scene's length, only modestly longer to give the extra beats room to breathe.
const PIN_HEIGHT = '820vh'

const CAMERA_KEYPOINTS = [0, STORY.opening[0], STORY.page1[1], STORY.page3[1], 1]

// Every distinct camera pose the "chapter" boundaries hit — approach, cover opening, each of the
// three pages, both mid-story turns (with a quick whip past the checkpoint for a snappier turn),
// the climax, and the closing return. One shared timeline so every angle stays in sync with the
// book's own flips and the floating object layers. Keypoints must stay strictly increasing, so
// adjoining stage boundaries that share an instant (e.g. Page 3 ending exactly where the climax
// begins) collapse into a single shared keypoint.
const CHAPTER_KEYPOINTS = [
  0,
  STORY.approach[1],
  STORY.opening[1],
  STORY.page1[1] - 0.02,
  STORY.turn1[0],
  STORY.turn1[1],
  STORY.page2[1] - 0.02,
  STORY.turn2[0],
  STORY.turn2[1],
  STORY.page3[1],
  STORY.converge[1],
  1,
]

/** Cinematic scroll scene: a real journal (react-pageflip) that turns its own pages on scroll
 * checkpoints, orbited by a simulated camera that dollies/orbits/banks — depth and distance
 * come from moving the "camera", not from scaling the book. Floating object layers emerge from
 * each page, accumulate around the book, then retreat together before the closing CTA. */
export function CameraScene({ onGetStarted }: CameraSceneProps) {
  const pinRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: pinRef, offset: ['start start', 'end end'] })
  const progress = useSpring(scrollYProgress, { stiffness: 40, damping: 24, mass: 1.4 })

  // The "camera": perspective distance shrinks (dolly-in) at each approach beat instead of the
  // book growing — this is what makes the user feel like they're walking toward the journal.
  const cameraPerspective = useTransform(progress, CAMERA_KEYPOINTS, [2600, 1700, 1500, 1050, 780])
  const worldZ = useTransform(progress, CAMERA_KEYPOINTS, [-140, 0, 20, 90, 150])
  // Deliberately tiny — a residual accent only, not the primary depth cue (per spec: remove
  // most scale-based animation in favor of real camera movement).
  const worldScale = useTransform(progress, CAMERA_KEYPOINTS, [0.92, 1, 1, 1.02, 1.05])

  // A distinct viewing angle per chapter: front-on approach, a 3/4 turn to watch the cover swing
  // open, favoring the right page while Page 1's card emerges top-right, a quick whip-pan
  // through each turn, favoring the left page for Page 2's scattered cards, back to centered and
  // a little higher for Page 3's search results, then a wide hero angle for the climax before
  // settling into a clean, near-frontal closing pose.
  const driveRotateY = useTransform(progress, CHAPTER_KEYPOINTS, [-14, -14, -22, 10, -6, 8, -16, 8, -6, 3, 0, 0])
  const driveTiltX = useTransform(progress, CHAPTER_KEYPOINTS, [4, 4, 8, 3, 10, -8, 2, 9, -7, -5, -2, 0])

  // Simulated camera orbit: perspective-origin sweep + a subtle bank/dolly opposite the book's
  // own turn, so it reads as the viewpoint moving around a still object — each chapter gets its
  // own origin so the "eye" visibly relocates rather than just drifting continuously.
  const originX = useTransform(progress, CHAPTER_KEYPOINTS, [42, 42, 58, 66, 50, 34, 30, 46, 50, 58, 50, 50])
  const originY = useTransform(progress, CHAPTER_KEYPOINTS, [50, 50, 38, 34, 42, 46, 40, 36, 42, 30, 38, 44])
  const perspectiveOrigin = useMotionTemplate`${originX}% ${originY}%`
  const cameraBank = useTransform(progress, CHAPTER_KEYPOINTS, [2, 2, -3, 3, -5, 4, -3, 4, -5, 2, 0, 0])
  const cameraDolly = useTransform(progress, CHAPTER_KEYPOINTS, [0, 0, -10, -16, -4, 6, 14, 4, -6, -10, 0, 0])



  const shadowScale = useTransform(worldZ, [-140, 150], [1.3, 0.55])
  const shadowOpacity = useTransform(worldZ, [-140, 150], [0.14, 0.44])

  // Warm light leak: fades in as the cover opens, holds while the book is open, softens back
  // down (never fully vanishing) as the scene settles into the closing CTA.
  const lightLeakOpacity = useTransform(
    progress,
    [STORY.opening[0], STORY.opening[1], STORY.returnHome[0], 1],
    [0, 1, 1, 0.4],
  )

  // Depth-parallax layers — same progress input, different amplitudes, so background/floor/
  // foreground read as sitting at different distances from the camera.
  const bgY = useTransform(progress, [0, 1], [-30, 30])
  const bgScale = useTransform(progress, [0, 1], [1, 1.16])
  const floorY = useTransform(progress, [0, 1], [-60, 60])
  const floorOpacity = useTransform(progress, [0, 0.5, 1], [0.2, 0.46, 0.22])
  const fgScale = useTransform(progress, [0, 1], [1, 1.08])

  // Two HTML-overlay beats bookend the scene: the intro title (book still far/closed) and the
  // closing CTA (everything has returned to the journal) — everything in between is told
  // through the book's own pages and the floating objects, not crossfading text panels.
  const introOpacity = useTransform(progress, [0, 0.06, STORY.opening[0]], [1, 1, 0])
  const ctaOpacity = useTransform(progress, [STORY.returnHome[0] + 0.04, 1], [0, 1])
  const ctaPointerEvents = useTransform(ctaOpacity, (value) => (value > 0.5 ? 'auto' : 'none'))

  // Chapter folio in the corner — reads as a numbered artifact as the story advances.
  const FOLIO_KEYPOINTS = [
    0,
    STORY.approach[1],
    STORY.opening[1],
    STORY.page1[1],
    STORY.page2[1],
    STORY.page3[1],
    1,
  ]
  const folioLabel = useTransform(progress, FOLIO_KEYPOINTS, [
    '01 · Approach',
    '02 · Opening',
    '03 · Capture',
    '04 · Organize',
    '05 · Find',
    '06 · Ready',
    '06 · Ready',
  ])

  return (
    <main className="relative">
      <Atmosphere variant="full" />

      <button
        type="button"
        onClick={onGetStarted}
        className="term-chip fixed right-4 top-4 z-20 rounded-full px-4 py-2 text-sm font-medium uppercase tracking-wide"
      >
        Sign in
      </button>

      <motion.div
        aria-hidden="true"
        className="text-micro fixed left-4 top-4 z-20 hidden select-none text-ink-soft sm:block"
      >
        <motion.span>Raj&apos;s — </motion.span>
        <motion.span className="text-accent">{folioLabel}</motion.span>
      </motion.div>

      <div ref={pinRef} className="relative" style={{ height: PIN_HEIGHT }}>
        <div className="sticky top-0 flex h-screen flex-col items-center justify-center gap-8 overflow-hidden px-4 text-center">
          {/* Background layer — farthest, slowest drift. */}
          <motion.span
            aria-hidden="true"
            className="bg-accent/15 pointer-events-none absolute inset-0 m-auto rounded-full blur-3xl"
            style={{
              width: 'clamp(280px, 46vmin, 480px)',
              height: 'clamp(280px, 46vmin, 480px)',
              y: bgY,
              scale: bgScale,
            }}
          />
          <ParticleField progress={progress} />

          {/* Midground "exhibition floor" glow. */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[16%] left-1/2 -translate-x-1/2 rounded-full bg-black blur-2xl"
            style={{
              width: 'clamp(180px, 30vmin, 300px)',
              height: 'clamp(30px, 6vmin, 48px)',
              y: floorY,
              opacity: floorOpacity,
            }}
          />

          {/* Foreground haze — closest layer, cinematic vignette framing. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              scale: fgScale,
              background: 'radial-gradient(ellipse at center, transparent 45%, rgba(16,9,4,0.55) 100%)',
            }}
          />

          {/* Perspective stage — the simulated camera. */}
          <motion.div
            className="relative flex items-center justify-center"
            style={{
              perspective: cameraPerspective,
              perspectiveOrigin,
              transformStyle: 'preserve-3d',
              rotate: cameraBank,
              x: cameraDolly,
              width: 'clamp(320px, 50vmin, 520px)',
              height: 'clamp(420px, 64vmin, 640px)',
            }}
          >
            {/* Ambient volumetric glow around the journal. */}
            <motion.span
              aria-hidden="true"
              className="bg-accent/20 absolute inset-0 m-auto rounded-full blur-3xl"
              style={{ width: 'clamp(220px, 34vmin, 360px)', height: 'clamp(220px, 34vmin, 360px)' }}
              animate={{ opacity: [0.22, 0.42, 0.22], scale: [0.92, 1.05, 0.92] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Warm light leak, seeping from between the pages as the cover opens. */}
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 m-auto rounded-full blur-2xl"
              style={{
                width: 'clamp(160px, 26vmin, 280px)',
                height: 'clamp(160px, 26vmin, 280px)',
                background: 'radial-gradient(circle, rgba(255,214,150,0.55), transparent 70%)',
                opacity: lightLeakOpacity,
              }}
            />

            {/* Contact shadow — tightens/darkens as the world lifts closer to camera. */}
            <motion.span
              aria-hidden="true"
              className="absolute bottom-[2%] left-1/2 -translate-x-1/2 rounded-full bg-black blur-2xl"
              style={{
                width: 'clamp(140px, 24vmin, 240px)',
                height: 'clamp(24px, 5vmin, 40px)',
                scale: shadowScale,
                opacity: shadowOpacity,
              }}
            />

            {/* Idle orbit: a slow endless drift so the journal reads as suspended in space. */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{ rotateY: [-5, 5, -5], y: [0, -8, 0] }}
              transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* World — the journal plus every floating object, all moved by the camera
                  together (real dolly) rather than the book alone being scaled up. */}
              <motion.div
                className="relative flex items-center justify-center"
                style={{
                  transformStyle: 'preserve-3d',
                  width: 'clamp(300px, 46vmin, 460px)',
                  height: 'clamp(400px, 60vmin, 600px)',
                  rotateY: driveRotateY,
                  rotateX: driveTiltX,
                  z: worldZ,
                  scale: worldScale,
                }}
              >
                <div style={{ width: 'clamp(170px, 26vmin, 260px)', height: 'clamp(230px, 36vmin, 350px)' }}>
                  <JournalBook progress={progress} />
                </div>

                <PhotoCardLayer progress={progress} />
                <CategoryCardsLayer progress={progress} />
                <SearchElementsLayer progress={progress} />
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Intro title — the only beat before the journal itself takes over the story. */}
          <motion.div
            style={{ opacity: introOpacity }}
            className="absolute inset-x-0 bottom-[8%] flex flex-col items-center gap-4 px-4"
          >
            <p className="text-micro text-ink-soft">Raj&apos;s — a personal vault</p>
            <div style={{ '--text-display': 'clamp(1.9rem, 5.5vw, 3.75rem)' } as React.CSSProperties}>
              <ShimmerText
                as="h1"
                text="Your life, saved beautifully."
                className="text-display block max-w-4xl text-center"
              />
            </div>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="text-ink-soft"
            >
              <ChevronDown size={22} aria-hidden="true" />
            </motion.div>
          </motion.div>

          {/* Closing CTA — appears once every floating object has returned to the journal. */}
          <motion.div
            style={{ opacity: ctaOpacity, pointerEvents: ctaPointerEvents }}
            className="absolute inset-x-0 bottom-[6%] flex flex-col items-center gap-4 px-4"
          >
            <h2
              className="text-display text-center"
              style={{ '--text-display': 'clamp(1.9rem, 6vw, 4.25rem)' } as React.CSSProperties}
            >
              Ready when you are.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-ink-soft">
              Sign in to sync everything across your devices — or try it without an account.
            </p>
            <Magnetic className="inline-block">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={onGetStarted}
                className="term-btn-primary rounded-full px-7 py-3.5 text-sm font-semibold uppercase tracking-widest"
              >
                Get started
              </motion.button>
            </Magnetic>
          </motion.div>
        </div>
      </div>
    </main>
  )
}
