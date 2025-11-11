'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { getSeriesFormat, getWinsNeeded } from '@/lib/utils/series'
import { ScoreDisplay } from '@/components/score/score-display'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SeriesCardProps {
  serie: any
  game: any
  winner: any
}

export function SeriesCard({ serie, game, winner }: SeriesCardProps) {
  const isRacWinner = winner?.name === 'RAC'
  const isAstWinner = winner?.name === 'AST'

  return (
    <Link 
      href={`/jogos/${serie.id}`}
      className="group"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.02 }}
      >
        <Card className={cn(
          'neon-card h-full transition-all duration-300 hover:scale-105',
          isRacWinner && 'neon-card-rac shadow-[0_0_30px_rgba(255,77,0,0.4)]',
          isAstWinner && 'neon-card-ast shadow-[0_0_30px_rgba(255,0,77,0.4)]'
        )}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-white font-heading">{game?.name || 'Jogo'}</CardTitle>
                <CardDescription className="text-neutral-400 mt-1">
                  {serie.date 
                    ? new Date(serie.date).toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })
                    : 'Sem data definida'
                  }
                </CardDescription>
              </div>
              {serie.is_completed ? (
                <Badge className="bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]">
                  Concluído
                </Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 bg-yellow-500/10">
                  Em andamento
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {serie.is_completed ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-300 text-sm font-medium">Vencedor:</span>
                  <Badge 
                    className={
                      isRacWinner 
                        ? 'bg-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.6)]' 
                        : isAstWinner
                        ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)]'
                        : 'bg-gray-600'
                    }
                  >
                    {winner?.name || 'N/A'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-300 text-sm font-medium">Placar:</span>
                  <ScoreDisplay 
                    scoreRac={serie.score_rac} 
                    scoreAst={serie.score_ast} 
                    size="md"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-300 text-sm font-medium">Placar Atual:</span>
                  <ScoreDisplay 
                    scoreRac={serie.score_rac} 
                    scoreAst={serie.score_ast} 
                    size="md"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 text-xs">Formato:</span>
                  <Badge variant="outline" className="text-xs">
                    {getSeriesFormat(game?.slug)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 text-xs">Vitórias necessárias:</span>
                  <span className="text-neutral-300 text-xs font-medium">
                    {getWinsNeeded(game?.slug)} vitórias
                  </span>
                </div>
              </div>
            )}
            <div className="mt-4 text-orange-400 text-sm group-hover:text-orange-300 transition-colors flex items-center gap-1">
              Ver detalhes
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  )
}

