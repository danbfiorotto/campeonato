'use client'

import { AnimatedScore } from './animated-score'
import { cn } from '@/lib/utils'

interface ScoreDisplayProps {
  scoreRac: number
  scoreAst: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function ScoreDisplay({ scoreRac, scoreAst, size = 'lg', className }: ScoreDisplayProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <AnimatedScore score={scoreRac} size={size} className="text-white font-bold" />
      <span className="text-neutral-400">x</span>
      <AnimatedScore score={scoreAst} size={size} className="text-white font-bold" />
    </div>
  )
}

