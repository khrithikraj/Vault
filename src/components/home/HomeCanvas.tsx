import type { CSSProperties } from 'react'
import type { Category } from '../../types/app'

type HomeCanvasProps = {
  activeCategory?: Category | null
}

export function HomeCanvas({ activeCategory }: HomeCanvasProps) {
  const glowColor = activeCategory?.color ?? '#c44800'

  return (
    <div
      className="home-canvas"
      style={{ '--home-category-color': glowColor } as CSSProperties}
      aria-hidden="true"
    >
      <div className="home-grid" />
      <div className="home-ledger" />
      <div className="home-category-glow" />
      <div className="home-edge-warmth" />
      <div className="home-watermark">THE ACCESSION</div>
      <div className="home-vignette" />
    </div>
  )
}
