import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { HeroHeader } from '@/components/layout/hero-header'
import { Calendar, Clock, Gamepad2 } from 'lucide-react'
import { getSeriesFormat, getWinsNeeded } from '@/lib/utils/series'
import { SeriesCard } from '@/components/series/series-card'
import { InteractiveCalendar } from '@/components/schedule/interactive-calendar'
import { UnscheduledSeries } from '@/components/schedule/unscheduled-series'

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
  
  // Get matches count for each series
  const { data: allMatches } = await supabase
    .from('matches')
    .select('series_id')
  
  const matchesBySeries = new Map<string, number>()
  allMatches?.forEach((match: any) => {
    const count = matchesBySeries.get(match.series_id) || 0
    matchesBySeries.set(match.series_id, count + 1)
  })
  
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
              Calendário de jogos e séries agendadas
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {/* Calendário Interativo */}
              <div className="lg:col-span-2">
                <InteractiveCalendar series={upcomingSeries} />
              </div>
              
              {/* Séries sem data agendada */}
              <div className="lg:col-span-1">
                <UnscheduledSeries 
                  series={upcomingSeries.filter(s => !s.date)} 
                />
              </div>
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
              const matchesCount = matchesBySeries.get(serie.id) || 0
              
              return (
                <SeriesCard 
                  key={serie.id}
                  serie={serie}
                  game={game}
                  winner={winner}
                  matchesCount={matchesCount}
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

