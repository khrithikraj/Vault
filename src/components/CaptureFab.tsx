import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react'
import { Camera, CheckCircle2, CopyX, Eye } from 'lucide-react'
import { fallbackFieldSchema, getErrorMessage } from '../lib/fields'
import { buildScreenshotAutofill, extractScreenshotText, type ScreenshotExtraction } from '../lib/screenshotAutofill'
import { findItemDuplicates } from '../lib/duplicates'
import { BrandIcon, CategoryIcon } from '../lib/icons'
import { BorderTrail } from './BorderTrail'
import { AddMenu } from './AddMenu'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import type { Category, FieldDefinition, VaultItem } from '../types/app'

type CapturQuickAdd = 'choose' | 'item' | 'note' | 'document'

type CaptureFabProps = {
  categories: Category[]
  defaultCategoryId: string | null
  onSubmit: (input: {
    categoryId: string
    values: Record<string, string>
    imageFile?: File | null
  }) => void
  onSaved?: (categoryId: string) => void
  /** A photo (e.g. from the PWA share-target flow) to pre-attach the next time the wizard opens. */
  initialPhotoFile?: File | null
  /** Bump this to force the wizard open programmatically (e.g. after a share-target photo arrives). */
  openToken?: number
  /** Smart Quick Add context: which action the FAB tap should perform. */
  quickAdd?: CapturQuickAdd
  /** Note/document quick-add shortcuts (used when quickAdd is note/document). */
  onQuickAddNote?: () => void
  onQuickAddDocument?: () => void
  /** Live items used to warn about probable duplicates while creating an item. */
  existingItems?: VaultItem[]
  /** Jump straight to a matched existing item from the duplicate warning. */
  onViewExistingItem?: (itemId: string) => void
}

type Stage = 'category' | 'photo' | 'fields' | 'review'

const GHOST_OFFSET = 16
const MAX_PHOTO_BYTES = 8 * 1024 * 1024

function validatePhotoFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return "That file isn't an image — try a photo instead."
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'That photo is too large (max 8MB) — try a smaller one.'
  }
  return null
}

const stepVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -48 : 48, opacity: 0 }),
}

function fieldInputType(type: FieldDefinition['type']) {
  if (type === 'number' || type === 'currency') return 'number'
  if (type === 'url') return 'url'
  return 'text'
}

/** The signature capture flow: a smart category picker (skipped when the context already
 * knows where you are), a Typeform-style one-question-at-a-time wizard, a review step, and
 * a save that visibly flies the item across the screen into its category's Dock icon. */
export function CaptureFab({
  categories,
  defaultCategoryId,
  onSubmit,
  onSaved,
  initialPhotoFile,
  openToken,
  quickAdd = 'item',
  onQuickAddNote,
  onQuickAddDocument,
  existingItems,
  onViewExistingItem,
}: CaptureFabProps) {
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('category')
  const [categoryId, setCategoryId] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [values, setValues] = useState<Record<string, string>>({})
  const [shakeToken, setShakeToken] = useState(0)
  const [cameFromReview, setCameFromReview] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrExtraction, setOcrExtraction] = useState<ScreenshotExtraction | null>(null)
  const [autofillSummary, setAutofillSummary] = useState<{ matchedFields: string[]; confidence: number } | null>(null)
  const [showFullExtraction, setShowFullExtraction] = useState(false)
  const [ghost, setGhost] = useState<{
    id: number
    fromX: number
    fromY: number
    toX: number
    toY: number
    icon: string
    color: string
  } | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  const fabRef = useRef<HTMLButtonElement>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  /** When the FAB is tapped for a known category, skip the category picker stage.
   *  Share-target launches reset it so the user still confirms the target. */
  const skipCategoryLaunchRef = useRef(false)
  const magnetX = useMotionValue(0)
  const magnetY = useMotionValue(0)
  const springX = useSpring(magnetX, { stiffness: 200, damping: 14 })
  const springY = useSpring(magnetY, { stiffness: 200, damping: 14 })
  const appliedAutofillKey = useRef('')

  useEffect(() => {
    if (!open) {
      return
    }
    setValues({})
    setStepIndex(0)
    setDirection(1)
    clearPhoto()
    if (initialPhotoFile) {
      const error = validatePhotoFile(initialPhotoFile)
      if (error) {
        setPhotoError(error)
      } else {
        setPhotoFile(initialPhotoFile)
        setPhotoPreview(URL.createObjectURL(initialPhotoFile))
      }
    }
    setCategoryId(defaultCategoryId ?? '')
    const skipCategory = skipCategoryLaunchRef.current && !!defaultCategoryId
    setStage(skipCategory ? 'photo' : 'category')
    skipCategoryLaunchRef.current = false
    setOcrStatus('idle')
    setOcrError(null)
    setOcrExtraction(null)
    setAutofillSummary(null)
    setShowFullExtraction(false)
    appliedAutofillKey.current = ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // A fresh share-target photo forces the wizard open, even if it's currently closed.
  useEffect(() => {
    if (openToken) {
      skipCategoryLaunchRef.current = false
      setOpen(true)
    }
  }, [openToken])

  useEffect(() => {
    if (!photoFile) {
      setOcrStatus('idle')
      setOcrError(null)
      setOcrExtraction(null)
      setAutofillSummary(null)
      setShowFullExtraction(false)
      appliedAutofillKey.current = ''
      return
    }

    let cancelled = false
    setOcrStatus('running')
    setOcrError(null)
    setOcrExtraction(null)
    setAutofillSummary(null)
    setShowFullExtraction(false)

    void extractScreenshotText(photoFile)
      .then((extraction) => {
        if (cancelled) {
          return
        }
        setOcrStatus('done')
        setOcrExtraction(extraction)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        setOcrStatus('error')
        setOcrError(getErrorMessage(error))
      })

    return () => {
      cancelled = true
    }
  }, [photoFile])

  // Revoke the preview object URL whenever it's replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  const activeCategory = categories.find((category) => category.id === categoryId)
  const fields: FieldDefinition[] = activeCategory?.field_schema.length
    ? activeCategory.field_schema
    : fallbackFieldSchema
  const autofillPreview = useMemo(() => {
    if (!ocrExtraction || !categoryId) {
      return null
    }
    return buildScreenshotAutofill(ocrExtraction, fields)
  }, [categoryId, fields, ocrExtraction])

  const duplicates = useMemo(
    () => findItemDuplicates(existingItems ?? [], categories, { categoryId, values }),
    [existingItems, categories, categoryId, values],
  )

  // An edit to any value re-evaluates the duplicate match — require a fresh decision.
  useEffect(() => {
    setDuplicateAcknowledged(false)
  }, [categoryId, values])

  const handleMagnetMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    const bounds = fabRef.current?.getBoundingClientRect()
    if (!bounds) return
    const cx = bounds.left + bounds.width / 2
    const cy = bounds.top + bounds.height / 2
    magnetX.set((event.clientX - cx) * 0.35)
    magnetY.set((event.clientY - cy) * 0.35)
  }

  const resetMagnet = () => {
    magnetX.set(0)
    magnetY.set(0)
  }

  const chooseCategory = (id: string) => {
    setCategoryId(id)
    setStepIndex(0)
    setDirection(1)
    setValues({})
    setStage('photo')
  }

  const setFieldValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const handlePhotoPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    const error = validatePhotoFile(file)
    if (error) {
      setPhotoError(error)
      return
    }
    setPhotoError(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const clearPhoto = () => {
    setPhotoError(null)
    setPhotoFile((current) => {
      if (current) {
        setPhotoPreview((preview) => {
          if (preview) {
            URL.revokeObjectURL(preview)
          }
          return null
        })
      }
      return null
    })
    setOcrStatus('idle')
    setOcrError(null)
    setOcrExtraction(null)
    setAutofillSummary(null)
    setShowFullExtraction(false)
    appliedAutofillKey.current = ''
  }

  const goNext = () => {
    const field = fields[stepIndex]
    if (field.required && !values[field.key]?.trim()) {
      setShakeToken((token) => token + 1)
      return
    }
    // If we jumped here from the review screen, go straight back to review
    if (cameFromReview) {
      setCameFromReview(false)
      setStage('review')
      return
    }
    if (stepIndex < fields.length - 1) {
      setDirection(1)
      setStepIndex((index) => index + 1)
    } else {
      setStage('review')
    }
  }

  const goBack = () => {
    if (stage === 'review') {
      setDirection(-1)
      setStage('fields')
      return
    }
    // If we jumped here from the review screen, go straight back to review
    if (cameFromReview) {
      setCameFromReview(false)
      setStage('review')
      return
    }
    if (stage === 'photo') {
      setStage('category')
      return
    }
    if (stepIndex === 0) {
      setStage('photo')
      return
    }
    setDirection(-1)
    setStepIndex((index) => index - 1)
  }

  const jumpToStep = (index: number) => {
    setCameFromReview(true)
    setDirection(index > stepIndex ? 1 : -1)
    setStepIndex(index)
    setStage('fields')
  }

  useEffect(() => {
    if (!photoFile || !ocrExtraction || !categoryId) {
      return
    }

    const autofillKey = `${ocrExtraction.signature}:${categoryId}`
    if (appliedAutofillKey.current === autofillKey) {
      return
    }

    const draft = autofillPreview ?? buildScreenshotAutofill(ocrExtraction, fields)
    if (Object.keys(draft.values).length > 0) {
      setValues((current) => {
        const next = { ...current }
        for (const [key, value] of Object.entries(draft.values)) {
          if (!next[key]?.trim()) {
            next[key] = value
          }
        }
        return next
      })
    }

    setAutofillSummary({
      matchedFields: draft.matchedFields,
      confidence: ocrExtraction.confidence,
    })
    appliedAutofillKey.current = autofillKey
  }, [autofillPreview, categoryId, fields, ocrExtraction, photoFile])

  const handleSave = () => {
    if (!categoryId || !values.title?.trim()) {
      return
    }
    // Non-blocking duplicate warning: [Create anyway] explicitly acknowledges this.
    if (duplicates.length > 0 && !duplicateAcknowledged) {
      return
    }

    onSubmit({ categoryId, values, imageFile: photoFile })

    const startEl = saveButtonRef.current
    const endEl = document.querySelector(`[data-dock-item="${categoryId}"]`) as HTMLElement | null
    if (startEl) {
      const startRect = startEl.getBoundingClientRect()
      const endRect = endEl?.getBoundingClientRect()
      const from = { x: startRect.left + startRect.width / 2, y: startRect.top + startRect.height / 2 }
      const to = endRect
        ? { x: endRect.left + endRect.width / 2, y: endRect.top + endRect.height / 2 }
        : { x: window.innerWidth - 48, y: window.innerHeight - 96 }

      setGhost({
        id: Date.now(),
        fromX: from.x - GHOST_OFFSET,
        fromY: from.y - GHOST_OFFSET,
        toX: to.x - GHOST_OFFSET,
        toY: to.y - GHOST_OFFSET,
        icon: activeCategory?.icon ?? '✨',
        color: activeCategory?.color ?? '#dc5000',
      })
    }

    onSaved?.(categoryId)
    setJustSaved(true)
    setTimeout(() => {
      setJustSaved(false)
      setOpen(false)
    }, 750)
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 60, rotateX: -18, opacity: 0 }}
              animate={{ y: 0, rotateX: 0, opacity: 1 }}
              exit={{ y: 60, rotateX: -18, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              style={{ transformPerspective: 900, transformOrigin: 'bottom' }}
              onClick={(event) => event.stopPropagation()}
              className="term-panel term-brackets relative flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-t p-6 sm:rounded sm:p-7"
            >
              <BorderTrail color="rgba(220,80,0,0.85)" size={90} duration={6} />
              <div className="bg-ink/25 mx-auto mb-4 h-1.5 w-12 rounded-full sm:hidden" />

              <div className="term-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-8 pr-1">
                <AnimatePresence mode="wait">
                  {justSaved ? (
                    <motion.div
                      key="saved"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center gap-3 py-10"
                    >
                      <motion.span
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 16 }}
                        className="bg-ink text-cloud flex h-16 w-16 items-center justify-center rounded-full"
                      >
                        <CheckCircle2 size={32} />
                      </motion.span>
                      <p className="text-sm font-medium uppercase tracking-widest text-ink-soft">
                        Flying into your vault…
                      </p>
                    </motion.div>
                  ) : stage === 'category' ? (
                    <motion.div key="category" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                        Quick capture
                      </p>
                      <h2 className="font-display mt-1 text-xl font-bold uppercase tracking-tight">
                        Where does this belong?
                      </h2>

                      {categories.length === 0 ? (
                        <p className="mt-5 text-sm text-ink-soft">
                          Add a category first — tap “+ New category” above.
                        </p>
                      ) : (
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {categories.map((category, index) => (
                            <motion.button
                              key={category.id}
                              type="button"
                              onClick={() => chooseCategory(category.id)}
                              initial={{ opacity: 0, scale: 0.7, rotate: index % 2 === 0 ? -6 : 6 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              transition={{
                                delay: index * 0.04,
                                type: 'spring',
                                stiffness: 300,
                                damping: 20,
                              }}
                              whileHover={{ scale: 1.05, y: -3 }}
                              whileTap={{ scale: 0.95 }}
                              className={`term-panel-soft flex flex-col items-center gap-1.5 rounded p-4 transition-colors ${
                                categoryId === category.id ? 'border border-ink bg-cloud/80' : ''
                              }`}
                            >
                              <CategoryIcon icon={category.icon} color={category.color} size={30} />
                              <span className="text-center text-xs font-medium uppercase tracking-wide text-ink-soft">
                                {category.name}
                              </span>
                            </motion.button>
                          ))}
                          {categoryId ? (
                            <div className="col-span-full mt-2 rounded border border-dashed border-ink/20 p-3 text-sm text-ink-soft">
                              Selected: {activeCategory?.name ?? 'Default category'}
                            </div>
                          ) : null}
                        </div>
                      )}

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => categoryId && setStage('photo')}
                        disabled={!categoryId}
                        className="term-btn-primary mt-6 w-full rounded-full px-4 py-3.5 text-sm font-semibold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Continue to screenshot →
                      </motion.button>
                    </motion.div>
                  ) : stage === 'photo' ? (
                    <motion.div key="photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <button
                        type="button"
                        onClick={goBack}
                        className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-ink-soft hover:text-ink transition-colors"
                      >
                        [ ← Back ]
                      </button>
                      <h2 className="font-display mt-2 text-xl font-bold uppercase tracking-tight">Add a photo?</h2>
                      <p className="mt-1 text-sm text-ink-soft">Totally optional — you can skip this.</p>

                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoPick}
                        className="hidden"
                      />

                      {photoPreview ? (
                        <div className="border-ink/20 relative mt-5 border bg-ink/5">
                          <img src={photoPreview} alt="Selected" className="h-auto max-h-64 w-full object-contain" />
                          <button
                            type="button"
                            onClick={clearPhoto}
                            className="bg-cloud/80 text-ink absolute right-3 top-3 rounded px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => photoInputRef.current?.click()}
                          className="term-panel-soft border-ink/30 mt-5 flex h-48 w-full flex-col items-center justify-center gap-2 rounded border-dashed"
                        >
                          <BrandIcon icon={Camera} size={30} />
<span className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                              Tap to add a photo
                            </span>
                        </motion.button>
                      )}

                      {ocrExtraction && categoryId ? (
                        <div className="border-ink/20 mt-5 rounded border bg-transparent p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                                Extracted preview
                              </p>
                              <p className="mt-1 text-sm text-ink-soft">
                                Confidence {Math.round(ocrExtraction.confidence)}%
                              </p>
                            </div>
                            <span className="text-xs uppercase tracking-widest text-ink-soft">
                              {autofillSummary?.matchedFields.length ?? autofillPreview?.matchedFields.length ?? 0} field
                              {(autofillSummary?.matchedFields.length ?? autofillPreview?.matchedFields.length ?? 0) === 1
                                ? ''
                                : 's'} matched
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft/70">
                                Likely fields
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(autofillSummary?.matchedFields ?? autofillPreview?.matchedFields ?? []).length > 0 ? (
                                  (autofillSummary?.matchedFields ?? autofillPreview?.matchedFields ?? []).map((field) => (
                                    <span
                                      key={field}
                                      className="bg-ink/10 border-ink/20 rounded-full border px-2.5 py-1 text-xs text-ink"
                                    >
                                      {field}
                                    </span>
                                  ))
                                ) : (
                                  <p className="text-sm text-ink-soft">No confident field matches yet.</p>
                                )}
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft/70">
                                Extracted text
                              </p>
                              <div className="mt-2 max-h-48 overflow-y-auto overflow-x-hidden rounded border border-dashed border-ink/20 bg-cloud/40 p-3 font-mono text-[13px] leading-6 text-ink-soft">
                                {ocrExtraction.rawText ? (
                                  <p className="whitespace-pre-wrap break-words">
                                    {showFullExtraction ? ocrExtraction.rawText : ocrExtraction.rawText.slice(0, 700)}
                                  </p>
                                ) : (
                                  <p className="font-sans text-sm">No readable text found.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {photoError ? <p className="mt-2 text-sm text-red-400">{photoError}</p> : null}
                      {ocrStatus === 'running' ? (
                        <p className="mt-2 text-sm text-ink-soft">Analyzing screenshot for text…</p>
                      ) : null}
                      {ocrStatus === 'error' ? (
                        <p className="mt-2 text-sm text-amber-300">
                          Could not analyze the screenshot automatically. You can still fill it manually.
                          {ocrError ? ` ${ocrError}` : ''}
                        </p>
                      ) : null}

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setStage('fields')}
                        className="term-btn-primary mt-6 w-full rounded-full px-4 py-3.5 text-sm font-semibold uppercase tracking-widest"
                      >
                        {photoFile ? 'Continue →' : 'Skip →'}
                      </motion.button>
                    </motion.div>
                  ) : stage === 'fields' ? (
                    <motion.div key="fields" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={goBack}
                          className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-ink-soft hover:text-ink transition-colors"
                        >
                          [ ← Back ]
                        </button>
                        <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                          [ {stepIndex + 1}/{fields.length} ]
                        </span>
                      </div>

                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          goNext()
                        }}
                        className="mt-6"
                      >
                      <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                          key={stepIndex}
                          custom={direction}
                          variants={stepVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{ duration: 0.26, ease: 'easeOut' }}
                        >
                          <motion.div
                            key={`shake-${shakeToken}`}
                            animate={shakeToken > 0 ? { x: [0, -8, 8, -6, 6, 0] } : undefined}
                            transition={{ duration: 0.4 }}
                          >
                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                              {activeCategory ? (
                                <CategoryIcon
                                  icon={activeCategory.icon}
                                  color={activeCategory.color}
                                  size={14}
                                />
                              ) : null}
                              {activeCategory?.name}
                            </p>
                            <h3 className="font-display mt-2 text-2xl font-bold uppercase leading-snug tracking-tight">
                              &gt; {fields[stepIndex].label}
                              {fields[stepIndex].required ? (
                                <span className="text-ink"> *</span>
                              ) : (
                                <span className="text-sm font-normal normal-case text-ink-soft"> (optional)</span>
                              )}
                            </h3>

                            <div className="mt-4">
                              {fields[stepIndex].type === 'textarea' ? (
                                <textarea
                                  autoFocus
                                  value={values[fields[stepIndex].key] ?? ''}
                                  onChange={(event) =>
                                    setFieldValue(fields[stepIndex].key, event.target.value)
                                  }
                                  rows={3}
                                  className="term-input w-full rounded-none px-4 py-3 text-lg text-ink"
                                />
                              ) : (
                                <div className="relative">
                                  {fields[stepIndex].type === 'currency' ? (
                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-ink-soft">
                                      ₹
                                    </span>
                                  ) : null}
                                  <input
                                    autoFocus
                                    value={values[fields[stepIndex].key] ?? ''}
                                    onChange={(event) =>
                                      setFieldValue(fields[stepIndex].key, event.target.value)
                                    }
                                    type={fieldInputType(fields[stepIndex].type)}
                                    className={`term-input w-full rounded-none py-3 text-lg text-ink ${
                                      fields[stepIndex].type === 'currency' ? 'pl-9 pr-4' : 'px-4'
                                    }`}
                                  />
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </motion.div>
                      </AnimatePresence>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className="term-btn-primary mt-8 w-full rounded-full px-4 py-3.5 text-sm font-semibold uppercase tracking-widest"
                      >
                        {stepIndex === fields.length - 1 ? 'Review →' : 'Continue →'}
                      </motion.button>
                      <p className="mt-2 text-center text-xs text-ink-soft/70">Press Enter ↵</p>
                    </form>
                  </motion.div>
                  ) : (
                    <motion.div
                      key="review"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <button
                        type="button"
                        onClick={goBack}
                        className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-ink-soft hover:text-ink transition-colors"
                      >
                        [ ← Back ]
                      </button>
                      <h2 className="font-display mt-2 flex items-center gap-2 text-xl font-bold uppercase tracking-tight text-ink">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-ink/20"
                          style={activeCategory ? { backgroundColor: `${activeCategory.color}18` } : undefined}
                        >
                          {activeCategory ? (
                            <CategoryIcon icon={activeCategory.icon} color={activeCategory.color} size={18} />
                          ) : null}
                        </span>
                        Ready to save?
                      </h2>

                      {photoPreview ? (
                        <div className="border-ink/20 mt-4 border bg-ink/5">
                          <img src={photoPreview} alt="Selected" className="h-auto max-h-56 w-full object-contain" />
                        </div>
                      ) : null}
                      {ocrExtraction && categoryId ? (
                        <div className="border-ink/20 mt-4 rounded border bg-transparent p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                              Extraction preview
                            </p>
                            <span className="bg-ink/10 border-ink/20 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
                              {Math.round(ocrExtraction.confidence)}% confidence
                            </span>
                          </div>

                          <div className="mt-4 space-y-3">
                            {autofillPreview && Object.keys(autofillPreview.values).length > 0 ? (
                              <div className="rounded border border-dashed border-ink/20 bg-cloud/40 p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft/70">
                                  Field matches
                                </p>
                                <p className="mt-1 text-xs text-ink-soft">Click any field to correct it.</p>
                                <div className="mt-2 max-h-36 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                                  {fields
                                    .filter((field) => autofillPreview.values[field.key])
                                    .map((field) => {
                                      const fieldIndex = fields.findIndex((candidate) => candidate.key === field.key)
                                      return (
                                        <button
                                          key={field.key}
                                          type="button"
                                          onClick={() => {
                                            if (fieldIndex >= 0) {
                                              jumpToStep(fieldIndex)
                                            }
                                          }}
                                          className="flex w-full items-start justify-between gap-4 rounded border border-transparent px-2 py-1 text-left text-sm transition-colors hover:border-ink/15 hover:bg-ink/5"
                                        >
                                          <span className="shrink-0 text-ink-soft">{field.label}</span>
                                          <span className="text-right font-medium text-ink">
                                            {autofillPreview.values[field.key]}
                                          </span>
                                        </button>
                                      )
                                    })}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-ink-soft">No confident fields mapped yet.</p>
                            )}

                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft/70">
                              Extracted text
                            </p>
                            <div className="mt-2 rounded border border-dashed border-ink/20 bg-cloud/40 p-3 text-sm text-ink-soft">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft/70">
                                  {showFullExtraction ? 'Full text' : 'Preview'}
                                </p>
                                {ocrExtraction.lines.length > 5 ? (
                                  <button
                                    type="button"
                                    onClick={() => setShowFullExtraction((current) => !current)}
                                    className="text-xs font-semibold uppercase tracking-wide text-ink-soft hover:text-ink"
                                  >
                                    {showFullExtraction ? 'Show less' : `Show full text (${ocrExtraction.lines.length})`}
                                  </button>
                                ) : null}
                              </div>
                              <div className="term-scrollbar mt-2 max-h-56 overflow-y-auto overflow-x-hidden pb-4 pr-1 font-mono text-[13px] leading-6 text-ink-soft">
                                {ocrExtraction.rawText ? (
                                  <p className="whitespace-pre-wrap break-words">
                                    {showFullExtraction ? ocrExtraction.rawText : ocrExtraction.rawText.slice(0, 700)}
                                  </p>
                                ) : (
                                  <p className="font-sans text-sm">No readable text found.</p>
                                )}
                              </div>
                              {!showFullExtraction && ocrExtraction.rawText && ocrExtraction.rawText.length > 700 ? (
                                <p className="mt-2 text-xs text-ink-soft/70">
                                  Preview trimmed to the first 700 characters. Expand to review the full transcript.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                      <div className="mt-4 overflow-hidden rounded border border-ink/15 bg-ink/5">
                        <div className="divide-y divide-ink/10">
                          {fields.map((field, index) => (
                            <button
                              key={field.key}
                              type="button"
                              onClick={() => jumpToStep(index)}
                              className="flex w-full min-w-0 flex-col gap-1 px-3.5 py-3 text-left transition-colors hover:bg-ink/5"
                            >
                              <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                                {field.label}
                              </span>
                              <span className="min-w-0 break-words text-sm font-medium text-ink">
                                {values[field.key]?.trim() || '—'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {duplicates.length > 0 && !duplicateAcknowledged ? (
                        <div className="mt-4 rounded border border-amber-500/40 bg-amber-950/20 p-4">
                          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
                            <CopyX size={14} /> This looks like a duplicate
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                            An item titled{' '}
                            <span className="font-semibold text-ink">
                              “{duplicates[0].item.title}”
                            </span>{' '}
                            already exists in {duplicates[0].category.name}.
                            {duplicates[0].matchedFields.length > 0 ? (
                              <> It matches on {duplicates[0].matchedFields.join(', ')}.</>
                            ) : null}{' '}
                            This is just a heads-up — you decide.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setOpen(false)
                                onViewExistingItem?.(duplicates[0].item.id)
                              }}
                              className="term-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink"
                            >
                              <Eye size={12} /> View existing
                            </button>
                            <button
                              type="button"
                              onClick={() => setDuplicateAcknowledged(true)}
                              className="term-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent"
                            >
                              Create anyway
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <motion.button
                        ref={saveButtonRef}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={handleSave}
                        disabled={duplicates.length > 0 && !duplicateAcknowledged}
                        className="term-btn-primary mt-6 w-full rounded-full px-4 py-3.5 text-sm font-semibold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save to vault
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {ghost ? (
          <motion.span
            key={ghost.id}
            initial={{ left: ghost.fromX, top: ghost.fromY, opacity: 1, scale: 1 }}
            animate={{ left: ghost.toX, top: ghost.toY, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => setGhost(null)}
            style={{ position: 'fixed' }}
            className="pointer-events-none z-50"
          >
            <CategoryIcon icon={ghost.icon} color={ghost.color} size={30} />
          </motion.span>
        ) : null}
      </AnimatePresence>

      <AddMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onPickItem={() => {
          setMenuOpen(false)
          skipCategoryLaunchRef.current = true
          setOpen(true)
        }}
        onPickNote={() => {
          setMenuOpen(false)
          onQuickAddNote?.()
        }}
        onPickDocument={() => {
          setMenuOpen(false)
          onQuickAddDocument?.()
        }}
      />

      <div className="fixed bottom-28 right-4 z-30 sm:right-8">
        <motion.button
          ref={fabRef}
          type="button"
          onMouseMove={handleMagnetMove}
          onMouseLeave={resetMagnet}
          onClick={() => {
            if (quickAdd === 'note') {
              onQuickAddNote?.()
              return
            }
            if (quickAdd === 'document') {
              onQuickAddDocument?.()
              return
            }
            if (quickAdd === 'choose') {
              setMenuOpen(true)
              return
            }
            skipCategoryLaunchRef.current = true
            setOpen(true)
          }}
          style={{ x: springX, y: springY }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="group relative flex h-16 w-16 items-center justify-center rounded-full"
          aria-label="Add a new memory"
        >
          {!reducedMotion ? (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-16px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(220,80,0,0.45), transparent 70%)',
                filter: 'blur(10px)',
              }}
              animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.94, 1.08, 0.94] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : null}
          <motion.span
            aria-hidden="true"
            className="absolute inset-[-3px] rounded-full opacity-90"
            style={{
              background: 'conic-gradient(from 0deg, #dc5000, #382416, #100904, #dc5000)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />
          <span className="bg-cloud group-hover:bg-cloud-alt absolute inset-[3px] rounded-full transition-colors" />
          <motion.span
            className="relative text-2xl font-semibold text-ink"
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            +
          </motion.span>
        </motion.button>
      </div>
    </>
  )
}

