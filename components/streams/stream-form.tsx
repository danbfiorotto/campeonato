'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface Game {
  id: string
  name: string
  slug: string
}

interface Series {
  id: string
  games: Game
}

interface StreamFormProps {
  games: Game[]
  series: Series[]
}

export function StreamForm({ games, series }: StreamFormProps) {
  const [twitchUrl, setTwitchUrl] = useState('')
  const [selectedGame, setSelectedGame] = useState<string>('')
  const [selectedSeries, setSelectedSeries] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  const validateTwitchUrl = (url: string): boolean => {
    const twitchPattern = /^(https?:\/\/)?(www\.)?(twitch\.tv|m\.twitch\.tv)\/.+/
    return twitchPattern.test(url)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!twitchUrl.trim()) {
      setMessage({ type: 'error', text: 'Por favor, insira um link da Twitch' })
      return
    }

    if (!validateTwitchUrl(twitchUrl)) {
      setMessage({ type: 'error', text: 'Por favor, insira um link válido da Twitch (ex: https://twitch.tv/usuario)' })
      return
    }

    setLoading(true)

    try {
      // Obter ID do usuário atual (se logado)
      const { data: { user } } = await supabase.auth.getUser()
      const createdBy = user?.id || null

      // Calcular data de expiração (24 horas)
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)

      const { error } = await supabase
        .from('streams')
        .insert({
          twitch_url: twitchUrl.trim(),
          game_id: selectedGame ? selectedGame : null,
          series_id: selectedSeries ? selectedSeries : null,
          created_by: createdBy,
          expires_at: expiresAt.toISOString(),
          is_active: true
        })

      if (error) {
        throw error
      }

      setMessage({ type: 'success', text: 'Stream adicionado com sucesso! Ele ficará visível por 24 horas.' })
      setTwitchUrl('')
      setSelectedGame('')
      setSelectedSeries('')
      
      // Recarregar página após 1 segundo
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error: any) {
      console.error('Erro ao adicionar stream:', error)
      setMessage({ type: 'error', text: 'Erro ao adicionar stream: ' + (error.message || 'Erro desconhecido') })
    } finally {
      setLoading(false)
    }
  }

  // Filtrar séries baseado no jogo selecionado
  const filteredSeries = selectedGame
    ? series.filter(s => s.games?.id === selectedGame)
    : series

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="twitch-url">Link da Twitch *</Label>
        <Input
          id="twitch-url"
          type="url"
          placeholder="https://twitch.tv/usuario"
          value={twitchUrl}
          onChange={(e) => setTwitchUrl(e.target.value)}
          required
          className="bg-neutral-800 border-neutral-700"
        />
        <p className="text-xs text-neutral-500">
          Exemplo: https://twitch.tv/seu_canal
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="game">Jogo (opcional)</Label>
        <Select value={selectedGame || undefined} onValueChange={(value) => {
          setSelectedGame(value)
          if (!value) setSelectedSeries('')
        }}>
          <SelectTrigger className="bg-neutral-800 border-neutral-700">
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
        {selectedGame && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedGame('')
              setSelectedSeries('')
            }}
            className="text-xs text-neutral-400 hover:text-neutral-300"
          >
            Limpar seleção
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="series">Série (opcional)</Label>
        <Select 
          value={selectedSeries || undefined} 
          onValueChange={setSelectedSeries}
          disabled={!selectedGame}
        >
          <SelectTrigger className="bg-neutral-800 border-neutral-700">
            <SelectValue placeholder={selectedGame ? "Selecione uma série" : "Selecione um jogo primeiro"} />
          </SelectTrigger>
          <SelectContent>
            {filteredSeries.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.games?.name || 'Série'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedSeries && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedSeries('')}
            className="text-xs text-neutral-400 hover:text-neutral-300"
          >
            Limpar seleção
          </Button>
        )}
      </div>

      {message && (
        <Alert className={message.type === 'success' ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
          <AlertDescription className={message.type === 'success' ? 'text-green-400' : 'text-red-400'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        className="w-full bg-purple-600 hover:bg-purple-500 text-white"
        disabled={loading}
      >
        {loading ? 'Adicionando...' : 'Adicionar Stream'}
      </Button>
    </form>
  )
}

