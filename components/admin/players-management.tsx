'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Image from 'next/image'

export function PlayersManagement() {
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [userProfile, setUserProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<any>(null)
  const [playerName, setPlayerName] = useState('')
  const [playerTeam, setPlayerTeam] = useState('')
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [playerGames, setPlayerGames] = useState<Record<string, any[]>>({})
  const supabase = createClient()

  const loadUserProfile = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Erro ao obter usuário:', userError)
        }
        setProfileLoading(false)
        return
      }
      
      if (!user) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Nenhum usuário autenticado')
        }
        setProfileLoading(false)
        return
      }

      // Tentar buscar por id primeiro, depois por user_id
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      // Se não encontrar por id, tentar por user_id
      if (error || !profile) {
        const { data: profile2, error: error2 } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
        
        if (error2 && process.env.NODE_ENV === 'development') {
          console.error('Erro ao carregar perfil:', error2)
        } else if (profile2) {
          profile = profile2
        }
      }
      
      if (profile) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Perfil carregado:', { role: profile.role, team_id: profile.team_id })
        }
        setUserProfile(profile)
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('Perfil não encontrado para o usuário:', user.id)
      }
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error)
    } finally {
      setProfileLoading(false)
    }
  }, [supabase])

  const loadData = useCallback(async () => {
    const [playersRes, teamsRes, gamesRes] = await Promise.all([
      supabase
        .from('players')
        .select('*')
        .order('name'),
      supabase
        .from('teams')
        .select('*')
        .order('name'),
      supabase
        .from('games')
        .select('*')
        .order('name')
    ])

    if (playersRes.data) {
      setPlayers(playersRes.data)
      // Carregar jogos de cada jogador
      const playerGamesMap: Record<string, any[]> = {}
      for (const player of playersRes.data) {
        const { data: pgData } = await supabase
          .from('player_games')
          .select('game_id')
          .eq('player_id', player.id)
        if (pgData) {
          playerGamesMap[player.id] = pgData.map(pg => pg.game_id)
        }
      }
      setPlayerGames(playerGamesMap)
    }
    if (teamsRes.data) setTeams(teamsRes.data)
    if (gamesRes.data) setGames(gamesRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([loadData(), loadUserProfile()])
    }
    initialize()
  }, [loadData, loadUserProfile])


  const handleCreatePlayer = async () => {
    if (!playerName || !playerTeam) {
      alert('Preencha todos os campos')
      return
    }

    // Verificar permissão: admin_rac e admin_ast só podem criar jogadores do próprio time
    if (userProfile && userProfile.role !== 'super') {
      if (String(userProfile.team_id) !== String(playerTeam)) {
        alert('Você só pode adicionar jogadores ao seu próprio time')
        return
      }
    }

    const { data: newPlayer, error } = await supabase
      .from('players')
      .insert({
        name: playerName,
        team_id: playerTeam,
      })
      .select()
      .single()

    if (error) {
      alert('Erro ao criar jogador: ' + error.message)
      return
    }

    // Inserir jogos selecionados
    if (newPlayer && selectedGames.length > 0) {
      const playerGamesToInsert = selectedGames.map(gameId => ({
        player_id: newPlayer.id,
        game_id: gameId,
      }))

      const { error: pgError } = await supabase
        .from('player_games')
        .insert(playerGamesToInsert)

      if (pgError) {
        console.error('Erro ao associar jogos:', pgError)
      }
    }

    setDialogOpen(false)
    setPlayerName('')
    setPlayerTeam('')
    setSelectedGames([])
    loadData()
  }

  const handleEditPlayer = async (player: any) => {
    setEditingPlayer(player)
    setPlayerName(player.name)
    setPlayerTeam(player.team_id)
    
    // Carregar jogos do jogador
    const { data: pgData } = await supabase
      .from('player_games')
      .select('game_id')
      .eq('player_id', player.id)
    
    if (pgData) {
      setSelectedGames(pgData.map(pg => pg.game_id))
    } else {
      setSelectedGames([])
    }
    
    setDialogOpen(true)
  }

  const handleUpdatePlayer = async () => {
    if (!editingPlayer || !playerName || !playerTeam) return

    // Verificar permissão: admin_rac e admin_ast só podem editar jogadores do próprio time
    if (userProfile && userProfile.role !== 'super') {
      if (String(userProfile.team_id) !== String(editingPlayer.team_id)) {
        alert('Você só pode editar jogadores do seu próprio time')
        return
      }
      // Não permitir mudar o time se não for super admin
      if (String(playerTeam) !== String(editingPlayer.team_id)) {
        alert('Você não pode transferir jogadores entre times')
        return
      }
    }

    const { error } = await supabase
      .from('players')
      .update({
        name: playerName,
        team_id: playerTeam,
      })
      .eq('id', editingPlayer.id)

    if (error) {
      alert('Erro ao atualizar jogador: ' + error.message)
      return
    }

    // Atualizar jogos do jogador
    // Primeiro, remover todas as associações existentes
    await supabase
      .from('player_games')
      .delete()
      .eq('player_id', editingPlayer.id)

    // Depois, inserir as novas associações
    if (selectedGames.length > 0) {
      const playerGamesToInsert = selectedGames.map(gameId => ({
        player_id: editingPlayer.id,
        game_id: gameId,
      }))

      const { error: pgError } = await supabase
        .from('player_games')
        .insert(playerGamesToInsert)

      if (pgError) {
        console.error('Erro ao atualizar jogos:', pgError)
      }
    }

    setDialogOpen(false)
    setEditingPlayer(null)
    setPlayerName('')
    setPlayerTeam('')
    setSelectedGames([])
    loadData()
  }

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Tem certeza que deseja excluir este jogador?')) return

    // Verificar permissão: admin_rac e admin_ast só podem deletar jogadores do próprio time
    const player = players.find(p => p.id === playerId)
    if (userProfile && userProfile.role !== 'super' && player) {
      if (String(userProfile.team_id) !== String(player.team_id)) {
        alert('Você só pode excluir jogadores do seu próprio time')
        return
      }
    }

    // Check if player has matches
    const { data: matchPlayers } = await supabase
      .from('match_players')
      .select('match_id')
      .eq('player_id', playerId)
      .limit(1)

    if (matchPlayers && matchPlayers.length > 0) {
      alert('Não é possível excluir jogador que já participou de partidas')
      return
    }

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)

    if (error) {
      alert('Erro ao excluir jogador: ' + error.message)
      return
    }

    loadData()
  }

  // Função auxiliar para verificar se pode editar/deletar um jogador
  const canManagePlayer = (player: any) => {
    // Se ainda está carregando o perfil, permite temporariamente (evita mostrar "Sem permissão" antes de carregar)
    if (profileLoading) {
      return true
    }
    
    // Se não tem perfil carregado após o loading, não permite
    if (!userProfile) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Perfil do usuário não encontrado - bloqueando acesso')
      }
      return false
    }
    
    // Super admin pode tudo
    if (userProfile.role === 'super') {
      return true
    }
    
    // Admin de time só pode gerenciar jogadores do próprio time
    if (userProfile.team_id && player.team_id) {
      return String(userProfile.team_id) === String(player.team_id)
    }
    
    return false
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingPlayer(null)
    setPlayerName('')
    setPlayerTeam('')
    setSelectedGames([])
  }

  const toggleGame = (gameId: string) => {
    setSelectedGames(prev => 
      prev.includes(gameId)
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    )
  }

  const racPlayers = players.filter(p => {
    const racTeam = teams.find(t => t.name === 'RAC')
    return p.team_id === racTeam?.id
  })

  const astPlayers = players.filter(p => {
    const astTeam = teams.find(t => t.name === 'AST')
    return p.team_id === astTeam?.id
  })

  if (loading || profileLoading) {
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
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-white">Jogadores</h2>
          <p className="text-neutral-400 text-sm mt-1">Gerencie os jogadores de cada time</p>
        </div>
        <Button 
          onClick={() => {
            setEditingPlayer(null)
            setPlayerName('')
            setSelectedGames([])
            // Pré-selecionar o time do admin se não for super admin
            if (userProfile && userProfile.role !== 'super' && userProfile.team_id) {
              setPlayerTeam(userProfile.team_id)
            } else {
              setPlayerTeam('')
            }
            setDialogOpen(true)
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]"
        >
          Novo Jogador
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            handleDialogClose()
          } else if (!editingPlayer && userProfile && userProfile.role !== 'super' && userProfile.team_id) {
            // Quando abrir para criar novo jogador e não for super admin, pré-seleciona o time
            setPlayerTeam(userProfile.team_id)
          }
        }}>
          <DialogContent className="bg-neutral-900 border-neutral-700">
            <DialogHeader>
              <DialogTitle className="text-white font-heading">
                {editingPlayer ? 'Editar Jogador' : 'Criar Novo Jogador'}
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
                {editingPlayer 
                  ? 'Atualize as informações do jogador'
                  : 'Adicione um novo jogador ao campeonato'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Nome do jogador"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team">Time</Label>
                <Select 
                  value={playerTeam || ''} 
                  onValueChange={setPlayerTeam}
                  disabled={userProfile?.role !== 'super'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o time" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams
                      .filter(team => {
                        // Se não for super admin e estiver criando novo jogador, só mostra o próprio time
                        if (userProfile?.role !== 'super' && editingPlayer === null) {
                          return team.id === userProfile?.team_id
                        }
                        // Se estiver editando e não for super admin, só mostra o time do jogador
                        if (userProfile?.role !== 'super' && editingPlayer) {
                          return team.id === editingPlayer.team_id
                        }
                        return true
                      })
                      .map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {userProfile?.role !== 'super' && (
                  <p className="text-xs text-muted-foreground">
                    {editingPlayer 
                      ? 'Você não pode alterar o time do jogador'
                      : 'Você só pode adicionar jogadores ao seu próprio time'
                    }
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Jogos</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {games.length > 0 ? (
                    games.map(game => (
                      <div key={game.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`game-${game.id}`}
                          checked={selectedGames.includes(game.id)}
                          onCheckedChange={() => toggleGame(game.id)}
                        />
                        <label
                          htmlFor={`game-${game.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {game.name}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum jogo cadastrado</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione os jogos que este jogador vai participar
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose}>
                Cancelar
              </Button>
              <Button onClick={editingPlayer ? handleUpdatePlayer : handleCreatePlayer}>
                {editingPlayer ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="neon-card-rac">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 md:w-16 md:h-16">
                <Image
                  src="/logo-rac.jpeg"
                  alt="Logo RAC"
                  fill
                  className="object-contain rounded-lg"
                  unoptimized
                />
              </div>
              <div>
                <CardTitle className="text-orange-400 font-heading text-xl">RAC</CardTitle>
                <CardDescription className="text-neutral-400">Jogadores do time RAC</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {racPlayers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-700">
                    <TableHead className="text-neutral-300 font-heading">Nome</TableHead>
                    <TableHead className="text-neutral-300 font-heading">Jogos</TableHead>
                    <TableHead className="text-right text-neutral-300 font-heading">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {racPlayers.map(player => (
                    <TableRow key={player.id} className="border-neutral-800 hover:bg-neutral-800/50">
                      <TableCell className="font-medium text-white">{player.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {playerGames[player.id]?.length > 0 ? (
                            playerGames[player.id].map((gameId: string) => {
                              const game = games.find(g => g.id === gameId)
                              return game ? (
                                <Badge 
                                  key={gameId} 
                                  variant="secondary" 
                                  className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/50"
                                >
                                  {game.name}
                                </Badge>
                              ) : null
                            })
                          ) : (
                            <span className="text-xs text-neutral-500">Nenhum jogo</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canManagePlayer(player) ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPlayer(player)}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePlayer(player.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                Excluir
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-neutral-500">
                              Sem permissão
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum jogador cadastrado
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="neon-card-ast">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 md:w-16 md:h-16">
                <Image
                  src="/logo-ast.jpeg"
                  alt="Logo AST"
                  fill
                  className="object-contain rounded-lg"
                  unoptimized
                />
              </div>
              <div>
                <CardTitle className="text-red-400 font-heading text-xl">AST</CardTitle>
                <CardDescription className="text-neutral-400">Jogadores do time AST</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {astPlayers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-700">
                    <TableHead className="text-neutral-300 font-heading">Nome</TableHead>
                    <TableHead className="text-neutral-300 font-heading">Jogos</TableHead>
                    <TableHead className="text-right text-neutral-300 font-heading">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {astPlayers.map(player => (
                    <TableRow key={player.id} className="border-neutral-800 hover:bg-neutral-800/50">
                      <TableCell className="font-medium text-white">{player.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {playerGames[player.id]?.length > 0 ? (
                            playerGames[player.id].map((gameId: string) => {
                              const game = games.find(g => g.id === gameId)
                              return game ? (
                                <Badge 
                                  key={gameId} 
                                  variant="secondary" 
                                  className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/50"
                                >
                                  {game.name}
                                </Badge>
                              ) : null
                            })
                          ) : (
                            <span className="text-xs text-neutral-500">Nenhum jogo</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canManagePlayer(player) ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPlayer(player)}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePlayer(player.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                Excluir
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-neutral-500">
                              Sem permissão
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum jogador cadastrado
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

