'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

export function MatchesManagement() {
  const [series, setSeries] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSeries, setSelectedSeries] = useState('')
  const [selectedWinner, setSelectedWinner] = useState('')
  const [selectedMVP, setSelectedMVP] = useState('')
  const [selectedPlayersRAC, setSelectedPlayersRAC] = useState<string[]>([])
  const [selectedPlayersAST, setSelectedPlayersAST] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [seriesRes, playersRes, teamsRes, matchesRes] = await Promise.all([
      supabase
        .from('series')
        .select(`
          *,
          games (*)
        `)
        .order('created_at'),
      supabase
        .from('players')
        .select('*')
        .order('name'),
      supabase
        .from('teams')
        .select('*'),
      supabase
        .from('matches')
        .select(`
          *,
          series (
            games (*)
          ),
          teams!matches_winner_team_id_fkey (*),
          players!matches_mvp_player_id_fkey (*)
        `)
        .order('created_at', { ascending: false })
    ])

    if (seriesRes.data) setSeries(seriesRes.data.filter(s => !s.is_completed))
    if (playersRes.data) setPlayers(playersRes.data)
    if (teamsRes.data) setTeams(teamsRes.data)
    if (matchesRes.data) setMatches(matchesRes.data)
    setLoading(false)
  }

  const handleCreateMatch = async () => {
    if (!selectedSeries || !selectedWinner) {
      alert('Preencha todos os campos obrigatórios')
      return
    }

    const selectedSeriesData = series.find(s => s.id === selectedSeries)
    if (!selectedSeriesData) return

    // Get current match count for this series
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('match_number')
      .eq('series_id', selectedSeries)
      .order('match_number', { ascending: false })
      .limit(1)

    const matchNumber = existingMatches && existingMatches.length > 0 
      ? existingMatches[0].match_number + 1 
      : 1

    if (matchNumber > 3) {
      alert('Uma série pode ter no máximo 3 partidas')
      return
    }

    const racTeam = teams.find(t => t.name === 'RAC')
    const astTeam = teams.find(t => t.name === 'AST')
    const winnerTeam = selectedWinner === 'RAC' ? racTeam : astTeam

    if (!winnerTeam) {
      alert('Time não encontrado')
      return
    }

    // Create match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        series_id: selectedSeries,
        match_number: matchNumber,
        winner_team_id: winnerTeam.id,
        mvp_player_id: selectedMVP || null,
      })
      .select()
      .single()

    if (matchError) {
      alert('Erro ao criar partida: ' + matchError.message)
      return
    }

    // Add match players
    const allSelectedPlayers = [...selectedPlayersRAC, ...selectedPlayersAST]
    if (allSelectedPlayers.length > 0) {
      const matchPlayersData = allSelectedPlayers.map(playerId => {
        const player = players.find(p => p.id === playerId)
        return {
          match_id: match.id,
          player_id: playerId,
          team_id: player?.team_id,
        }
      })

      const { error: mpError } = await supabase
        .from('match_players')
        .insert(matchPlayersData)

      if (mpError) {
        alert('Erro ao adicionar jogadores: ' + mpError.message)
        return
      }
    }

    setDialogOpen(false)
    setSelectedSeries('')
    setSelectedWinner('')
    setSelectedMVP('')
    setSelectedPlayersRAC([])
    setSelectedPlayersAST([])
    loadData()
  }

  const racPlayers = players.filter(p => {
    const racTeam = teams.find(t => t.name === 'RAC')
    return p.team_id === racTeam?.id
  })

  const astPlayers = players.filter(p => {
    const astTeam = teams.find(t => t.name === 'AST')
    return p.team_id === astTeam?.id
  })

  const availableMVPPlayers = [
    ...players.filter(p => selectedPlayersRAC.includes(p.id)),
    ...players.filter(p => selectedPlayersAST.includes(p.id))
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-neutral-400">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-white">Partidas</h2>
          <p className="text-neutral-400 text-sm mt-1">Registre e gerencie as partidas das séries</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]">
              Nova Partida
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-neutral-900 border-neutral-700">
            <DialogHeader>
              <DialogTitle className="text-white font-heading">Criar Nova Partida</DialogTitle>
              <DialogDescription className="text-neutral-400">
                Registre uma nova partida de uma série
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="series">Série</Label>
                <Select value={selectedSeries} onValueChange={setSelectedSeries}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma série" />
                  </SelectTrigger>
                  <SelectContent>
                    {series.map(s => {
                      const game = s.games as any
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {game?.name || 'Série'}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="winner">Vencedor</Label>
                <Select value={selectedWinner} onValueChange={setSelectedWinner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o vencedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAC">RAC</SelectItem>
                    <SelectItem value="AST">AST</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Jogadores RAC</Label>
                <div className="border rounded-md p-4 space-y-2 max-h-40 overflow-y-auto">
                  {racPlayers.map(player => (
                    <div key={player.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`rac-${player.id}`}
                        checked={selectedPlayersRAC.includes(player.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPlayersRAC([...selectedPlayersRAC, player.id])
                          } else {
                            setSelectedPlayersRAC(selectedPlayersRAC.filter(id => id !== player.id))
                            if (selectedMVP === player.id) {
                              setSelectedMVP('')
                            }
                          }
                        }}
                      />
                      <label
                        htmlFor={`rac-${player.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {player.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Jogadores AST</Label>
                <div className="border rounded-md p-4 space-y-2 max-h-40 overflow-y-auto">
                  {astPlayers.map(player => (
                    <div key={player.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`ast-${player.id}`}
                        checked={selectedPlayersAST.includes(player.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPlayersAST([...selectedPlayersAST, player.id])
                          } else {
                            setSelectedPlayersAST(selectedPlayersAST.filter(id => id !== player.id))
                            if (selectedMVP === player.id) {
                              setSelectedMVP('')
                            }
                          }
                        }}
                      />
                      <label
                        htmlFor={`ast-${player.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {player.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mvp">MVP (opcional)</Label>
                <Select value={selectedMVP || undefined} onValueChange={(value) => setSelectedMVP(value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o MVP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {availableMVPPlayers.map(player => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateMatch}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {matches.map((match) => {
          const game = (match.series as any)?.games as any
          const winner = match.teams as any
          const mvp = match.players as any
          const isRacWinner = winner?.name === 'RAC'
          const isAstWinner = winner?.name === 'AST'

          return (
            <Card 
              key={match.id}
              className={`neon-card transition-all duration-300 hover:scale-105 ${
                isRacWinner ? 'neon-card-rac' : isAstWinner ? 'neon-card-ast' : ''
              }`}
            >
              <CardHeader>
                <CardTitle className="text-white font-heading">
                  {game?.name || 'Jogo'} - Partida {match.match_number}
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                  {mvp && (
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-300 text-sm font-medium">MVP:</span>
                      <Badge variant="secondary" className="bg-purple-600/20 text-purple-300 border-purple-500/50">
                        ⭐ {mvp.name}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

