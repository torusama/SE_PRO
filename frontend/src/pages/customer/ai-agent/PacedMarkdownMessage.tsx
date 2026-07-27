import { useEffect, useMemo, useRef, useState } from 'react'
import MarkdownMessage from './MarkdownMessage'

interface PacedMarkdownMessageProps {
  content: string
  animate: boolean
  onComplete?: () => void
}

const TICK_MS = 32
const CHARACTERS_PER_TICK = 3

export default function PacedMarkdownMessage({
  content,
  animate,
  onComplete,
}: PacedMarkdownMessageProps) {
  const reducedMotion = useMemo(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [visibleLength, setVisibleLength] = useState(
    animate && !reducedMotion ? 0 : content.length,
  )
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!animate) return
    if (reducedMotion) {
      const frame = window.requestAnimationFrame(() =>
        onCompleteRef.current?.(),
      )
      return () => window.cancelAnimationFrame(frame)
    }

    let progress = 0
    const timer = window.setInterval(() => {
      progress = Math.min(content.length, progress + CHARACTERS_PER_TICK)
      setVisibleLength(progress)
      if (progress >= content.length) {
        window.clearInterval(timer)
        onCompleteRef.current?.()
      }
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [animate, content.length, reducedMotion])

  return (
    <div
      className={`agent-paced-message ${animate && visibleLength < content.length ? 'is-typing' : ''}`}
      aria-live={animate ? 'polite' : undefined}
    >
      <MarkdownMessage content={content.slice(0, visibleLength)} />
      {animate && visibleLength < content.length && (
        <span className="agent-paced-cursor" aria-hidden="true" />
      )}
    </div>
  )
}
