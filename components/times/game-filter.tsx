'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Gamepad2 } from 'lucide-react'

interface GameFilterProps {
  games: Array<{ id: string; name: string; slug: string }>
  selectedGameId: string | null
  onGameChange: (gameId: string | null) => void
}

export function GameFilter({ games, selectedGameId, onGameChange }: GameFilterProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Gamepad2 className="w-5 h-5 text-neutral-400" />
      <Select
        value={selectedGameId || 'all'}
        onValueChange={(value) => onGameChange(value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-[250px] bg-neutral-900/50 border-neutral-700">
          <SelectValue placeholder="Filtrar por jogo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os jogos</SelectItem>
          {games.map((game) => (
            <SelectItem key={game.id} value={game.id}>
              {game.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedGameId && (
        <span className="text-sm text-neutral-400">
          Mostrando apenas jogadores deste jogo
        </span>
      )}
    </div>
  )
}





