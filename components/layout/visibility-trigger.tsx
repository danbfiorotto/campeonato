'use client'

import { useEffect, useRef, useState } from 'react'

interface VisibilityTriggerProps {
  onVisible: () => void
  threshold?: number
  children: React.ReactNode
}

export function VisibilityTrigger({ onVisible, threshold = 0.3, children }: VisibilityTriggerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hasTriggered, setHasTriggered] = useState(false)

  useEffect(() => {
    if (hasTriggered) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTriggered) {
            onVisible()
            setHasTriggered(true)
          }
        })
      },
      {
        threshold,
        rootMargin: '0px 0px -100px 0px' // Dispara um pouco antes de ficar totalmente visível
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [onVisible, threshold, hasTriggered])

  return <div ref={ref}>{children}</div>
}

