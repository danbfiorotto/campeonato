'use client'

import { motion } from 'framer-motion'
import { Medal } from 'lucide-react'

interface GameMedalProps {
  gameSlug: string
  gameName: string
  teamColor: 'orange' | 'red'
}

export function GameMedal({ gameName, teamColor }: GameMedalProps) {
  const borderColor = teamColor === 'orange' 
    ? 'border-orange-500/70 shadow-[0_0_20px_rgba(249,115,22,0.6)]' 
    : 'border-red-500/70 shadow-[0_0_20px_rgba(220,38,38,0.6)]'
  
  const bgGradient = teamColor === 'orange'
    ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10'
    : 'bg-gradient-to-br from-red-500/20 to-red-600/10'

  const iconColor = teamColor === 'orange'
    ? 'text-orange-400'
    : 'text-red-400'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
      whileHover={{ scale: 1.1, y: -5 }}
      className="relative group inline-block"
      title={gameName}
    >
      <div className={`
        relative 
        inline-flex items-center justify-center
        transition-all duration-300
        group-hover:shadow-[0_0_30px_rgba(249,115,22,0.8)]
        p-2
        border-2 
        rounded-full
        ${borderColor}
        ${bgGradient}
        w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16
      `}
      >
        <Medal className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 ${iconColor}`} />
        {/* Efeito de brilho */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-full" />
      </div>
      {/* Efeito de partículas/brilho ao redor */}
      <div className={`
        absolute inset-0 rounded-full
        ${teamColor === 'orange' 
          ? 'bg-orange-500/20' 
          : 'bg-red-500/20'
        }
        blur-xl opacity-0 group-hover:opacity-100 
        transition-opacity duration-300
        -z-10
      `} />
    </motion.div>
  )
}

