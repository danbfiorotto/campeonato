'use client'

import { motion } from 'framer-motion'
import { Trophy, Medal, Award } from 'lucide-react'

interface StatItem {
  player: {
    id: string
    name: string
    team_id: string
    teams: {
      name: string
    }
  }
  count: number
}

interface StatBarChartProps {
  data: StatItem[]
  type: 'kills' | 'assists' | 'deaths' | 'kda'
  maxValue: number
  inverted?: boolean // Para deaths: menos é melhor, então invertemos a visualização
}

export function StatBarChart({ data, type, maxValue, inverted = false }: StatBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-400">
        <p>Nenhum dado disponível</p>
      </div>
    )
  }

  // Para modo invertido (deaths), calcular a porcentagem invertida
  // Quem tem menos deaths deve ter barra maior
  const calculatePercentage = (value: number) => {
    if (inverted) {
      // Invertido: menos deaths = maior porcentagem
      // Se maxValue é o maior número de deaths, então:
      // porcentagem = (maxValue - value) / maxValue * 100
      // Mas precisamos garantir que o mínimo seja 0 e o máximo seja 100
      if (maxValue <= 0) return 0
      const invertedValue = maxValue - value
      const percentage = (invertedValue / maxValue) * 100
      // Garantir que não seja negativo e tenha um mínimo de 5% para visibilidade
      return Math.max(5, Math.min(100, percentage))
    }
    return maxValue > 0 ? (value / maxValue) * 100 : 0
  }

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-400" />
    if (index === 1) return <Medal className="w-5 h-5 text-gray-300" />
    if (index === 2) return <Medal className="w-5 h-5 text-orange-400" />
    return <Award className="w-4 h-4 text-neutral-500" />
  }

  const getRankBadge = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }

  const getBarColor = (index: number, teamName: string) => {
    if (index === 0) return 'from-yellow-500/80 to-yellow-600/60'
    if (index === 1) return 'from-gray-400/80 to-gray-500/60'
    if (index === 2) return 'from-orange-500/80 to-orange-600/60'
    if (teamName === 'RAC') return 'from-orange-500/60 to-orange-600/40'
    if (teamName === 'AST') return 'from-red-500/60 to-red-600/40'
    return 'from-blue-500/60 to-blue-600/40'
  }

  const getGlowColor = (index: number, teamName: string) => {
    if (index === 0) return 'shadow-[0_0_20px_rgba(234,179,8,0.6)]'
    if (index === 1) return 'shadow-[0_0_15px_rgba(156,163,175,0.5)]'
    if (index === 2) return 'shadow-[0_0_15px_rgba(249,115,22,0.5)]'
    if (teamName === 'RAC') return 'shadow-[0_0_10px_rgba(249,115,22,0.4)]'
    if (teamName === 'AST') return 'shadow-[0_0_10px_rgba(220,38,38,0.4)]'
    return ''
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const percentage = calculatePercentage(item.count)
        const team = item.player.teams
        const isRac = team?.name === 'RAC'
        const isAst = team?.name === 'AST'

        return (
          <motion.div
            key={item.player.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="group"
          >
            <div className="relative bg-gradient-to-r from-neutral-900/80 to-neutral-800/40 border border-neutral-800/50 rounded-xl p-4 hover:border-neutral-700/50 hover:shadow-lg transition-all group">
              <div className="flex items-center gap-4">
                {/* Rank Badge */}
                <div className={`
                  w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0
                  transition-all group-hover:scale-110
                  ${index === 0 ? 'bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 border-2 border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.3)]' : ''}
                  ${index === 1 ? 'bg-gradient-to-br from-gray-400/30 to-gray-500/20 border-2 border-gray-400/60 shadow-[0_0_15px_rgba(156,163,175,0.3)]' : ''}
                  ${index === 2 ? 'bg-gradient-to-br from-orange-500/30 to-orange-600/20 border-2 border-orange-500/60 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : ''}
                  ${index > 2 ? 'bg-neutral-800/50 border border-neutral-700/50' : ''}
                `}>
                  {getRankBadge(index)}
                </div>

                {/* Player Info */}
                <div className="flex-shrink-0 min-w-[140px]">
                  <h4 className="text-white font-bold text-base mb-1">{item.player.name}</h4>
                  <span className={`
                    text-xs px-2 py-1 rounded-md font-medium
                    ${isRac 
                      ? 'bg-orange-600/30 text-orange-300 border border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.2)]' 
                      : isAst
                      ? 'bg-red-600/30 text-red-300 border border-red-500/50 shadow-[0_0_10px_rgba(220,38,38,0.2)]'
                      : 'bg-gray-600/30 text-gray-300 border border-gray-500/50'
                    }
                  `}>
                    {team?.name || 'N/A'}
                  </span>
                </div>

                {/* Bar Chart */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400 font-medium uppercase tracking-wide">
                      {type === 'kills' ? 'Kills' : 
                       type === 'assists' ? 'Assists' :
                       type === 'deaths' ? 'Deaths' :
                       'KDA'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-white tabular-nums">
                        {type === 'kda' ? item.count.toFixed(2) : item.count.toLocaleString()}
                      </span>
                      {getRankIcon(index)}
                    </div>
                  </div>
                  <div className="relative h-4 bg-neutral-800/50 rounded-full overflow-hidden border border-neutral-700/50">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                      className={`
                        h-full rounded-full bg-gradient-to-r
                        ${getBarColor(index, team?.name || '')}
                        ${getGlowColor(index, team?.name || '')}
                        relative overflow-hidden
                      `}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                      {/* Valor no final da barra */}
                      {percentage > 15 && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]">
                          {type === 'kda' ? item.count.toFixed(2) : item.count}
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

