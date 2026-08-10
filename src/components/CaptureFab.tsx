import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react'
import { Camera, CheckCircle2 } from 'lucide-react'
import { fallbackFieldSchema } from '../lib/fields'
import { BrandIcon, CategoryIcon } from '../lib/icons'
import { BorderTrail } from './BorderTrail'
import type { Category, FieldDefinition } from '../types/app'

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
}: CaptureFabProps) {
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('category')
  const [categoryId, setCategoryId] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [values, setValues] = useState<Record<string, string>>({})
  const [shakeToken, setShakeToken] = useState(0)
  const [justSaved, setJustSaved] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{
    id: number
    fromX: number
    fromY: number
    toX: number
    toY: number
    icon: string
    color: string
  } | null>(null)

  const fabRef = useRef<HTMLButtonElement>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const magnetX = useMotionValue(0)
  const magnetY = useMotionValue(0)
  const springX = useSpring(magnetX, { stiffness: 200, damping: 14 })
  const springY = useSpring(magnetY, { stiffness: 200, damping: 14 })

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
    if (defaultCategoryId) {
      setCategoryId(defaultCategoryId)
      setStage('photo')
    } else {
      setCategoryId('')
      setStage('category')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // A fresh share-target photo forces the wizard open, even if it's currently closed.
  useEffect(() => {
    if (openToken) {
      setOpen(true)
    }
  }, [openToken])

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
  }

  const goNext = () => {
    const field = fields[stepIndex]
    if (field.required && !values[field.key]?.trim()) {
      setShakeToken((token) => token + 1)
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
    setDirection(index > stepIndex ? 1 : -1)
    setStepIndex(index)
    setStage('fields')
  }

  const handleSave = () => {
    if (!categoryId || !values.title?.trim()) {
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
              initial={{ y: '100%', opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 32 }}
              onClick={(event) => event.stopPropagation()}
              className="term-panel term-brackets relative w-full max-w-lg overflow-hidden rounded-t sm:rounded p-6 sm:p-7"
            >
              <BorderTrail color="rgba(220,80,0,0.85)" size={90} duration={6} />
              <div className="bg-ink/25 mx-auto mb-4 h-1.5 w-12 rounded-full sm:hidden" />

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
                    <h2 className="mt-1 text-xl font-bold uppercase tracking-tight">
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
                            className="term-panel-soft flex flex-col items-center gap-1.5 rounded p-4"
                          >
                            <CategoryIcon icon={category.icon} color={category.color} size={30} />
                            <span className="text-center text-xs font-medium uppercase tracking-wide text-ink-soft">
                              {category.name}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : stage === 'photo' ? (
                  <motion.div key="photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <button
                      type="button"
                      onClick={goBack}
                      className="text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
                    >
                      [ ← Back ]
                    </button>
                    <h2 className="mt-2 text-xl font-bold uppercase tracking-tight">Add a photo?</h2>
                    <p className="mt-1 text-sm text-ink-soft">Totally optional — you can skip this.</p>

                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoPick}
                      className="hidden"
                    />

                    {photoPreview ? (
                      <div className="border-ink/20 relative mt-5 border">
                        <img src={photoPreview} alt="Selected" className="h-48 w-full object-cover" />
                        <button
                          type="button"
                          onClick={clearPhoto}
                          className="bg-cloud/80 text-ink absolute right-3 top-3 rounded px-3 py-1 text-xs font-medium uppercase tracking-wide backdrop-blur-sm"
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
                        <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                          Tap to add a photo
                        </span>
                      </motion.button>
                    )}

                    {photoError ? <p className="mt-2 text-sm text-red-400">{photoError}</p> : null}

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
                        className="text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
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
                            <h3 className="mt-2 text-2xl font-bold uppercase leading-snug tracking-tight">
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
                      className="text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
                    >
                      [ ← Back ]
                    </button>
                    <h2 className="mt-2 flex items-center gap-2 text-xl font-bold uppercase tracking-tight">
                      {activeCategory ? (
                        <CategoryIcon icon={activeCategory.icon} color={activeCategory.color} size={20} />
                      ) : null}
                      Ready to save?
                    </h2>

                    {photoPreview ? (
                      <div className="border-ink/20 mt-4 border">
                        <img src={photoPreview} alt="Selected" className="h-40 w-full object-cover" />
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-2">
                      {fields.map((field, index) => (
                        <button
                          key={field.key}
                          type="button"
                          onClick={() => jumpToStep(index)}
                          className="term-panel-soft flex items-center justify-between gap-3 rounded p-3 text-left"
                        >
                          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-ink-soft">
                            {field.label}
                          </span>
                          <span className="truncate text-sm font-medium text-ink">
                            {values[field.key]?.trim() || '—'}
                          </span>
                        </button>
                      ))}
                    </div>

                    <motion.button
                      ref={saveButtonRef}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={handleSave}
                      className="term-btn-primary mt-6 w-full rounded-full px-4 py-3.5 text-sm font-semibold uppercase tracking-widest"
                    >
                      Save to vault
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
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

      <div className="fixed bottom-28 right-4 z-30 sm:right-8">
        <motion.button
          ref={fabRef}
          type="button"
          onMouseMove={handleMagnetMove}
          onMouseLeave={resetMagnet}
          onClick={() => setOpen(true)}
          style={{ x: springX, y: springY }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="group relative flex h-16 w-16 items-center justify-center rounded-full"
          aria-label="Add a new memory"
        >
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

