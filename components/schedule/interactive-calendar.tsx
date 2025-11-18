'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

interface SeriesWithDate {
  id: string
  date: string | null
  is_completed?: boolean
  games: {
    name: string
    slug: string
  } | null
}

interface InteractiveCalendarProps {
  series: SeriesWithDate[]
}

export function InteractiveCalendar({ series }: InteractiveCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSeries, setSelectedSeries] = useState<SeriesWithDate[]>([])

  // Filtrar séries com data
  const seriesWithDates = useMemo(() => {
    return series.filter(s => s.date !== null)
  }, [series])

  // Criar mapa de datas com séries e identificar quais já aconteceram
  const datesWithSeries = useMemo(() => {
    const map = new Map<string, SeriesWithDate[]>()
    const completedDates = new Set<string>()
    
    seriesWithDates.forEach(serie => {
      if (serie.date) {
        const dateKey = new Date(serie.date).toISOString().split('T')[0]
        const existing = map.get(dateKey) || []
        map.set(dateKey, [...existing, serie])
        
        // Marcar data como tendo jogos concluídos se pelo menos uma série estiver concluída
        if (serie.is_completed) {
          completedDates.add(dateKey)
        }
      }
    })
    
    return { map, completedDates }
  }, [seriesWithDates])

  // Navegação do calendário
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay()

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getDateKey = (day: number) => {
    return new Date(year, month, day).toISOString().split('T')[0]
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    )
  }

  const isPast = (day: number) => {
    const date = new Date(year, month, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date < today
  }

  // Função para obter o caminho do logo baseado no slug do jogo
  const getGameLogoPath = (slug: string | null | undefined): string | null => {
    if (!slug) return null
    const slugLower = slug.toLowerCase()
    // Mapear slugs conhecidos para os logos disponíveis
    const logoMap: Record<string, string> = {
      'lol': '/games/logos/logo-lol.png',
      'league of legends': '/games/logos/logo-lol.png',
      'r6': '/games/logos/logo-r6.png',
      'rainbow six siege': '/games/logos/logo-r6.png',
      'valorant': '/games/logos/logo-valorant.png',
      'cs': '/games/logos/logo-cs.png',
      'counter-strike': '/games/logos/logo-cs.png',
      'brawlhalla': '/games/logos/logo-brawlhalla.png',
    }
    return logoMap[slugLower] || null
  }

  // Obter jogos únicos de uma lista de séries
  // Prioriza séries concluídas quando há múltiplas séries do mesmo jogo
  const getUniqueGames = (series: SeriesWithDate[]) => {
    const gamesMap = new Map<string, SeriesWithDate>()
    series.forEach(serie => {
      const slug = serie.games?.slug
      if (slug) {
        const existing = gamesMap.get(slug)
        // Se não existe ou se a atual é concluída e a existente não é, substitui
        if (!existing || (serie.is_completed && !existing.is_completed)) {
          gamesMap.set(slug, serie)
        }
      }
    })
    return Array.from(gamesMap.values())
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="neon-card border-blue-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white font-heading flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-400" />
              Calendário de Jogos
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="text-xs border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500"
            >
              Hoje
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        {/* Navegação do mês */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPreviousMonth}
            className="text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-xl font-heading font-semibold text-white">
            {monthNames[month]} {year}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextMonth}
            className="text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-heading font-medium text-blue-400/70 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Dias do mês */}
        <div className="grid grid-cols-7 gap-1">
          {/* Espaços vazios antes do primeiro dia */}
          {Array.from({ length: startingDayOfWeek }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square" />
          ))}

          {/* Dias do mês */}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1
            const dateKey = getDateKey(day)
            const seriesForDate = datesWithSeries.map.get(dateKey) || []
            const hasSeries = seriesForDate.length > 0
            const hasCompletedGames = datesWithSeries.completedDates.has(dateKey)
            const today = isToday(day)
            const past = isPast(day)

            return (
              <button
                key={day}
                onClick={() => {
                  if (hasSeries) {
                    setSelectedDate(dateKey)
                    setSelectedSeries(seriesForDate)
                  }
                }}
                disabled={!hasSeries}
                className={`
                  aspect-square relative rounded-md border transition-all duration-200
                  ${today 
                    ? 'border-orange-500/50 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.3)]' 
                    : hasCompletedGames
                    ? 'border-green-500/50 bg-green-500/10 hover:bg-green-500/20 hover:border-green-500/70 cursor-pointer shadow-[0_0_10px_rgba(34,197,94,0.3)] hover:shadow-[0_0_15px_rgba(34,197,94,0.5)]'
                    : past
                    ? 'border-neutral-700/30 bg-neutral-800/20 opacity-60'
                    : hasSeries
                    ? 'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-500/70 cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.2)] hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                    : 'border-neutral-700/20 bg-neutral-800/10 hover:bg-neutral-800/20 cursor-default'
                  }
                  ${hasSeries ? 'hover:scale-105' : ''}
                `}
                aria-label={hasSeries ? `Ver jogos do dia ${day}` : `Dia ${day}`}
              >
                <div className="flex flex-col h-full p-0">
                  <span
                    className={`
                      text-xs sm:text-sm font-medium mb-0.5 px-0.5
                      ${today 
                        ? 'text-orange-400' 
                        : hasCompletedGames
                        ? 'text-green-300'
                        : past
                        ? 'text-neutral-500'
                        : hasSeries
                        ? 'text-blue-300'
                        : 'text-neutral-400'
                      }
                    `}
                  >
                    {day}
                  </span>
                  {hasSeries && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-full flex flex-wrap items-center justify-center gap-0.5">
                        {(() => {
                          const uniqueGames = getUniqueGames(seriesForDate)
                          // Mostrar menos logos para que fiquem maiores
                          const maxLogos = uniqueGames.length <= 2 ? uniqueGames.length : 2
                          const gamesToShow = uniqueGames.slice(0, maxLogos)
                          const remainingCount = uniqueGames.length - gamesToShow.length
                          
                          return (
                            <>
                              {gamesToShow.map((serie) => {
                                const logoPath = getGameLogoPath(serie.games?.slug)
                                if (!logoPath) return null
                                
                                return (
                                  <div
                                    key={`${serie.games?.slug || serie.id}-${serie.id}`}
                                    className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded overflow-hidden hover:scale-110 transition-transform flex items-center justify-center"
                                    title={`${serie.games?.name || 'Jogo'}${serie.is_completed ? ' (Concluído)' : ''}`}
                                  >
                                    <Image
                                      src={logoPath}
                                      alt={serie.games?.name || 'Jogo'}
                                      fill
                                      className="object-contain"
                                      sizes="(max-width: 640px) 40px, (max-width: 768px) 48px, (max-width: 1024px) 56px, 64px"
                                    />
                                  </div>
                                )
                              })}
                              {remainingCount > 0 && (
                                <div className={`text-[9px] sm:text-[10px] font-medium font-heading px-0.5 ${
                                  hasCompletedGames ? 'text-green-400' : 'text-blue-400'
                                }`}>
                                  +{remainingCount}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Legenda */}
        <div className="mt-6 pt-4 border-t border-neutral-700/50 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-blue-500/50 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
            <span className="text-neutral-300">Jogos futuros</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-green-500/50 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
            <span className="text-neutral-300">Jogos realizados</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-orange-500/50 bg-orange-500/10 shadow-[0_0_8px_rgba(249,115,22,0.3)]" />
            <span className="text-neutral-300">Hoje</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-neutral-700/30 bg-neutral-800/20 opacity-60" />
            <span className="text-neutral-400">Passado</span>
          </div>
        </div>

        {/* Dialog com detalhes dos jogos do dia selecionado */}
        <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
          <DialogContent className="bg-neutral-900/95 border-blue-500/30 max-w-md neon-card">
            <DialogHeader>
              <DialogTitle className="text-white font-heading">
                {selectedDate && new Date(selectedDate).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              {selectedSeries.map((serie) => {
                const serieDate = serie.date ? new Date(serie.date) : null
                return (
                  <Link
                    key={serie.id}
                    href={`/jogos/${serie.id}`}
                    className="block p-4 rounded-lg border border-blue-500/30 hover:border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                          {serie.games?.name || 'Jogo'}
                        </div>
                        {serieDate && (
                          <div className="text-xs text-blue-400/70 mt-1">
                            {serieDate.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                        Ver detalhes →
                      </Badge>
                    </div>
                  </Link>
                )
              })}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
    </motion.div>
  )
}

