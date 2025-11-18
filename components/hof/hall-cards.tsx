'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award, Star } from 'lucide-react'
import { motion } from 'framer-motion'

interface Player {
  player: {
    id: string
    name: string
    team_id: string
    teams: {
      name: string
    }
  }
  count: number
  games: Set<string>
}

interface HallCardsProps {
  players: Player[]
  type: 'mvp' | 'matches' | 'kills' | 'assists' | 'deaths' | 'kda'
  selectedGame: string
}

export function HallCards({ players, type, selectedGame }: HallCardsProps) {
  if (players.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-400">Nenhum jogador encontrado</p>
      </div>
    )
  }

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-yellow-400" />
    if (index === 1) return <Medal className="w-6 h-6 text-gray-300" />
    if (index === 2) return <Medal className="w-6 h-6 text-orange-400" />
    return <Award className="w-5 h-5 text-neutral-500" />
  }

  const getRankBadge = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {players.map((item, index) => {
        const player = item.player
        const team = player.teams
        const isRac = team?.name === 'RAC'
        const isAst = team?.name === 'AST'
        const gamesArray = Array.from(item.games)

        return (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card className={`
              neon-card h-full transition-all duration-300 hover:scale-105
              ${isRac ? 'neon-card-rac' : isAst ? 'neon-card-ast' : ''}
            `}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold
                      ${index === 0 ? 'bg-yellow-500/20 border-2 border-yellow-500/50' : ''}
                      ${index === 1 ? 'bg-gray-400/20 border-2 border-gray-400/50' : ''}
                      ${index === 2 ? 'bg-orange-500/20 border-2 border-orange-500/50' : ''}
                      ${index > 2 ? 'bg-neutral-700/50 border border-neutral-600' : ''}
                    `}>
                      {getRankBadge(index)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{player.name}</h3>
                      <Badge 
                        className={`
                          mt-1 text-xs
                          ${isRac 
                            ? 'bg-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.6)]' 
                            : isAst
                            ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)]'
                            : 'bg-gray-600'
                          }
                        `}
                      >
                        {team?.name || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                  {getRankIcon(index)}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 text-sm">
                      {type === 'mvp' ? 'MVPs' : 
                       type === 'matches' ? 'Partidas jogadas' :
                       type === 'kills' ? 'Total de Kills' :
                       type === 'assists' ? 'Total de Assists' :
                       type === 'deaths' ? 'Total de Deaths' :
                       'KDA Médio'}:
                    </span>
                    <div className="flex items-center gap-2">
                      {type === 'mvp' && <Star className="w-4 h-4 text-yellow-400" />}
                      <span className="text-2xl font-bold text-white">
                        {type === 'kda' ? item.count.toFixed(2) : item.count}
                      </span>
                    </div>
                  </div>

                  {gamesArray.length > 0 && (
                    <div>
                      <span className="text-neutral-400 text-xs block mb-2">
                        Jogos:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {gamesArray.slice(0, 3).map((game, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className="text-xs bg-neutral-800/50 border-neutral-700"
                          >
                            {game}
                          </Badge>
                        ))}
                        {gamesArray.length > 3 && (
                          <Badge 
                            variant="outline" 
                            className="text-xs bg-neutral-800/50 border-neutral-700"
                          >
                            +{gamesArray.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

