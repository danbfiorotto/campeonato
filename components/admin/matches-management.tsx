'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { MediaUploader } from './media-uploader'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Trash2, Edit } from 'lucide-react'

export function MatchesManagement() {
  const [series, setSeries] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingMatch, setEditingMatch] = useState<any>(null)
  const [selectedSeries, setSelectedSeries] = useState('')
  const [selectedWinner, setSelectedWinner] = useState('')
  const [selectedMVP, setSelectedMVP] = useState('')
  const [selectedPlayersRAC, setSelectedPlayersRAC] = useState<string[]>([])
  const [selectedPlayersAST, setSelectedPlayersAST] = useState<string[]>([])
  const supabase = createClient()

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

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateMatch = async () => {
    if (!selectedSeries) {
      alert('Selecione uma série')
      return
    }

    const selectedSeriesData = series.find(s => s.id === selectedSeries)
    if (!selectedSeriesData) return

    // Verificar se a série já está completa
    if (selectedSeriesData.is_completed) {
      alert('Esta série já foi concluída. Não é possível adicionar mais partidas.')
      return
    }

    // Get all existing match numbers for this series
    const { data: existingMatches, error: matchesError } = await supabase
      .from('matches')
      .select('match_number')
      .eq('series_id', selectedSeries)

    if (matchesError) {
      alert('Erro ao verificar partidas existentes: ' + matchesError.message)
      return
    }

    // Find the first available match number (1, 2, 3, etc.)
    const existingNumbers = new Set(existingMatches?.map(m => m.match_number) || [])
    const game = selectedSeriesData.games as any
    const maxMatches = game?.slug?.toLowerCase() === 'brawlhalla' ? 5 : 3
    
    // Encontrar o primeiro número disponível
    let matchNumber: number | null = null
    for (let i = 1; i <= maxMatches; i++) {
      if (!existingNumbers.has(i)) {
        matchNumber = i
        break
      }
    }

    // Se todos os números até o máximo estão ocupados
    if (matchNumber === null) {
      alert(`Esta série já possui ${maxMatches} partidas (máximo permitido para ${game?.name || 'este jogo'}).`)
      return
    }

    // Verificação final antes de inserir (evita race condition)
    const { data: finalCheck, error: checkError } = await supabase
      .from('matches')
      .select('match_number')
      .eq('series_id', selectedSeries)
      .eq('match_number', matchNumber)
      .maybeSingle()

    if (checkError) {
      alert('Erro ao verificar partidas: ' + checkError.message)
      return
    }

    if (finalCheck) {
      alert(`Erro: A partida número ${matchNumber} já existe nesta série. Por favor, recarregue a página e tente novamente.`)
      await loadData() // Recarregar dados para sincronizar
      return
    }

    // Get winner team if selected
    let winnerTeamId = null
    if (selectedWinner) {
      const racTeam = teams.find(t => t.name === 'RAC')
      const astTeam = teams.find(t => t.name === 'AST')
      const winnerTeam = selectedWinner === 'RAC' ? racTeam : astTeam

      if (!winnerTeam) {
        alert('Time não encontrado')
        return
      }
      winnerTeamId = winnerTeam.id
    }

    // Create match (winner and MVP are optional)
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        series_id: selectedSeries,
        match_number: matchNumber,
        winner_team_id: winnerTeamId,
        mvp_player_id: selectedMVP || null,
      })
      .select()
      .single()

    if (matchError) {
      // Tratamento específico para erro de constraint única
      let errorMessage = 'Erro ao criar partida'
      
      if (matchError.code === '23505' || 
          matchError.message?.includes('matches_series_id_match_number_key') ||
          matchError.message?.includes('duplicate key')) {
        errorMessage = `Erro: Já existe uma partida número ${matchNumber} nesta série. Por favor, recarregue a página e tente novamente.`
      } else if (matchError.message) {
        errorMessage = `Erro ao criar partida: ${matchError.message}`
      } else if (typeof matchError === 'string') {
        errorMessage = `Erro ao criar partida: ${matchError}`
      } else {
        errorMessage = `Erro ao criar partida. Código: ${matchError.code || 'desconhecido'}`
      }
      
      alert(errorMessage)
      console.error('Erro ao criar partida:', matchError)
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

    // Limpar formulário
    setDialogOpen(false)
    setSelectedSeries('')
    setSelectedWinner('')
    setSelectedMVP('')
    setSelectedPlayersRAC([])
    setSelectedPlayersAST([])
    
    // Recarregar dados para refletir mudanças
    await loadData()
  }

  const handleDeleteMatch = async (matchId: string) => {
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId)

    if (error) {
      alert('Erro ao excluir partida: ' + error.message)
      console.error('Erro ao excluir partida:', error)
      return
    }

    // Recarregar dados para refletir mudanças (o trigger do banco atualiza os scores automaticamente)
    await loadData()
  }

  const handleEditMatch = async (match: any) => {
    // Carregar dados da partida para edição
    const winner = match.teams as any
    const mvp = match.players as any
    
    // Carregar jogadores que participaram da partida
    const { data: matchPlayersData } = await supabase
      .from('match_players')
      .select('player_id, team_id')
      .eq('match_id', match.id)

    const racTeam = teams.find(t => t.name === 'RAC')
    const astTeam = teams.find(t => t.name === 'AST')

    const racPlayersIds = matchPlayersData
      ?.filter(mp => mp.team_id === racTeam?.id)
      .map(mp => mp.player_id) || []
    
    const astPlayersIds = matchPlayersData
      ?.filter(mp => mp.team_id === astTeam?.id)
      .map(mp => mp.player_id) || []

    setEditingMatch(match)
    setSelectedSeries(match.series_id)
    setSelectedWinner(winner?.name === 'RAC' ? 'RAC' : winner?.name === 'AST' ? 'AST' : '')
    setSelectedMVP(mvp?.id || '')
    setSelectedPlayersRAC(racPlayersIds)
    setSelectedPlayersAST(astPlayersIds)
    setEditDialogOpen(true)
  }

  const handleUpdateMatch = async () => {
    if (!editingMatch || !selectedSeries) {
      alert('Erro: dados da partida não encontrados')
      return
    }

    const racTeam = teams.find(t => t.name === 'RAC')
    const astTeam = teams.find(t => t.name === 'AST')

    // Get winner team if selected
    let winnerTeamId = null
    if (selectedWinner) {
      const winnerTeam = selectedWinner === 'RAC' ? racTeam : astTeam
      if (!winnerTeam) {
        alert('Time não encontrado')
        return
      }
      winnerTeamId = winnerTeam.id
    }

    // Update match
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        winner_team_id: winnerTeamId,
        mvp_player_id: selectedMVP || null,
      })
      .eq('id', editingMatch.id)

    if (updateError) {
      alert('Erro ao atualizar partida: ' + updateError.message)
      return
    }

    // Update match players
    // First, delete existing match_players
    const { error: deleteError } = await supabase
      .from('match_players')
      .delete()
      .eq('match_id', editingMatch.id)

    if (deleteError) {
      alert('Erro ao atualizar jogadores: ' + deleteError.message)
      return
    }

    // Then, insert new match_players
    const allPlayerIds = [...selectedPlayersRAC, ...selectedPlayersAST]
    if (allPlayerIds.length > 0) {
      const matchPlayersData = allPlayerIds.map(playerId => {
        const player = players.find(p => p.id === playerId)
        const teamId = selectedPlayersRAC.includes(playerId) ? racTeam?.id : astTeam?.id
        return {
          match_id: editingMatch.id,
          player_id: playerId,
          team_id: teamId
        }
      }).filter(mp => mp.team_id) // Filter out any without team_id

      if (matchPlayersData.length > 0) {
        const { error: insertError } = await supabase
          .from('match_players')
          .insert(matchPlayersData)

        if (insertError) {
          alert('Erro ao atualizar jogadores: ' + insertError.message)
          return
        }
      }
    }

    // Limpar formulário
    setEditDialogOpen(false)
    setEditingMatch(null)
    setSelectedSeries('')
    setSelectedWinner('')
    setSelectedMVP('')
    setSelectedPlayersRAC([])
    setSelectedPlayersAST([])

    // Recarregar dados
    await loadData()
  }

  const racTeam = useMemo(() => teams.find(t => t.name === 'RAC'), [teams])
  const astTeam = useMemo(() => teams.find(t => t.name === 'AST'), [teams])
  const racPlayers = useMemo(() => players.filter(p => p.team_id === racTeam?.id), [players, racTeam])
  const astPlayers = useMemo(() => players.filter(p => p.team_id === astTeam?.id), [players, astTeam])
  const availableMVPPlayers = useMemo(() => [
    ...players.filter(p => selectedPlayersRAC.includes(p.id)),
    ...players.filter(p => selectedPlayersAST.includes(p.id))
  ], [players, selectedPlayersRAC, selectedPlayersAST])

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
                <Select value={selectedSeries || ''} onValueChange={setSelectedSeries}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma série" />
                  </SelectTrigger>
                  <SelectContent>
                    {series.map(s => {
                      const game = s.games as any
                      return (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {game?.name || 'Série'}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="winner">Vencedor (opcional)</Label>
                <Select value={selectedWinner || 'none'} onValueChange={(value) => setSelectedWinner(value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o vencedor (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não definido</SelectItem>
                    <SelectItem value="RAC">RAC</SelectItem>
                    <SelectItem value="AST">AST</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-neutral-500">
                  Você pode criar a partida sem resultado e preencher depois
                </p>
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
                          if (checked === true) {
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
                          if (checked === true) {
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
                <Select value={selectedMVP || 'none'} onValueChange={(value) => setSelectedMVP(value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o MVP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {availableMVPPlayers.map(player => (
                      <SelectItem key={player.id} value={String(player.id)}>
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

      <div className="space-y-6">
        {matches.map((match) => {
          const game = (match.series as any)?.games as any
          const winner = match.teams as any
          const mvp = match.players as any
          const isRacWinner = winner?.name === 'RAC'
          const isAstWinner = winner?.name === 'AST'

          return (
            <Card 
              key={match.id}
              className={`neon-card transition-all duration-300 ${
                isRacWinner ? 'neon-card-rac' : isAstWinner ? 'neon-card-ast' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white font-heading">
                      {game?.name || 'Jogo'} - Partida {match.match_number}
                    </CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      onClick={() => handleEditMatch(match)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-neutral-900 border-neutral-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Excluir Partida</AlertDialogTitle>
                          <AlertDialogDescription className="text-neutral-400">
                            Tem certeza que deseja excluir esta partida? Esta ação não pode ser desfeita.
                            <br /><br />
                            <span className="font-semibold text-white">
                              {game?.name || 'Jogo'} - Partida {match.match_number}
                            </span>
                            <br />
                            Vencedor: {winner?.name || 'Não definido'}
                            <br /><br />
                            O placar da série será recalculado automaticamente após a exclusão.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteMatch(match.id)}
                            className="bg-red-600 hover:bg-red-500 text-white"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-300 text-sm font-medium">Vencedor:</span>
                      {winner ? (
                        <Badge 
                          className={
                            isRacWinner 
                              ? 'bg-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.6)]' 
                              : isAstWinner
                              ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)]'
                              : 'bg-gray-600'
                          }
                        >
                          {winner.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-neutral-800/50 text-neutral-400 border-neutral-600">
                          Não definido
                        </Badge>
                      )}
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
                  
                  {/* Uploader de Mídia */}
                  <div className="pt-4 border-t border-neutral-700">
                    <MediaUploader matchId={match.id} onMediaAdded={loadData} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-neutral-900 border-neutral-700">
          <DialogHeader>
            <DialogTitle className="text-white font-heading">Editar Partida</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Atualize os dados da partida {editingMatch?.match_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-winner">Vencedor (opcional)</Label>
              <Select value={selectedWinner || 'none'} onValueChange={(value) => setSelectedWinner(value === 'none' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vencedor (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não definido</SelectItem>
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
                      id={`edit-rac-${player.id}`}
                      checked={selectedPlayersRAC.includes(player.id)}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
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
                      htmlFor={`edit-rac-${player.id}`}
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
                      id={`edit-ast-${player.id}`}
                      checked={selectedPlayersAST.includes(player.id)}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
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
                      htmlFor={`edit-ast-${player.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {player.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-mvp">MVP (opcional)</Label>
              <Select value={selectedMVP || 'none'} onValueChange={(value) => setSelectedMVP(value === 'none' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o MVP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {availableMVPPlayers.map(player => (
                    <SelectItem key={player.id} value={String(player.id)}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateMatch} className="bg-blue-600 hover:bg-blue-500">
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

