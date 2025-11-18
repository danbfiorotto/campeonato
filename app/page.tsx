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
  
  // Get all series with dates for calendar (including completed ones)
  const { data: allSeriesWithDates } = await supabase
    .from('series')
    .select(`
      *,
      games (*)
    `)
    .not('date', 'is', null)
    .order('date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  
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
  
  // Get player match stats for K/D calculation
  const { data: playerStatsData } = await supabase
    .from('player_match_stats')
    .select(`
      player_id,
      kills,
      deaths,
      assists,
      players (
        id,
        name,
        team_id
      )
    `)

  // Calculate player stats with K/D
  const playerStats = new Map<string, { 
    name: string
    wins: number
    mvps: number
    totalKills: number
    totalDeaths: number
    totalAssists: number
    kd: number
  }>()
  
  // Initialize from matches
  matches?.forEach(match => {
    if (match.mvp_player_id) {
      const current = playerStats.get(match.mvp_player_id) || { 
        name: '', 
        wins: 0, 
        mvps: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        kd: 0
      }
      current.mvps++
      playerStats.set(match.mvp_player_id, current)
    }
    
    match.match_players?.forEach((mp: any) => {
      if (mp.matches?.winner_team_id === mp.players?.team_id) {
        const current = playerStats.get(mp.player_id) || { 
          name: mp.players?.name || '', 
          wins: 0, 
          mvps: 0,
          totalKills: 0,
          totalDeaths: 0,
          totalAssists: 0,
          kd: 0
        }
        current.name = mp.players?.name || current.name
        current.wins++
        playerStats.set(mp.player_id, current)
      }
    })
  })

  // Add stats from player_match_stats
  playerStatsData?.forEach((stat: any) => {
    const playerId = stat.player_id
    const player = stat.players as any
    
    if (!playerId || !player) return

    const current = playerStats.get(playerId) || {
      name: player.name || '',
      wins: 0,
      mvps: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      kd: 0
    }
    
    // Sempre atualizar o nome se disponível
    if (player.name) {
      current.name = player.name
    }
    
    current.totalKills += stat.kills || 0
    current.totalDeaths += stat.deaths || 0
    current.totalAssists += stat.assists || 0
    
    // Calculate K/D: kills / deaths (sem assists)
    const deaths = Math.max(1, current.totalDeaths) // Evitar divisão por zero
    current.kd = current.totalKills / deaths
    
    playerStats.set(playerId, current)
  })

  // Sort with tiebreaker by K/D
  const sortByMVPsWithKD = (a: any, b: any) => {
    if (b.mvps !== a.mvps) return b.mvps - a.mvps
    return b.kd - a.kd // Em caso de empate, melhor K/D
  }

  const sortByWinsWithKD = (a: any, b: any) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return b.kd - a.kd // Em caso de empate, melhor K/D
  }

  const sortByKD = (a: any, b: any) => {
    return b.kd - a.kd
  }
  
  const topMVP = Array.from(playerStats.values())
    .filter(p => p.mvps > 0)
    .sort(sortByMVPsWithKD)[0]
    
  const topWins = Array.from(playerStats.values())
    .filter(p => p.wins > 0)
    .sort(sortByWinsWithKD)[0]

  const topKD = Array.from(playerStats.values())
    .filter(p => p.totalKills > 0 || p.totalDeaths > 0) // Pelo menos uma estatística
    .sort(sortByKD)[0]

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
                <InteractiveCalendar series={allSeriesWithDates || []} />
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
        {(topMVP || topWins || topKD) && (
          <div className="mt-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 text-center">
              Destaques
            </h2>
            <p className="text-gray-400 text-center mb-8">
              MVPs, Vitórias e Melhor K/D
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {topMVP && topMVP.mvps > 0 && (
                <Card className="neon-card border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="text-purple-400 flex items-center gap-2">
                      <span className="text-2xl">⭐</span>
                      Top MVP
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Jogador com mais MVPs
                      {topMVP.kd > 0 && (
                        <span className="block text-xs mt-1">
                          K/D: {topMVP.kd.toFixed(2)}
                        </span>
                      )}
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
                      {topWins.kd > 0 && (
                        <span className="block text-xs mt-1">
                          K/D: {topWins.kd.toFixed(2)}
                        </span>
                      )}
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

              {topKD && topKD.kd > 0 && (
                <Card className="neon-card border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="text-blue-400 flex items-center gap-2">
                      <span className="text-2xl">🎯</span>
                      Melhor K/D
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Melhor Kill/Death Ratio
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white mb-2 neon-glow">
                      {topKD.name}
                    </div>
                    <div className="text-blue-300 text-lg">
                      K/D: {topKD.kd.toFixed(2)}
                    </div>
                    <div className="text-gray-400 text-sm mt-2">
                      {topKD.totalKills}K / {topKD.totalDeaths}D / {topKD.totalAssists}A
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

