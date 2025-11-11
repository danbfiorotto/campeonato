'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

interface ConfettiTriggerProps {
  trigger: boolean
  team?: 'RAC' | 'AST'
  intensity?: 'low' | 'medium' | 'high'
}

export function ConfettiTrigger({ trigger, team, intensity = 'medium' }: ConfettiTriggerProps) {
  useEffect(() => {
    if (!trigger) return

    const duration = intensity === 'low' ? 2000 : intensity === 'medium' ? 3000 : 5000
    const particleCount = intensity === 'low' ? 50 : intensity === 'medium' ? 100 : 200

    // Cores baseadas no time
    const colors = team === 'RAC' 
      ? ['#ff4d00', '#ff7700', '#ff9900'] // Laranja
      : team === 'AST'
      ? ['#ff004d', '#ff0066', '#ff0080'] // Vermelho
      : ['#4ade80', '#22c55e', '#16a34a'] // Verde (neutro)

    // Explosão central
    confetti({
      particleCount,
      spread: 70,
      origin: { y: 0.6 },
      colors,
      zIndex: 9999
    })

    // Explosões laterais
    setTimeout(() => {
      confetti({
        particleCount: particleCount / 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
        zIndex: 9999
      })
      confetti({
        particleCount: particleCount / 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
        zIndex: 9999
      })
    }, 250)

    // Explosão final
    setTimeout(() => {
      confetti({
        particleCount: particleCount / 3,
        spread: 100,
        origin: { y: 0.4 },
        colors,
        zIndex: 9999
      })
    }, 500)
  }, [trigger, team, intensity])

  return null
}

