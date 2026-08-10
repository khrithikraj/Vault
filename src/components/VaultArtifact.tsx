import { motion } from 'motion/react'
import { Lock } from 'lucide-react'
import { BrandIcon } from '../lib/icons'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

const FACE_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  border: '1px solid rgba(255, 237, 215, 0.18)',
  background: 'linear-gradient(160deg, #382416, #1c1006 55%, #100904)',
  backfaceVisibility: 'hidden',
}

/** The signature auth artifact: a vault-door cube slowly tumbling in warm darkness, rim-lit and
 * lit from below by a floor glow. Purely decorative — the "lone object in warm darkness" hero
 * moment from the Oryzo system, made real 3D. */
export function VaultArtifact({ size = 92 }: { size?: number }) {
  const half = size / 2
  const side = `rotateY(90deg) translateZ(${half}px)`
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div className="relative flex flex-col items-center" style={{ perspective: 1000 }}>
      <motion.span
        aria-hidden="true"
        className="bg-accent/25 absolute inset-[-30px] rounded-full blur-3xl"
        {...(reducedMotion
          ? {}
          : {
              animate: { opacity: [0.35, 0.65, 0.35], scale: [0.92, 1.07, 0.92] },
              transition: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
            })}
      />
      <motion.div
        aria-hidden="true"
        className="relative"
        style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
        {...(reducedMotion
          ? {}
          : {
              animate: { rotateX: [14, -14, 14], rotateY: [0, -360, 0] },
              transition: { duration: 16, repeat: Infinity, ease: 'easeInOut' },
            })}
      >
        <div
          className="flex items-center justify-center rounded-sm"
          style={{ ...FACE_STYLE, display: 'flex', boxShadow: 'inset 0 1px 0 rgba(255,237,215,0.08)' }}
        >
          <BrandIcon icon={Lock} size={26} />
        </div>
        <div style={{ ...FACE_STYLE, transform: `rotateY(180deg) translateZ(${half}px)` }} />
        <div style={{ ...FACE_STYLE, transform: side }} />
        <div style={{ ...FACE_STYLE, transform: `rotateY(-90deg) translateZ(${half}px)` }} />
        <div style={{ ...FACE_STYLE, transform: `rotateX(90deg) translateZ(${half}px)` }} />
        <div style={{ ...FACE_STYLE, transform: `rotateX(-90deg) translateZ(${half}px)` }} />
      </motion.div>
      <motion.span
        aria-hidden="true"
        className="absolute bottom-[-36px] left-1/2 -translate-x-1/2 rounded-full bg-black blur-2xl"
        style={{ width: size * 1.15, height: 14 }}
        {...(reducedMotion
          ? {}
          : {
              animate: { opacity: [0.35, 0.6, 0.35] },
              transition: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
            })}
      />
    </div>
  )
}
