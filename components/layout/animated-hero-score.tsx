'use client'

import { AnimatedScore } from '@/components/score/animated-score'
import { useEffect, useState, useRef } from 'react'

interface AnimatedHeroScoreProps {
  racWins: number
  astWins: number
}

export function AnimatedHeroScore({ racWins, astWins }: AnimatedHeroScoreProps) {
  const [displayRacWins, setDisplayRacWins] = useState(racWins)
  const [displayAstWins, setDisplayAstWins] = useState(astWins)
  const [racKey, setRacKey] = useState(0)
  const [astKey, setAstKey] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const scoreRef = useRef<HTMLDivElement>(null)

  // Detectar quando o placar fica visível na tela
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
          }
        })
      },
      {
        threshold: 0.3, // Dispara quando 30% do elemento está visível
      }
    )

    if (scoreRef.current) {
      observer.observe(scoreRef.current)
    }

    return () => {
      if (scoreRef.current) {
        observer.unobserve(scoreRef.current)
      }
    }
  }, [])

  // Animar quando ficar visível E houver mudança no placar
  useEffect(() => {
    if (!isVisible || hasAnimated) return

    // Verificar se houve mudança no placar comparando com localStorage
    const lastScore = localStorage.getItem('lastScore')
    const currentScore = `${racWins}-${astWins}`
    
    if (lastScore && lastScore !== currentScore) {
      // Placar mudou! Vamos animar
      const [lastRac, lastAst] = lastScore.split('-').map(Number)
      
      // Pequeno delay para garantir que está visível
      setTimeout(() => {
        // Animar apenas o número que mudou
        if (racWins !== lastRac) {
          setRacKey(prev => prev + 1)
          setDisplayRacWins(racWins)
        }
        
        if (astWins !== lastAst) {
          setAstKey(prev => prev + 1)
          setDisplayAstWins(astWins)
        }
        
        // Salvar o placar atual após animar
        localStorage.setItem('lastScore', currentScore)
        setHasAnimated(true)
      }, 300) // Delay para garantir que o usuário está vendo
    } else {
      // Primeira vez ou mesmo placar, apenas atualizar sem animação
      setDisplayRacWins(racWins)
      setDisplayAstWins(astWins)
      
      // Salvar o placar atual na primeira vez
      if (!lastScore) {
        localStorage.setItem('lastScore', currentScore)
      }
      setHasAnimated(true)
    }
  }, [isVisible, racWins, astWins, hasAnimated])

  return (
    <div 
      ref={scoreRef}
      className="flex items-center gap-3 sm:gap-4 md:gap-6 lg:gap-12 order-2"
    >
      {/* Divisor decorativo */}
      <div className="hidden md:block w-px h-24 bg-gradient-to-b from-transparent via-orange-500/50 to-transparent"></div>
      
      <div className="text-center">
        <div className="text-orange-500 score-display">
          <AnimatedScore 
            score={displayRacWins} 
            size="xl" 
            className="text-orange-500"
            key={`rac-${racKey}`}
          />
        </div>
        <div className="text-xs sm:text-sm text-orange-400 font-semibold mt-1 sm:hidden">RAC</div>
      </div>
      
      <div className="text-3xl sm:text-4xl md:text-6xl font-bold text-gray-500 font-heading">-</div>
      
      <div className="text-center">
        <div className="text-red-500 score-display">
          <AnimatedScore 
            score={displayAstWins} 
            size="xl" 
            className="text-red-500"
            key={`ast-${astKey}`}
          />
        </div>
        <div className="text-xs sm:text-sm text-red-400 font-semibold mt-1 sm:hidden">AST</div>
      </div>
      
      {/* Divisor decorativo */}
      <div className="hidden md:block w-px h-24 bg-gradient-to-b from-transparent via-red-500/50 to-transparent"></div>
    </div>
  )
}
