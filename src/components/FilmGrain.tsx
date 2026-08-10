/** Fixed photographic film-grain overlay (SVG feTurbulence). Rendered once at the app root —
 * the noise is static and re-composited by the browser, so it adds a warm, non-digital texture
 * to the dark without any per-frame cost. Pure decoration: aria-hidden, pointer-events-none. */
export function FilmGrain() {
  return (
    <div aria-hidden="true" className="film-grain">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="raj-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#raj-grain)" opacity="0.6" />
      </svg>
    </div>
  )
}
