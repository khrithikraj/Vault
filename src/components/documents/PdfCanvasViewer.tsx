/**
 * PdfCanvasViewer — continuous vertical-scroll PDF renderer using `pdfjs-dist`.
 *
 * Replaces the native `<object data=... type="application/pdf">` embed, which many
 * mobile browsers (and some desktop contexts) refuse to render inline, showing
 * "Inline PDF preview is not available in this view." pdfjs renders every page to
 * its own `<canvas>` element client-side, so preview works identically everywhere.
 */

import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
// Vite-friendly worker URL — bundled as a separate asset, not inlined.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { AlertTriangle, Loader2 } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type PdfCanvasViewerProps = {
  url: string
  fileName: string
}

export function PdfCanvasViewer({ url, fileName }: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [accessiblePages, setAccessiblePages] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    const loadingTask = pdfjsLib.getDocument({ url })

    setStatus('loading')
    setError('')
    setAccessiblePages([])

    const container = containerRef.current
    if (container) container.innerHTML = ''

    loadingTask.promise
      .then(async (pdf) => {
        if (cancelled) return
        setPageCount(pdf.numPages)
        const pageTexts: string[] = []

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return
          const page = await pdf.getPage(pageNumber)
          if (cancelled) return
          const textContent = await page.getTextContent()
          pageTexts.push(textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ').trim())

          // Fit to container width; cap the device-pixel-ratio multiplier so huge
          // pages on very high-DPI screens don't blow up canvas memory.
          const containerWidth = container?.clientWidth || 640
          const baseViewport = page.getViewport({ scale: 1 })
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const viewport = page.getViewport({ scale: (containerWidth / baseViewport.width) * dpr })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.style.display = 'block'
          canvas.className = 'mx-auto mb-2 rounded-sm shadow-sm'
          canvas.setAttribute('aria-hidden', 'true')

          const context = canvas.getContext('2d')
          if (!context) continue

          container?.appendChild(canvas)
          await page.render({ canvasContext: context, viewport, canvas }).promise
        }

        if (!cancelled) {
          setAccessiblePages(pageTexts)
          setStatus('ready')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not render this PDF.')
          setStatus('error')
        }
      })

    return () => {
      cancelled = true
      void loadingTask.destroy()
    }
  }, [url, fileName])

  if (status === 'error') {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center text-ink-soft">
        <AlertTriangle size={28} className="text-red-400" />
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {status === 'loading' ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-ink-soft">
          <Loader2 size={28} className="animate-spin text-accent" />
          <p className="text-sm uppercase tracking-widest">Rendering PDF…</p>
        </div>
      ) : null}
      <div ref={containerRef} className={`px-2 py-3 sm:px-4 ${status === 'loading' ? 'hidden' : ''}`} />
      {status === 'ready' ? (
        <section className="sr-only" aria-label={`Text content of ${fileName}`}>
          {accessiblePages.map((text, index) => (
            <div key={index} aria-label={`Page ${index + 1} of ${pageCount}`}>
              <h2>Page {index + 1}</h2>
              <p>{text || 'This page has no extractable text.'}</p>
            </div>
          ))}
        </section>
      ) : null}
      {status === 'ready' && pageCount > 1 ? (
        <p className="pb-3 text-center text-[10px] uppercase tracking-widest text-ink-soft/50" aria-live="polite">
          {pageCount} pages
        </p>
      ) : null}
    </div>
  )
}
