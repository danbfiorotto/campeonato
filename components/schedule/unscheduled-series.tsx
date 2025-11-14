'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Gamepad2, CalendarX } from 'lucide-react'
import { motion } from 'framer-motion'

interface SeriesWithoutDate {
  id: string
  games: {
    name: string
    slug: string
  } | null
}

interface UnscheduledSeriesProps {
  series: SeriesWithoutDate[]
}

export function UnscheduledSeries({ series }: UnscheduledSeriesProps) {
  if (series.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="neon-card border-green-500/30">
          <CardHeader>
            <CardTitle className="text-white font-heading flex items-center gap-2">
              <CalendarX className="w-5 h-5 text-green-400" />
              Sem Data Agendada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-neutral-300 text-sm">
              Todas as séries já estão agendadas! 🎉
            </p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="neon-card border-yellow-500/30">
        <CardHeader>
          <CardTitle className="text-white font-heading flex items-center gap-2">
            <CalendarX className="w-5 h-5 text-yellow-400" />
            Sem Data Agendada
          </CardTitle>
          <CardDescription className="text-neutral-400">
            {series.length} série{series.length !== 1 ? 's' : ''} aguardando agendamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {series.map((serie, index) => (
              <motion.div
                key={serie.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link
                  href={`/jogos/${serie.id}`}
                  className="block group"
                >
                  <div className="p-4 rounded-lg border border-yellow-500/30 hover:border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all hover:scale-[1.02] shadow-[0_0_10px_rgba(234,179,8,0.1)] hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                    <div className="flex items-center gap-3">
                      <Gamepad2 className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white group-hover:text-yellow-300 transition-colors">
                          {serie.games?.name || 'Jogo'}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {serie.games?.slug || ''}
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className="border-yellow-500/50 text-yellow-400 bg-yellow-500/10 text-xs shadow-[0_0_8px_rgba(234,179,8,0.2)]"
                      >
                        Sem data
                      </Badge>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

