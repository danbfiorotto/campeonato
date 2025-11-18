import { createClient } from '@/lib/supabase/server'
import { TeamsWithFilter } from '@/components/times/teams-with-filter'

export default async function TimesPage() {
  const supabase = await createClient()
  
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('name')
  
  // Get series with game info
  const { data: series } = await supabase
    .from('series')
    .select(`
      *,
      games (*),
      winner_team_id
    `)
    .order('created_at', { ascending: false })
  
  // Get players for each team with stats and their games
  const { data: players } = await supabase
    .from('players')
    .select(`
      *,
      player_games (
        game_id,
        games (
          id,
          name,
          slug
        )
      )
    `)
    .order('name')
  
  // Get matches to calculate player stats
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      series_id,
      winner_team_id,
      mvp_player_id,
      match_players (
        player_id,
        players (
          id,
          name,
          team_id
        )
      ),
      series (
        game_id,
        games (
          name,
          slug
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
  
  // Calculate player wins, MVPs, and K/D
  const playerStats = new Map<string, { 
    name: string; 
    wins: number; 
    mvps: number; 
    teamId: string;
    gamesPlayed: number;
    totalKills: number;
    totalDeaths: number;
    totalAssists: number;
    kd: number;
  }>()
  
  players?.forEach(player => {
    playerStats.set(player.id, {
      name: player.name,
      wins: 0,
      mvps: 0,
      teamId: player.team_id,
      gamesPlayed: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      kd: 0,
    })
  })
  
  matches?.forEach(match => {
    if (match.mvp_player_id) {
      const current = playerStats.get(match.mvp_player_id)
      if (current) {
        current.mvps++
        playerStats.set(match.mvp_player_id, current)
      }
    }
    
    match.match_players?.forEach((mp: any) => {
      const current = playerStats.get(mp.player_id)
      if (current) {
        current.gamesPlayed++
        if (mp.players && match.winner_team_id === mp.players.team_id) {
          current.wins++
        }
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
      teamId: player.team_id || '',
      gamesPlayed: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      kd: 0,
    }
    
    if (player.name) {
      current.name = player.name
    }
    
    current.totalKills += stat.kills || 0
    current.totalDeaths += stat.deaths || 0
    current.totalAssists += stat.assists || 0
    
    // Calculate K/D: kills / deaths
    const deaths = Math.max(1, current.totalDeaths) // Evitar divisão por zero
    current.kd = current.totalKills / deaths
    
    playerStats.set(playerId, current)
  })
  
  // Get all games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .order('name')

  // Calculate team stats
  const teamStats = teams?.map(team => {
    const seriesWins = series?.filter(s => s.winner_team_id === team.id).length || 0
    const matchWins = matches?.filter(m => m.winner_team_id === team.id).length || 0
    const totalMatches = matches?.length || 0
    const matchWinRate = totalMatches > 0 ? ((matchWins / totalMatches) * 100).toFixed(1) : '0'
    
    const teamPlayers = players?.filter(p => p.team_id === team.id) || []
    const playersWithStats = teamPlayers.map(p => {
      const playerGames = (p.player_games as any[])?.map((pg: any) => pg.games) || []
      const stats = playerStats.get(p.id) || {
        name: p.name,
        wins: 0,
        mvps: 0,
        teamId: p.team_id,
        gamesPlayed: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        kd: 0,
      }
      return {
        ...p,
        ...stats,
        games: playerGames,
      }
    }).sort((a, b) => {
      // Sort by wins first, then MVPs, then games played
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.mvps !== a.mvps) return b.mvps - a.mvps
      return b.gamesPlayed - a.gamesPlayed
    })

    // Find MVP of THIS SPECIFIC TEAM using same logic as home page (most MVPs, tiebreaker by K/D)
    // Only considers players from this team, not all players
    const sortByMVPsWithKD = (a: any, b: any) => {
      if (b.mvps !== a.mvps) return b.mvps - a.mvps
      return b.kd - a.kd // Em caso de empate, melhor K/D
    }
    
    const sortByKD = (a: any, b: any) => {
      return b.kd - a.kd
    }
    
    // First, try to find MVP among players with at least one MVP
    let teamMVP = playersWithStats
      .filter(p => p.mvps > 0)
      .sort(sortByMVPsWithKD)[0]
    
    // If no player has MVP, select the one with best K/D
    if (!teamMVP) {
      teamMVP = playersWithStats
        .filter(p => p.totalKills > 0 || p.totalDeaths > 0) // Pelo menos uma estatística
        .sort(sortByKD)[0]
    }
    
    const mvpPlayerId = teamMVP?.id || null
    
    // Calculate total MVPs for team
    const totalMVPs = playersWithStats.reduce((sum, p) => sum + (p.mvps || 0), 0)
    
    // Calculate wins by game
    const winsByGame = new Map<string, number>()
    matches?.forEach(match => {
      if (match.winner_team_id === team.id && match.series) {
        const series = match.series as any
        const game = series.games as any
        if (game) {
          const gameName = game.name || 'Unknown'
          winsByGame.set(gameName, (winsByGame.get(gameName) || 0) + 1)
        }
      }
    })
    
    return {
      ...team,
      seriesWins,
      matchWins,
      totalMatches,
      matchWinRate,
      totalMVPs,
      players: playersWithStats,
      winsByGame: Array.from(winsByGame.entries()).map(([game, wins]) => ({ game, wins })),
      mvpPlayerId,
    }
  })

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <div className="mb-8 md:mb-12 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold text-white mb-3">
          TIMES
        </h1>
        <p className="text-lg md:text-xl text-neutral-300">
          Estatísticas completas dos times e jogadores
        </p>
      </div>

      <TeamsWithFilter 
        teamStats={teamStats || []} 
        games={games || []}
      />
    </div>
  )
}
