'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HallCards } from './hall-cards'
import { StatBarChart } from './stat-bar-chart'
import { Trophy, Users, Gamepad2, Target, Zap, Shield, TrendingUp } from 'lucide-react'

interface Game {
  id: string
  name: string
  slug: string
}

interface HallOfFameProps {
  games: Game[]
}

export function HallOfFame({ games }: HallOfFameProps) {
  const [selectedGame, setSelectedGame] = useState<string>('all')
  const [selectedGameForStats, setSelectedGameForStats] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'mvps' | 'matches' | 'stats'>('mvps')
  const [mvps, setMvps] = useState<any[]>([])
  const [mostMatches, setMostMatches] = useState<any[]>([])
  const [gameStats, setGameStats] = useState<any>({
    kills: [],
    assists: [],
    deaths: [],
    kda: [],
    maxDeaths: 1
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [selectedGame, activeTab, selectedGameForStats])

  const loadData = async () => {
    setLoading(true)

    if (activeTab === 'mvps') {
      await loadMVPs()
    } else if (activeTab === 'matches') {
      await loadMostMatches()
    } else if (activeTab === 'stats') {
      await loadGameStats()
    }

    setLoading(false)
  }

  const loadMVPs = async () => {
    // Primeiro, buscar todas as partidas com MVP
    let query = supabase
      .from('matches')
      .select(`
        mvp_player_id,
        players!matches_mvp_player_id_fkey (
          id,
          name,
          team_id,
          teams (*)
        ),
        series!inner (
          game_id,
          games (*)
        )
      `)
      .not('mvp_player_id', 'is', null)

    // Aplicar filtro por jogo se selecionado
    if (selectedGame !== 'all') {
      query = query.eq('series.game_id', selectedGame)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao carregar MVPs:', error)
      return
    }

    // Agregar MVPs por jogador
    const mvpCounts = new Map<string, {
      player: any
      count: number
      games: Set<string>
    }>()

    data?.forEach((match: any) => {
      const playerId = match.mvp_player_id
      const player = match.players
      const game = match.series?.games

      if (!playerId || !player) return

      const existing = mvpCounts.get(playerId) || {
        player,
        count: 0,
        games: new Set<string>()
      }

      existing.count++
      if (game) {
        existing.games.add(game.name)
      }

      mvpCounts.set(playerId, existing)
    })

    // Converter para array e ordenar
    const sorted = Array.from(mvpCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20) // Top 20

    setMvps(sorted)
  }

  const loadMostMatches = async () => {
    // Buscar todas as participações em partidas
    let query = supabase
      .from('match_players')
      .select(`
        player_id,
        players (
          id,
          name,
          team_id,
          teams (*)
        ),
        matches!inner (
          series!inner (
            game_id,
            games (*)
          )
        )
      `)

    // Aplicar filtro por jogo se selecionado
    if (selectedGame !== 'all') {
      query = query.eq('matches.series.game_id', selectedGame)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao carregar partidas:', error)
      return
    }

    // Agregar partidas por jogador
    const matchCounts = new Map<string, {
      player: any
      count: number
      games: Set<string>
    }>()

    data?.forEach((mp: any) => {
      const playerId = mp.player_id
      const player = mp.players
      const game = mp.matches?.series?.games

      if (!playerId || !player) return

      const existing = matchCounts.get(playerId) || {
        player,
        count: 0,
        games: new Set<string>()
      }

      existing.count++
      if (game) {
        existing.games.add(game.name)
      }

      matchCounts.set(playerId, existing)
    })

    // Converter para array e ordenar
    const sorted = Array.from(matchCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20) // Top 20

    setMostMatches(sorted)
  }

  const loadGameStats = async () => {
    if (!selectedGameForStats) {
      setGameStats({ kills: [], assists: [], deaths: [], kda: [], maxDeaths: 1 })
      return
    }

    // Primeiro, buscar todos os matches do jogo selecionado
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id,
        series!inner (
          game_id
        )
      `)
      .eq('series.game_id', selectedGameForStats)

    if (matchesError) {
      console.error('Erro ao carregar matches:', matchesError)
      return
    }

    if (!matches || matches.length === 0) {
      setGameStats({ kills: [], assists: [], deaths: [], kda: [] })
      return
    }

    const matchIds = matches.map(m => m.id)

    // Buscar todas as estatísticas de jogadores para esses matches
    const { data: stats, error } = await supabase
      .from('player_match_stats')
      .select(`
        player_id,
        kills,
        deaths,
        assists,
        kda,
        players (
          id,
          name,
          team_id,
          teams (*)
        )
      `)
      .in('match_id', matchIds)

    if (error) {
      console.error('Erro ao carregar estatísticas:', error)
      return
    }

    // Agregar estatísticas por jogador
    const playerStats = new Map<string, {
      player: any
      totalKills: number
      totalDeaths: number
      totalAssists: number
      matchCount: number
    }>()

    stats?.forEach((stat: any) => {
      const playerId = stat.player_id
      const player = stat.players

      if (!playerId || !player) return

      const existing = playerStats.get(playerId) || {
        player,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        matchCount: 0
      }

      existing.totalKills += stat.kills || 0
      existing.totalDeaths += stat.deaths || 0
      existing.totalAssists += stat.assists || 0
      existing.matchCount++

      playerStats.set(playerId, existing)
    })

    // Calcular médias e criar rankings
    const allPlayers = Array.from(playerStats.values()).map(p => {
      // Recalcular K/D: kills / deaths (sem assists)
      const deaths = Math.max(1, p.totalDeaths) // Evitar divisão por zero
      const kda = p.totalKills / deaths
      
      return {
        player: p.player,
        kills: p.totalKills,
        deaths: p.totalDeaths,
        assists: p.totalAssists,
        kda: kda,
        matchCount: p.matchCount
      }
    })

    // Calcular maxValues ANTES de fazer slice (importante para deaths invertido)
    const maxDeaths = Math.max(...allPlayers.map(p => p.deaths), 1)

    // Ordenar por cada categoria
    // Deaths: ordenar por MENOS deaths (ascendente) - quem morre menos é melhor
    // IMPORTANTE: a.deaths - b.deaths ordena de forma ASCENDENTE (menor primeiro)
    const sortedDeaths = [...allPlayers]
      .sort((a, b) => {
        // Garantir ordenação ascendente: menos deaths primeiro
        if (a.deaths < b.deaths) return -1
        if (a.deaths > b.deaths) return 1
        return 0
      })
      .slice(0, 10)
    
    setGameStats({
      kills: [...allPlayers].sort((a, b) => b.kills - a.kills).slice(0, 10),
      assists: [...allPlayers].sort((a, b) => b.assists - a.assists).slice(0, 10),
      deaths: sortedDeaths,
      kda: [...allPlayers].sort((a, b) => b.kda - a.kda).slice(0, 10),
      maxDeaths: maxDeaths // Guardar para usar no gráfico
    })
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-neutral-400" />
          {activeTab !== 'stats' ? (
            <Select value={selectedGame} onValueChange={setSelectedGame}>
              <SelectTrigger className="w-[200px] bg-neutral-800 border-neutral-700">
                <SelectValue placeholder="Filtrar por jogo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os jogos</SelectItem>
                {games.map(game => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={selectedGameForStats} onValueChange={setSelectedGameForStats}>
              <SelectTrigger className="w-[200px] bg-neutral-800 border-neutral-700">
                <SelectValue placeholder="Selecione um jogo" />
              </SelectTrigger>
              <SelectContent>
                {games.map(game => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'mvps' | 'matches' | 'stats')} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-neutral-900 border-neutral-700">
          <TabsTrigger value="mvps" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Top MVPs
          </TabsTrigger>
          <TabsTrigger value="matches" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Mais Partidas
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Estatísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mvps" className="mt-6">
          {loading ? (
            <div className="text-center py-12 text-neutral-400">Carregando...</div>
          ) : (
            <HallCards 
              players={mvps} 
              type="mvp"
              selectedGame={selectedGame}
            />
          )}
        </TabsContent>

        <TabsContent value="matches" className="mt-6">
          {loading ? (
            <div className="text-center py-12 text-neutral-400">Carregando...</div>
          ) : (
            <HallCards 
              players={mostMatches} 
              type="matches"
              selectedGame={selectedGame}
            />
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          {!selectedGameForStats ? (
            <div className="text-center py-12 text-neutral-400">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Selecione um jogo para ver as estatísticas</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12 text-neutral-400">Carregando...</div>
          ) : (
            <div className="space-y-6">
              {/* Header com nome do jogo */}
              <div className="bg-gradient-to-r from-neutral-900/80 via-neutral-800/60 to-neutral-900/80 border border-neutral-800/50 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">
                      {games.find(g => g.id === selectedGameForStats)?.name || 'Estatísticas'}
                    </h2>
                    <p className="text-neutral-400 text-sm">Rankings e estatísticas detalhadas</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30">
                    <Gamepad2 className="w-8 h-8 text-blue-400" />
                  </div>
                </div>
              </div>

              {/* Grid de Estatísticas */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Mais Kills */}
                <div className="bg-gradient-to-br from-neutral-900/80 to-neutral-800/40 border border-red-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-red-500/40 transition-all shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                        <Target className="w-6 h-6 text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Mais Kills</h3>
                        <p className="text-xs text-neutral-400 mt-1">Top {gameStats.kills.length} jogadores</p>
                      </div>
                    </div>
                  </div>
                  <StatBarChart 
                    data={gameStats.kills.map((p: any) => ({
                      player: p.player,
                      count: p.kills
                    }))}
                    type="kills"
                    maxValue={gameStats.kills[0]?.kills || 1}
                  />
                </div>

                {/* Mais Assists */}
                <div className="bg-gradient-to-br from-neutral-900/80 to-neutral-800/40 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-blue-500/40 transition-all shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                        <Zap className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Mais Assists</h3>
                        <p className="text-xs text-neutral-400 mt-1">Top {gameStats.assists.length} jogadores</p>
                      </div>
                    </div>
                  </div>
                  <StatBarChart 
                    data={gameStats.assists.map((p: any) => ({
                      player: p.player,
                      count: p.assists
                    }))}
                    type="assists"
                    maxValue={gameStats.assists[0]?.assists || 1}
                  />
                </div>

                {/* Menos Deaths */}
                <div className="bg-gradient-to-br from-neutral-900/80 to-neutral-800/40 border border-purple-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-purple-500/40 transition-all shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                        <Shield className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Menos Deaths</h3>
                        <p className="text-xs text-neutral-400 mt-1">Top {gameStats.deaths.length} jogadores (menos mortes)</p>
                      </div>
                    </div>
                  </div>
                  <StatBarChart 
                    data={gameStats.deaths.map((p: any) => ({
                      player: p.player,
                      count: p.deaths
                    }))}
                    type="deaths"
                    maxValue={gameStats.maxDeaths || 1}
                    inverted={true}
                  />
                </div>

                {/* Melhor KDA */}
                <div className="bg-gradient-to-br from-neutral-900/80 to-neutral-800/40 border border-yellow-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-yellow-500/40 transition-all shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Melhor KDA</h3>
                        <p className="text-xs text-neutral-400 mt-1">Top {gameStats.kda.length} jogadores</p>
                      </div>
                    </div>
                  </div>
                  <StatBarChart 
                    data={gameStats.kda.map((p: any) => ({
                      player: p.player,
                      count: p.kda
                    }))}
                    type="kda"
                    maxValue={gameStats.kda[0]?.kda || 1}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

