import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, CheckCircle2, CopyX, Eye, ImagePlus } from 'lucide-react'
import { fallbackFieldSchema, getErrorMessage } from '../lib/fields'
import { buildScreenshotAutofill, extractScreenshotText, type ScreenshotExtraction } from '../lib/screenshotAutofill'
import { findItemDuplicates } from '../lib/duplicates'
import { BrandIcon, CategoryIcon } from '../lib/icons'
import { AddMenu } from './AddMenu'
import { layers } from '../design/layers'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { VaultDialog } from './ui/VaultDialog'
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

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const CAPTURE_DRAFT_KEY = 'vault:captureDraft'

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
  const [fieldError, setFieldError] = useState('')
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
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null)
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null)
  const [referenceImageError, setReferenceImageError] = useState<string | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  const fabRef = useRef<HTMLButtonElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const referenceImageInputRef = useRef<HTMLInputElement>(null)
  /** When the FAB is tapped for a known category, skip the category picker stage.
   *  Share-target launches reset it so the user still confirms the target. */
  const skipCategoryLaunchRef = useRef(false)
  const appliedAutofillKey = useRef('')

  useEffect(() => {
    if (!open) {
      return
    }
    let draft: { categoryId?: string; values?: Record<string, string> } | null = null
    try {
      draft = JSON.parse(window.sessionStorage.getItem(CAPTURE_DRAFT_KEY) ?? 'null')
    } catch {
      window.sessionStorage.removeItem(CAPTURE_DRAFT_KEY)
    }
    const draftCategory = categories.find((category) => category.id === draft?.categoryId)
    setValues(draftCategory && !initialPhotoFile ? draft?.values ?? {} : {})
    setFieldError('')
    setStepIndex(0)
    setDirection(1)
    clearPhoto()
    clearReferenceImage()
    if (initialPhotoFile) {
      const error = validatePhotoFile(initialPhotoFile)
      if (error) {
        setPhotoError(error)
      } else {
        setPhotoFile(initialPhotoFile)
        setPhotoPreview(URL.createObjectURL(initialPhotoFile))
      }
    }
    setCategoryId(draftCategory && !initialPhotoFile ? draftCategory.id : defaultCategoryId ?? '')
    const skipCategory = skipCategoryLaunchRef.current && !!defaultCategoryId
    setStage(draftCategory && !initialPhotoFile ? 'fields' : skipCategory ? 'photo' : 'category')
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
    if (!open || (!categoryId && Object.keys(values).length === 0)) return
    window.sessionStorage.setItem(CAPTURE_DRAFT_KEY, JSON.stringify({ categoryId, values }))
  }, [categoryId, open, values])

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

  // Same lifecycle for the optional reference image preview.
  useEffect(() => {
    return () => {
      if (referenceImagePreview) {
        URL.revokeObjectURL(referenceImagePreview)
      }
    }
  }, [referenceImagePreview])

  const activeCategory = categories.find((category) => category.id === categoryId)
  const fields: FieldDefinition[] = activeCategory?.field_schema.length
    ? activeCategory.field_schema
    : fallbackFieldSchema
  /** Reference Image is a dedicated wizard step inserted immediately before Notes
   *  (or at the end when a category has no notes field). It lives inside the field
   *  step sequence so progress, Back/Continue and jump-to-step stay aligned. */
  const notesFieldIndex = fields.findIndex((field) => field.key === 'notes')
  const referenceStepIndex = notesFieldIndex >= 0 ? notesFieldIndex : fields.length
  const fieldStepCount = fields.length + 1
  const fieldAtStep = (index: number): FieldDefinition | undefined =>
    index === referenceStepIndex ? undefined : fields[index > referenceStepIndex ? index - 1 : index]
  const stepForField = (fieldIndex: number) => fieldIndex + (fieldIndex >= referenceStepIndex ? 1 : 0)
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

  const chooseCategory = (id: string) => {
    setCategoryId(id)
    setStepIndex(0)
    setDirection(1)
    setValues({})
    setStage('photo')
  }

  const setFieldValue = (key: string, value: string) => {
    setFieldError('')
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

  /** The reference image is the ONLY image a user can deliberately save with an item.
   *  It's independent of the extraction photo used for OCR, which is temporary. */
  const clearReferenceImage = () => {
    setReferenceImageError(null)
    setReferenceImageFile((current) => {
      if (current) {
        setReferenceImagePreview((preview) => {
          if (preview) {
            URL.revokeObjectURL(preview)
          }
          return null
        })
      }
      return null
    })
  }

  const handleReferenceImagePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    const error = validatePhotoFile(file)
    if (error) {
      setReferenceImageError(error)
      return
    }
    setReferenceImageError(null)
    if (referenceImagePreview) {
      URL.revokeObjectURL(referenceImagePreview)
    }
    setReferenceImageFile(file)
    setReferenceImagePreview(URL.createObjectURL(file))
  }

  const goNext = () => {
    const field = fieldAtStep(stepIndex)
    if (field?.required && !values[field.key]?.trim()) {
      setFieldError(`${field.label} is required.`)
      setShakeToken((token) => token + 1)
      return
    }
    setFieldError('')
    // If we jumped here from the review screen, go straight back to review
    if (cameFromReview) {
      setCameFromReview(false)
      setStage('review')
      return
    }
    if (stepIndex < fieldStepCount - 1) {
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
    const target = stepForField(index)
    setCameFromReview(true)
    setDirection(target > stepIndex ? 1 : -1)
    setStepIndex(target)
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

    // Only a deliberately chosen reference image is persistent. The extraction
    // photo used for OCR stays temporary and is deliberately NOT passed here.
    onSubmit({ categoryId, values, imageFile: referenceImageFile })
    window.sessionStorage.removeItem(CAPTURE_DRAFT_KEY)
    onSaved?.(categoryId)
    setJustSaved(true)
    setTimeout(() => {
      setJustSaved(false)
      setOpen(false)
    }, 450)
  }

  const totalSteps = fieldStepCount + 3
  const currentStep =
    stage === 'category'
      ? 1
      : stage === 'photo'
        ? 2
        : stage === 'fields'
          ? stepIndex + 3
          : totalSteps
  const progress = Math.round((currentStep / totalSteps) * 100)

  const closeMenu = () => {
    setMenuOpen(false)
    window.requestAnimationFrame(() => fabRef.current?.focus())
  }

  // Stable dialog close handler. The capture wizard re-renders on every keystroke
  // (values state), and VaultDialog's focus management re-runs when its `onClose`
  // prop identity changes — which would blur the active title input and dismiss
  // the mobile keyboard after a single character. Keeping this identity stable is
  // what lets continuous typing keep focus, exactly like the Note editor.
  const closeDialog = useCallback(() => setOpen(false), [])

  return (
    <>
      <VaultDialog
        open={open}
        onClose={closeDialog}
        title="Add item"
        showClose
        closeLabel="Cancel item"
        variant="sheet"
        backdropOpacity={0.7}
        className="mb-0 mt-auto max-w-lg !p-0 sm:my-auto sm:!p-4"
        surfaceClassName="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-t sm:rounded"
        bodyClassName="flex min-h-0 flex-1 flex-col p-6 sm:p-7"
        returnFocusRef={fabRef}
      >
              {!justSaved ? (
                <div className="mb-5 border-b border-ink/10 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="vault-meta text-[var(--accession-text-muted)]">
                      Step {currentStep} of {totalSteps}
                    </span>
                    <span className="text-xs text-ink-soft/70">
                      {Object.keys(values).length > 0 ? 'Draft kept in this tab' : `${progress}%`}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-px bg-ink/10"
                    role="progressbar"
                    aria-label="Add item progress"
                    aria-valuemin={1}
                    aria-valuemax={totalSteps}
                    aria-valuenow={currentStep}
                  >
                    <div
                      className="h-px bg-accent transition-[width] duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : null}
              <div className="vault-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-8 pr-1">
                <AnimatePresence mode="wait">
                  {justSaved ? (
                    <motion.div
                      key="saved"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center gap-3 py-10"
                    >
                      <span className="bg-ink text-cloud flex h-16 w-16 items-center justify-center rounded-full">
                        <CheckCircle2 size={32} />
                      </span>
                      <p className="text-sm font-medium uppercase tracking-widest text-ink-soft">
                        Saved to your vault
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
                              className={`vault-surface-soft flex flex-col items-center gap-1.5 rounded p-4 transition-colors ${
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
                        className="vault-btn-solid mt-6 w-full rounded-full px-4 py-3.5 text-sm font-semibold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
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
                      <p className="mt-1 text-sm text-ink-soft">
                        It's used only to auto-fill fields — it won't be saved.
                      </p>

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
                          className="vault-surface-soft border-ink/30 mt-5 flex h-48 w-full flex-col items-center justify-center gap-2 rounded border-dashed"
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
                        className="vault-btn-solid mt-6 w-full rounded-full px-4 py-3.5 text-sm font-semibold uppercase tracking-widest"
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
                          [ {stepIndex + 1}/{fieldStepCount} ]
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
                            {fieldAtStep(stepIndex) ? (
                              <>
                                <h3 className="font-display mt-2 text-2xl font-bold uppercase leading-snug tracking-tight">
                                  &gt; {fieldAtStep(stepIndex)!.label}
                                  {fieldAtStep(stepIndex)!.required ? (
                                    <span className="text-ink"> *</span>
                                  ) : (
                                    <span className="text-sm font-normal normal-case text-ink-soft"> (optional)</span>
                                  )}
                                </h3>

                                <div className="mt-4">
                                  {fieldAtStep(stepIndex)!.type === 'textarea' ? (
                                    <textarea
                                      autoFocus
                                      value={values[fieldAtStep(stepIndex)!.key] ?? ''}
                                      onChange={(event) =>
                                        setFieldValue(fieldAtStep(stepIndex)!.key, event.target.value)
                                      }
                                      rows={3}
                                      className="vault-input w-full rounded-none px-4 py-3 text-lg text-ink"
                                    />
                                  ) : (
                                    <div className="relative">
                                      {fieldAtStep(stepIndex)!.type === 'currency' ? (
                                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-ink-soft">
                                          ₹
                                        </span>
                                      ) : null}
                                      <input
                                        autoFocus
                                        value={values[fieldAtStep(stepIndex)!.key] ?? ''}
                                        onChange={(event) =>
                                          setFieldValue(fieldAtStep(stepIndex)!.key, event.target.value)
                                        }
                                        type={fieldInputType(fieldAtStep(stepIndex)!.type)}
                                        aria-invalid={fieldError ? true : undefined}
                                        aria-describedby={fieldError ? 'capture-field-error' : undefined}
                                        className={`vault-input w-full rounded-none py-3 text-lg text-ink ${
                                          fieldAtStep(stepIndex)!.type === 'currency' ? 'pl-9 pr-4' : 'px-4'
                                        }`}
                                      />
                                    </div>
                                  )}
                                </div>
                                {fieldError ? (
                                  <p id="capture-field-error" role="alert" className="mt-2 text-sm text-red-400">
                                    {fieldError}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                                  <h3 className="font-display text-2xl font-bold uppercase leading-snug tracking-tight">
                                    &gt; Reference Image
                                  </h3>
                                  <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                                    Optional
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-ink-soft">Add a photo related to this item.</p>

                                <input
                                  ref={referenceImageInputRef}
                                  type="file"
                                  accept="image/*"
                                  onChange={handleReferenceImagePick}
                                  className="hidden"
                                />

                                {referenceImagePreview ? (
                                  <div className="border-ink/20 relative mt-5 border bg-ink/5">
                                    <img
                                      src={referenceImagePreview}
                                      alt="Reference image preview"
                                      className="h-auto max-h-56 w-full object-contain"
                                    />
                                    <button
                                      type="button"
                                      onClick={clearReferenceImage}
                                      className="bg-cloud/80 text-ink absolute right-3 top-3 rounded px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur-sm"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => referenceImageInputRef.current?.click()}
                                    className="vault-surface-soft border-ink/30 mt-5 flex w-full flex-col items-center justify-center gap-2 rounded border-dashed py-6"
                                  >
                                    <BrandIcon icon={ImagePlus} size={22} />
                                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                                      Add image
                                    </span>
                                  </button>
                                )}
                                {referenceImageError ? (
                                  <p className="mt-2 text-sm text-red-400">{referenceImageError}</p>
                                ) : null}
                              </>
                            )}
                          </motion.div>
                        </motion.div>
                      </AnimatePresence>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className="vault-btn-solid mt-8 w-full rounded-full px-4 py-3.5 text-sm font-semibold uppercase tracking-widest"
                      >
                        {stepIndex === fieldStepCount - 1 ? 'Review →' : 'Continue →'}
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

                      {/* Only the deliberately selected reference image is shown here.
                          The temporary OCR/extraction source image is never offered as
                          a fallback preview. */}
                      {referenceImagePreview ? (
                        <div className="border-ink/20 relative mt-4 border bg-ink/5">
                          <img
                            src={referenceImagePreview}
                            alt="Reference image preview"
                            className="h-auto max-h-56 w-full object-contain"
                          />
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
                              <div className="vault-scrollbar mt-2 max-h-56 overflow-y-auto overflow-x-hidden pb-4 pr-1 font-mono text-[13px] leading-6 text-ink-soft">
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
                              className="vault-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink"
                            >
                              <Eye size={12} /> View existing
                            </button>
                            <button
                              type="button"
                              onClick={() => setDuplicateAcknowledged(true)}
                              className="vault-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent"
                            >
                              Create anyway
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={handleSave}
                        disabled={duplicates.length > 0 && !duplicateAcknowledged}
                        className="vault-btn-solid mt-6 w-full rounded-full px-4 py-3.5 text-sm font-semibold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save to vault
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
      </VaultDialog>

      <AddMenu
        open={menuOpen}
        onClose={closeMenu}
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

      <div
        className="fixed right-4 sm:right-8"
        style={{
          bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 1rem) + 4.5rem)',
          zIndex: layers.navigation,
        }}
      >
        <motion.button
          ref={fabRef}
          type="button"
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
          whileTap={reducedMotion ? undefined : { scale: 0.96 }}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-accent/60 bg-cloud shadow-[0_0_0_1px_rgba(196,72,0,0.16),0_8px_24px_-6px_rgba(0,0,0,0.55),0_6px_18px_-8px_rgba(196,72,0,0.25)] transition-colors hover:bg-cloud-alt"
          aria-label="Add item"
          data-tour="capture-fab"
        >
          <motion.span
            className="relative text-2xl font-semibold text-ink"
            animate={{ rotate: open ? 45 : 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
          >
            +
          </motion.span>
        </motion.button>
      </div>
    </>
  )
}

