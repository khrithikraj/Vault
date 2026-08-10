import { motion } from 'motion/react'

type ShimmerTextProps = {
  text: string
  as?: 'h1' | 'h2' | 'p' | 'span'
  className?: string
  delay?: number
}

/** Per-letter blur-in reveal on mount, GenZ-style headline entrance. */
export function ShimmerText({ text, as = 'span', className = '', delay = 0 }: ShimmerTextProps) {
  const Tag = motion[as]
  const words = text.split(' ')
  let charIndex = 0

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, wordIndex) => (
        // The space is a sibling of the (inline-block) word span, not a child of it —
        // trailing whitespace inside an inline-block gets collapsed away by the browser
        // since inline-block establishes its own formatting context.
        <span key={`word-${wordIndex}`}>
          <span className="inline-block whitespace-nowrap">
            {Array.from(word).map((letter) => {
              const index = charIndex++
              return (
                <motion.span
                  key={`${letter}-${index}`}
                  aria-hidden="true"
                  className="inline-block"
                  initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{
                    duration: 0.5,
                    delay: delay + index * 0.02,
                    ease: 'easeOut',
                  }}
                >
                  {letter}
                </motion.span>
              )
            })}
          </span>
          {wordIndex < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  )
}
