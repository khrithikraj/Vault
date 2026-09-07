import type { Category } from '../../types/app'

type HomeCanvasProps = {
  activeCategory?: Category | null
}

/**
 * V2 — Quiet atmospheric archive canvas for the authenticated Home.
 *
 * Layered depth system:
 * 1. Base: near-black espresso radial — lighter at top where content begins
 * 2. Archive grid: extremely fine 80px hairline crosshatch (ivory at 2%)
 * 3. Horizontal rhythm bands: subtle 120px repeating gradient (1.5% opacity)
 * 4. Ember glow: category-aware radial from top — shifts warmth as you navigate
 * 5. Watermark: "RAJ'S VAULT" in huge ghost type, felt not stared at
 * 6. Bottom vignette: grounding darkening gradient
 *
 * The background should be experienced, never noticed.
 * Content stays dominant.
 */
export function HomeCanvas({ activeCategory }: HomeCanvasProps) {
  const glowColor = activeCategory?.color ?? '#c44800'

  return (
    <div className="home-canvas" aria-hidden="true">
      {/* Fine archive-grid crosshatch */}
      <div className="home-grid" />

      {/* Horizontal rhythm — very faint repetitive band structure (like ledger lines) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(245,234,216,0.012) 0px, transparent 1px)',
          backgroundSize: '100% 80px',
          opacity: 1,
        }}
      />

      {/* Category-aware ember glow from top — wide and restrained */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(62% 48% at 50% -8%, ${glowColor}1c 0%, transparent 70%)`,
          transition: 'background 1.2s ease',
        }}
      />

      {/* Subtle side warmth — slightly warmer right edge */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(40% 60% at 100% 20%, rgba(196,72,0,0.04) 0%, transparent 60%)',
        }}
      />

      {/* Central watermark — enormous ghost, opacity barely perceptible */}
      <div className="home-watermark">RAJ'S VAULT</div>

      {/* Bottom grounding gradient */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/50 to-transparent" />
    </div>
  )
}
