'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function SeriesManagement() {
  const [series, setSeries] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedGame, setSelectedGame] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [seriesRes, gamesRes] = await Promise.all([
      supabase
        .from('series')
        .select(`
          *,
          games (*),
          teams!series_winner_team_id_fkey (*)
        `)
        .order('created_at'),
      supabase
        .from('games')
        .select('*')
        .order('name')
    ])

    if (seriesRes.data) setSeries(seriesRes.data)
    if (gamesRes.data) setGames(gamesRes.data)
    setLoading(false)
  }

  const handleCreateSeries = async () => {
    if (!selectedGame) return

    const { error } = await supabase
      .from('series')
      .insert({
        game_id: selectedGame,
        date: selectedDate || null,
      })

    if (error) {
      alert('Erro ao criar série: ' + error.message)
      return
    }

    setDialogOpen(false)
    setSelectedGame('')
    setSelectedDate('')
    loadData()
  }

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
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-white">Séries</h2>
          <p className="text-neutral-400 text-sm mt-1">Gerencie os confrontos entre RAC e AST</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]">
              Nova Série
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 border-neutral-700">
            <DialogHeader>
              <DialogTitle className="text-white font-heading">Criar Nova Série</DialogTitle>
              <DialogDescription className="text-neutral-400">
                Crie uma nova série de confronto entre RAC e AST
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="game">Jogo</Label>
                <Select value={selectedGame} onValueChange={setSelectedGame}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um jogo" />
                  </SelectTrigger>
                  <SelectContent>
                    {games
                      .filter(game => !series.some(s => s.game_id === game.id && !s.is_completed))
                      .map(game => (
                        <SelectItem key={game.id} value={game.id}>
                          {game.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data (opcional)</Label>
                <Input
                  id="date"
                  type="datetime-local"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateSeries}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {series.map((serie) => {
          const game = serie.games as any
          const winner = serie.teams as any
          const isRacWinner = winner?.name === 'RAC'
          const isAstWinner = winner?.name === 'AST'

          return (
            <Card 
              key={serie.id}
              className={`neon-card transition-all duration-300 hover:scale-105 ${
                isRacWinner ? 'neon-card-rac' : isAstWinner ? 'neon-card-ast' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white font-heading">{game?.name || 'Jogo'}</CardTitle>
                    <CardDescription className="text-neutral-400 mt-1">
                      {serie.date 
                        ? new Date(serie.date).toLocaleDateString('pt-BR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                        : 'Sem data definida'
                      }
                    </CardDescription>
                  </div>
                  {serie.is_completed ? (
                    <Badge className="bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]">
                      Concluído
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 bg-yellow-500/10">
                      Em andamento
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {serie.is_completed ? (
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
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-300 text-sm font-medium">Placar:</span>
                      <span className="text-white font-bold text-lg">
                        {serie.score_rac} x {serie.score_ast}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-neutral-400 text-sm">
                    Série ainda não concluída
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

