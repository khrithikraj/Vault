import { forwardRef, useRef } from 'react'
import HTMLFlipBook from 'react-pageflip'
import { NotebookPen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandIcon } from '../../lib/icons'
import { BOOK_HEIGHT, BOOK_WIDTH, FLIP_CHECKPOINTS, JOURNAL_PAGES } from './storyboard'
import type { MotionValue } from 'motion/react'
import { motion, useMotionValueEvent, useTransform } from 'motion/react'

/** Minimal shape of the StPageFlip instance we actually call — the library's own bundled
 * types leave the ref as `any`, so a small local contract keeps call sites honest. */
type PageFlipController = {
  flipNext: (corner?: 'top' | 'bottom') => void
  flipPrev: (corner?: 'top' | 'bottom') => void
  getCurrentPageIndex: () => number
  turnToPage?: (pageNum: number) => void
  flip?: (pageNum: number, corner?: 'top' | 'bottom') => void
}
type FlipBookHandle = { pageFlip: () => PageFlipController }

function targetIndexForProgress(value: number): number {
  if (value >= FLIP_CHECKPOINTS.turnToPage3) return 3
  if (value >= FLIP_CHECKPOINTS.turnToPage2) return 2
  if (value >= FLIP_CHECKPOINTS.coverOpens) return 1
  return 0
}

function syncControllerToIndex(controller: PageFlipController, targetIndex: number) {
  const currentIndex = controller.getCurrentPageIndex()
  const distance = targetIndex - currentIndex
  if (distance === 0) return

  if (controller.turnToPage) {
    controller.turnToPage(targetIndex)
    return
  }

  if (controller.flip && Math.abs(distance) > 1) {
    controller.flip(targetIndex, 'top')
    return
  }

  if (distance > 0) controller.flipNext()
  else controller.flipPrev()
}

const CoverPage = forwardRef<HTMLDivElement>(function CoverPage(_props, ref) {
  return (
    <div
      ref={ref}
      className="flex h-full w-full items-center justify-center"
      style={{
        background: 'linear-gradient(165deg, #382416 0%, #1c1006 55%, #100904 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,237,215,0.1)',
      }}
    >
      <div className="flex flex-col items-center gap-2.5">
        <div
          className="flex items-center justify-center rounded-md"
          style={{
            width: '58%',
            aspectRatio: '1',
            border: '1px solid rgba(255,237,215,0.22)',
            boxShadow: 'inset 0 1px 0 rgba(255,237,215,0.08)',
          }}
        >
          <BrandIcon icon={NotebookPen} size={26} />
        </div>
        <p
          className="font-display text-[10px] font-medium uppercase"
          style={{ color: 'rgba(255,237,215,0.6)', letterSpacing: '0.28em' }}
        >
          Raj&apos;s
        </p>
        <p
          className="text-[7px] font-semibold uppercase"
          style={{ color: 'rgba(255,237,215,0.35)', letterSpacing: '0.2em' }}
        >
          Vol. I — A Personal Vault
        </p>
      </div>
    </div>
  )
})

const BackCoverPage = forwardRef<HTMLDivElement>(function BackCoverPage(_props, ref) {
  return (
    <div
      ref={ref}
      className="h-full w-full"
      style={{ background: 'linear-gradient(165deg, #382416 0%, #1c1006 55%, #100904 100%)' }}
    />
  )
})

type ContentPageProps = { icon: LucideIcon; title: string; body: string; index: number }

const ContentPage = forwardRef<HTMLDivElement, ContentPageProps>(function ContentPage(
  { icon, title, body, index },
  ref,
) {
  return (
    <div
      ref={ref}
      className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center"
      style={{
        background:
          'repeating-linear-gradient(to bottom, transparent 0, transparent 21px, rgba(16,9,4,0.08) 22px), linear-gradient(175deg, #f6ecd9 0%, #ecdcbf 60%, #e2cfa8 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
      }}
    >
      {/* Notebook margin rule, like ruled loose-leaf paper. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-[14%] w-px"
        style={{ background: 'rgba(178,52,42,0.25)' }}
      />
      {/* A little washi-tape accent taped across the top corner, for a handmade journal feel. */}
      <div
        className="pointer-events-none absolute -top-1 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-2"
        style={{ background: 'rgba(214,181,140,0.55)', boxShadow: '0 1px 2px rgba(16,9,4,0.15)' }}
      />

      <p className="font-display text-ink/40 absolute top-4 left-[18%] text-[9px] font-semibold tracking-[0.2em] uppercase">
        Chapter {index + 1}
      </p>

      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ border: '1px solid rgba(16,9,4,0.15)' }}
      >
        <BrandIcon icon={icon} size={28} />
      </div>
      <h2 className="font-display text-ink text-lg font-medium uppercase leading-tight">
        {title}
      </h2>
      <p className="text-ink/60 text-[12.5px] leading-relaxed">{body}</p>

      {/* Folio page number, bottom corner, like a printed book. */}
      <p className="font-display text-ink/35 absolute bottom-3 right-[14%] text-[10px] font-semibold">
        {String(index + 1).padStart(2, '0')}
      </p>
    </div>
  )
})


type JournalBookProps = {
  /** Overall scroll progress (0-1) — watched here purely to fire discrete flips at the
   * checkpoints in `storyboard.ts`; the flip animation itself is NOT scroll-scrubbed. */
  progress: MotionValue<number>
}

/** The journal itself: a `react-pageflip` book (cover, three story pages, back cover) that
 * turns a real page each time scroll crosses one of the shared story checkpoints. */
export function JournalBook({ progress }: JournalBookProps) {
  const bookRef = useRef<FlipBookHandle | null>(null)

  useMotionValueEvent(progress, 'change', (value) => {
    const controller = bookRef.current?.pageFlip()
    if (!controller) return
    syncControllerToIndex(controller, targetIndexForProgress(value))
  })

  // Visible page thickness: a stack of already-turned pages grows on the left, and the
  // remaining-pages stack shrinks on the right, as the reader moves through the journal.
  const stackCheckpoints = [0, FLIP_CHECKPOINTS.coverOpens, FLIP_CHECKPOINTS.turnToPage2, FLIP_CHECKPOINTS.turnToPage3, 1]
  const leftStackWidth = useTransform(progress, stackCheckpoints, [2, 5, 9, 13, 13])
  const rightStackWidth = useTransform(progress, stackCheckpoints, [13, 9, 5, 2, 2])
  const pageEdgeTexture =
    'repeating-linear-gradient(to bottom, #f6ecd9 0px, #f6ecd9 2px, #d3b98c 2px, #d3b98c 3px)'

  return (
    <div className="relative h-full w-full">
      <motion.div
        className="pointer-events-none absolute top-[7%] bottom-[7%] rounded-l-sm"
        style={{
          width: leftStackWidth,
          right: '100%',
          background: pageEdgeTexture,
          boxShadow: 'inset -2px 0 3px rgba(16,9,4,0.25)',
        }}
      />
      <motion.div
        className="pointer-events-none absolute top-[7%] bottom-[7%] rounded-r-sm"
        style={{
          width: rightStackWidth,
          left: '100%',
          background: pageEdgeTexture,
          boxShadow: 'inset 2px 0 3px rgba(16,9,4,0.25)',
        }}
      />
      <HTMLFlipBook
        ref={bookRef as never}
        width={BOOK_WIDTH}
        height={BOOK_HEIGHT}
        size="stretch"
        minWidth={180}
        maxWidth={320}
        minHeight={240}
        maxHeight={430}
        startPage={0}
        startZIndex={10}
        autoSize={false}
        showCover
        usePortrait
        drawShadow
        maxShadowOpacity={0.5}
        flippingTime={700}
        useMouseEvents={false}
        clickEventForward={false}
        mobileScrollSupport={false}
        swipeDistance={30}
        showPageCorners={false}
        disableFlipByClick
        renderOnlyPageLengthChange={false}
        onInit={() => {
          const controller = bookRef.current?.pageFlip()
          if (!controller) return
          syncControllerToIndex(controller, targetIndexForProgress(progress.get()))
        }}
        className="journal-flipbook"
        style={{}}
      >
        <CoverPage />
        {JOURNAL_PAGES.map((page, index) => (
          <ContentPage key={page.title} icon={page.icon} title={page.title} body={page.body} index={index} />
        ))}
        <BackCoverPage />
      </HTMLFlipBook>
    </div>
  )
}
