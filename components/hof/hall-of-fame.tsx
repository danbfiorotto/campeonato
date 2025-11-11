'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HallCards } from './hall-cards'
import { Trophy, Users, Gamepad2 } from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState<'mvps' | 'matches'>('mvps')
  const [mvps, setMvps] = useState<any[]>([])
  const [mostMatches, setMostMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [selectedGame, activeTab])

  const loadData = async () => {
    setLoading(true)

    if (activeTab === 'mvps') {
      await loadMVPs()
    } else {
      await loadMostMatches()
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

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-neutral-400" />
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
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'mvps' | 'matches')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-neutral-900 border-neutral-700">
          <TabsTrigger value="mvps" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Top MVPs
          </TabsTrigger>
          <TabsTrigger value="matches" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Mais Partidas
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
      </Tabs>
    </div>
  )
}

