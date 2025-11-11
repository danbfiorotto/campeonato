import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { HeroHeader } from '@/components/layout/hero-header'
import { Calendar, Clock, Gamepad2 } from 'lucide-react'
import { getSeriesFormat, getWinsNeeded } from '@/lib/utils/series'
import { SeriesCard } from '@/components/series/series-card'

export default async function Home() {
  const supabase = await createClient()
  
  // Get teams
  const { data: teams } = await supabase.from('teams').select('*').order('name')
  
  // Get series with games
  const { data: series } = await supabase
    .from('series')
    .select(`
      *,
      games (*),
      teams!series_winner_team_id_fkey (*)
    `)
    .order('created_at')
  
  // Get upcoming games (not completed) for schedule
  const { data: upcomingSeries } = await supabase
    .from('series')
    .select(`
      *,
      games (*)
    `)
    .eq('is_completed', false)
    .order('date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  
  // Calculate overall score
  const racTeam = teams?.find(t => t.name === 'RAC')
  const astTeam = teams?.find(t => t.name === 'AST')
  const racWins = series?.filter(s => s.winner_team_id === racTeam?.id).length || 0
  const astWins = series?.filter(s => s.winner_team_id === astTeam?.id).length || 0
  
  // Get top players (MVP and wins)
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      mvp_player_id,
      match_players (
        player_id,
        players (
          id,
          name,
          team_id
        ),
        matches!inner (
          winner_team_id
        )
      )
    `)
  
  // Calculate player stats
  const playerStats = new Map<string, { name: string; wins: number; mvps: number }>()
  
  matches?.forEach(match => {
    if (match.mvp_player_id) {
      const current = playerStats.get(match.mvp_player_id) || { name: '', wins: 0, mvps: 0 }
      current.mvps++
      playerStats.set(match.mvp_player_id, current)
    }
    
    match.match_players?.forEach((mp: any) => {
      if (mp.matches?.winner_team_id === mp.players?.team_id) {
        const current = playerStats.get(mp.player_id) || { name: mp.players?.name || '', wins: 0, mvps: 0 }
        current.name = mp.players?.name || current.name
        current.wins++
        playerStats.set(mp.player_id, current)
      }
    })
  })
  
  const topMVP = Array.from(playerStats.values())
    .sort((a, b) => b.mvps - a.mvps)[0]
  const topWins = Array.from(playerStats.values())
    .sort((a, b) => b.wins - a.wins)[0]

  return (
    <div className="min-h-screen">
      {/* Hero Header with Logos and Score */}
      <HeroHeader />

      <div className="container mx-auto px-4 py-12">
        {/* Schedule Section */}
        {upcomingSeries && upcomingSeries.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-2 text-center">
              Agenda
            </h2>
            <p className="text-gray-400 text-center mb-8">
              Próximos confrontos
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {upcomingSeries.map((serie) => {
                const game = serie.games as any
                const serieDate = serie.date ? new Date(serie.date) : null
                const isToday = serieDate && 
                  serieDate.toDateString() === new Date().toDateString()
                const isPast = serieDate && serieDate < new Date() && !isToday
                
                return (
                  <Link 
                    key={serie.id} 
                    href={`/jogos/${serie.id}`}
                    className="group"
                  >
                    <Card className="neon-card h-full transition-all duration-300 hover:scale-105 border-blue-500/30 hover:border-blue-500/50">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Gamepad2 className="w-5 h-5 text-blue-400" />
                              <CardTitle className="text-white text-xl font-heading">
                                {game?.name || 'Jogo'}
                              </CardTitle>
                            </div>
                            <CardDescription className="text-gray-400">
                              {game?.slug || ''}
                            </CardDescription>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`${
                              isToday 
                                ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10' 
                                : isPast
                                ? 'border-gray-500/50 text-gray-400 bg-gray-500/10'
                                : 'border-blue-500/50 text-blue-400 bg-blue-500/10'
                            }`}
                          >
                            {isToday ? 'Hoje' : isPast ? 'Atrasado' : 'Agendado'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {serieDate ? (
                            <>
                              <div className="flex items-center gap-2 text-neutral-300">
                                <Calendar className="w-4 h-4 text-blue-400" />
                                <span className="text-sm">
                                  {serieDate.toLocaleDateString('pt-BR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-neutral-300">
                                <Clock className="w-4 h-4 text-blue-400" />
                                <span className="text-sm">
                                  {serieDate.toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 text-neutral-400">
                              <Calendar className="w-4 h-4" />
                              <span className="text-sm">Data a definir</span>
                            </div>
                          )}
                          
                          <div className="pt-2 border-t border-neutral-700">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-neutral-400">RAC</span>
                              <span className="text-white font-bold text-lg">VS</span>
                              <span className="text-sm text-neutral-400">AST</span>
                            </div>
                          </div>
                          
                          <div className="mt-4 text-blue-400 text-sm group-hover:text-blue-300 transition-colors flex items-center gap-1">
                            Ver detalhes
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Games Cards Section */}
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 text-center">
            Modalidades
          </h2>
          <p className="text-gray-400 text-center mb-8">
            Resultados por modalidade
          </p>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {series?.map((serie) => {
              const game = serie.games as any
              const winner = serie.teams as any
              
              return (
                <SeriesCard 
                  key={serie.id}
                  serie={serie}
                  game={game}
                  winner={winner}
                />
              )
            })}
          </div>
        </div>

        {/* Player Highlights Section */}
        {(topMVP || topWins) && (
          <div className="mt-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 text-center">
              Destaques
            </h2>
            <p className="text-gray-400 text-center mb-8">
              MVPs e Top Jogadores
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {topMVP && topMVP.mvps > 0 && (
                <Card className="neon-card border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="text-purple-400 flex items-center gap-2">
                      <span className="text-2xl">⭐</span>
                      Top MVP
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Jogador com mais MVPs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white mb-2 neon-glow">
                      {topMVP.name}
                    </div>
                    <div className="text-purple-300 text-lg">
                      {topMVP.mvps} MVP{topMVP.mvps !== 1 ? 's' : ''}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {topWins && topWins.wins > 0 && (
                <Card className="neon-card border-yellow-500/30">
                  <CardHeader>
                    <CardTitle className="text-yellow-400 flex items-center gap-2">
                      <span className="text-2xl">🏆</span>
                      Mais Vitórias
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Jogador com mais vitórias
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white mb-2 neon-glow">
                      {topWins.name}
                    </div>
                    <div className="text-yellow-300 text-lg">
                      {topWins.wins} vitória{topWins.wins !== 1 ? 's' : ''}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

