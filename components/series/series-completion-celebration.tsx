'use client'

import { useEffect, useState } from 'react'
import { ConfettiTrigger } from '@/components/score/confetti-trigger'

interface SeriesCompletionCelebrationProps {
  isCompleted: boolean
  winner?: 'RAC' | 'AST' | null
  scoreRac: number
  scoreAst: number
}

export function SeriesCompletionCelebration({ 
  isCompleted, 
  winner, 
  scoreRac, 
  scoreAst 
}: SeriesCompletionCelebrationProps) {
  const [trigger, setTrigger] = useState(false)
  const [hasTriggered, setHasTriggered] = useState(false)

  useEffect(() => {
    // Disparar confete apenas uma vez quando a série for concluída
    if (isCompleted && winner && !hasTriggered) {
      setTrigger(true)
      setHasTriggered(true)
      setTimeout(() => {
        setTrigger(false)
      }, 100)
    }
  }, [isCompleted, winner, hasTriggered])

  if (!isCompleted || !winner) return null

  return <ConfettiTrigger trigger={trigger} team={winner} intensity="high" />
}

