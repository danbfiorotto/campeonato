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
    return <div>Carregando...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Séries</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Nova Série</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Série</DialogTitle>
              <DialogDescription>
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

      <div className="grid gap-4">
        {series.map((serie) => {
          const game = serie.games as any
          const winner = serie.teams as any

          return (
            <Card key={serie.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{game?.name || 'Jogo'}</CardTitle>
                    <CardDescription>
                      {serie.date 
                        ? new Date(serie.date).toLocaleDateString('pt-BR')
                        : 'Sem data definida'
                      }
                    </CardDescription>
                  </div>
                  {serie.is_completed ? (
                    <Badge className="bg-green-500">Concluído</Badge>
                  ) : (
                    <Badge variant="outline">Em andamento</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {serie.is_completed ? (
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold">Vencedor: </span>
                      <Badge className={winner?.name === 'RAC' ? 'bg-rac' : 'bg-ast'}>
                        {winner?.name || 'N/A'}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-semibold">Placar: </span>
                      {serie.score_rac} x {serie.score_ast}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
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

