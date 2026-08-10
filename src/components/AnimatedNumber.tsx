import { useEffect, useRef } from 'react'
import { animate, useMotionValue, useMotionValueEvent } from 'motion/react'
import { useState } from 'react'

type AnimatedNumberProps = {
  value: number
  className?: string
}

/** Spring-driven counting number, used for per-category item counts and stats. */
export function AnimatedNumber({ value, className = '' }: AnimatedNumberProps) {
  const motionValue = useMotionValue(0)
  const [display, setDisplay] = useState(0)
  const previous = useRef(0)

  useMotionValueEvent(motionValue, 'change', (latest) => {
    setDisplay(Math.round(latest))
  })

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.6,
      ease: 'easeOut',
    })
    previous.current = value
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <span className={className}>{display}</span>
}
