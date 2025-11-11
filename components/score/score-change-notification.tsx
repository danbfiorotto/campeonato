'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Sparkles } from 'lucide-react'
import { ConfettiTrigger } from './confetti-trigger'

interface ScoreChangeNotificationProps {
  racWins: number
  astWins: number
}

export function ScoreChangeNotification({ racWins, astWins }: ScoreChangeNotificationProps) {
  const [showNotification, setShowNotification] = useState(false)
  const [winner, setWinner] = useState<'RAC' | 'AST' | null>(null)
  const [confettiTrigger, setConfettiTrigger] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)

  const checkScoreChange = useCallback(() => {
    // Verificar se houve mudança no placar
    const lastScore = localStorage.getItem('lastScore')
    const currentScore = `${racWins}-${astWins}`
    
    if (lastScore && lastScore !== currentScore) {
      // Determinar o vencedor (quem ganhou pontos)
      const [lastRac, lastAst] = lastScore.split('-').map(Number)
      
      let newWinner: 'RAC' | 'AST' | null = null
      if (racWins > lastRac) {
        newWinner = 'RAC'
      } else if (astWins > lastAst) {
        newWinner = 'AST'
      }
      
      if (newWinner) {
        setWinner(newWinner)
        
        // Pequeno delay para garantir que o usuário está vendo
        setTimeout(() => {
          // Mostrar notificação e confete
          setShowNotification(true)
          setConfettiTrigger(true)
          
          setTimeout(() => {
            setConfettiTrigger(false)
          }, 100)
          
          // Salvar o placar atual para não mostrar novamente
          localStorage.setItem('lastScore', currentScore)
          
          // Esconder notificação após 5 segundos
          setTimeout(() => {
            setShowNotification(false)
          }, 5000)
        }, 500)
      }
    } else if (!lastScore) {
      // Primeira vez - salvar o placar atual
      localStorage.setItem('lastScore', currentScore)
    }
  }, [racWins, astWins])

  // Detectar quando o placar fica visível na tela
  useEffect(() => {
    // Usar um observer para detectar quando o usuário rola até o placar
    const handleScroll = () => {
      if (hasChecked) return
      
      const scrollPosition = window.scrollY || window.pageYOffset
      const windowHeight = window.innerHeight
      
      // Se o usuário está nas primeiras 2 telas (onde está o placar), verificar mudança
      if (scrollPosition < windowHeight * 2) {
        checkScoreChange()
        setHasChecked(true)
      }
    }

    // Verificar imediatamente se já está na posição correta
    handleScroll()

    // Adicionar listener de scroll
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [hasChecked, checkScoreChange])

  return (
    <>
      <div ref={notificationRef} className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" />
      <ConfettiTrigger trigger={confettiTrigger} team={winner || undefined} intensity="high" />
      
      <AnimatePresence>
        {showNotification && winner && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className={`
              px-6 py-4 rounded-lg shadow-2xl backdrop-blur-md border-2
              ${winner === 'RAC' 
                ? 'bg-orange-500/20 border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.6)]' 
                : 'bg-red-500/20 border-red-500/50 shadow-[0_0_40px_rgba(220,38,38,0.6)]'
              }
            `}>
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 10, 0] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                >
                  <Trophy className={`w-6 h-6 ${winner === 'RAC' ? 'text-orange-400' : 'text-red-400'}`} />
                </motion.div>
                <div>
                  <div className={`font-bold text-lg ${winner === 'RAC' ? 'text-orange-300' : 'text-red-300'}`}>
                    {winner} venceu uma série!
                  </div>
                  <div className="text-sm text-neutral-300">
                    Placar: {racWins} x {astWins}
                  </div>
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <Sparkles className={`w-5 h-5 ${winner === 'RAC' ? 'text-orange-400' : 'text-red-400'}`} />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
