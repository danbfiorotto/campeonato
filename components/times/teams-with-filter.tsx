'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trophy, Users, Target, Award, TrendingUp, Gamepad2 } from 'lucide-react'
import { GameFilter } from './game-filter'

interface TeamsWithFilterProps {
  teamStats: any[]
  games: Array<{ id: string; name: string; slug: string }>
}

export function TeamsWithFilter({ teamStats, games }: TeamsWithFilterProps) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)

  // Filtrar jogadores baseado no jogo selecionado
  const filteredTeamStats = useMemo(() => {
    if (!selectedGameId) {
      return teamStats
    }

    return teamStats.map(team => ({
      ...team,
      players: team.players.filter((player: any) => {
        // Verificar se o jogador tem o jogo selecionado
        return player.games?.some((game: any) => game.id === selectedGameId)
      })
    }))
  }, [teamStats, selectedGameId])

  return (
    <>
      <GameFilter 
        games={games} 
        selectedGameId={selectedGameId}
        onGameChange={setSelectedGameId}
      />

      <div className="grid gap-8 md:gap-12 lg:grid-cols-2">
        {filteredTeamStats?.map((team) => {
          const isRac = team.name === 'RAC'
          const teamColor = isRac ? 'orange' : 'red'
          const logoPath = isRac ? '/logo-rac.jpeg' : '/logo-ast.jpeg'
          
          return (
            <Card 
              key={team.id} 
              className={`neon-card overflow-hidden ${
                isRac ? 'neon-card-rac' : 'neon-card-ast'
              }`}
            >
              {/* Team Header with Logo */}
              <CardHeader className={`relative pb-4 ${
                isRac 
                  ? 'bg-gradient-to-br from-orange-500/20 to-orange-900/10 border-b border-orange-500/30' 
                  : 'bg-gradient-to-br from-red-500/20 to-red-900/10 border-b border-red-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 ${
                      isRac ? 'border-orange-500/70' : 'border-red-500/70'
                    } shadow-lg`}>
                      <Image
                        src={logoPath}
                        alt={`${team.name} Logo`}
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="(max-width: 768px) 64px, 80px"
                      />
                    </div>
                    <div>
                      <CardTitle className={`text-2xl md:text-3xl font-heading font-bold ${
                        isRac ? 'text-orange-400' : 'text-red-400'
                      }`}>
                        {team.name}
                      </CardTitle>
                      <CardDescription className="text-neutral-300 mt-1">
                        {team.players.length} jogador{team.players.length !== 1 ? 'es' : ''}
                        {selectedGameId && ' (filtrado)'}
                      </CardDescription>
                    </div>
                  </div>
                  {team.seriesWins >= 3 && (
                    <Badge className={`${
                      isRac 
                        ? 'bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.6)]' 
                        : 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.6)]'
                    } text-sm md:text-base px-3 py-1.5`}>
                      <Trophy className="w-4 h-4 mr-1" />
                      Campeão
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {/* Statistics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className={`text-center p-4 rounded-lg ${
                    isRac ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    <TrendingUp className={`w-6 h-6 mx-auto mb-2 ${
                      isRac ? 'text-orange-400' : 'text-red-400'
                    }`} />
                    <div className="text-2xl font-bold text-white font-heading">{team.matchWinRate}%</div>
                    <div className="text-xs text-neutral-400 mt-1">Win Rate</div>
                  </div>
                  
                  <div className={`text-center p-4 rounded-lg ${
                    isRac ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    <Trophy className={`w-6 h-6 mx-auto mb-2 ${
                      isRac ? 'text-orange-400' : 'text-red-400'
                    }`} />
                    <div className="text-2xl font-bold text-white font-heading">{team.seriesWins}</div>
                    <div className="text-xs text-neutral-400 mt-1">Séries</div>
                  </div>
                  
                  <div className={`text-center p-4 rounded-lg ${
                    isRac ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    <Target className={`w-6 h-6 mx-auto mb-2 ${
                      isRac ? 'text-orange-400' : 'text-red-400'
                    }`} />
                    <div className="text-2xl font-bold text-white font-heading">{team.matchWins}</div>
                    <div className="text-xs text-neutral-400 mt-1">Partidas</div>
                  </div>
                  
                  <div className={`text-center p-4 rounded-lg ${
                    isRac ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    <Award className={`w-6 h-6 mx-auto mb-2 ${
                      isRac ? 'text-orange-400' : 'text-red-400'
                    }`} />
                    <div className="text-2xl font-bold text-white font-heading">{team.totalMVPs}</div>
                    <div className="text-xs text-neutral-400 mt-1">MVPs</div>
                  </div>
                </div>

                {/* Wins by Game */}
                {team.winsByGame.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-neutral-300 mb-3 flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4" />
                      Vitórias por Jogo
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {team.winsByGame.map(({ game, wins }: { game: string; wins: number }) => (
                        <Badge 
                          key={game}
                          variant="outline"
                          className={`${
                            isRac 
                              ? 'border-orange-500/50 text-orange-300 bg-orange-500/10' 
                              : 'border-red-500/50 text-red-300 bg-red-500/10'
                          }`}
                        >
                          {game}: {wins}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Players Table */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Jogadores
                  </h3>
                  {team.players && team.players.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-neutral-700">
                            <TableHead className="text-neutral-300 font-heading">Jogador</TableHead>
                            <TableHead className="text-neutral-300 font-heading text-center">Modalidades</TableHead>
                            <TableHead className="text-neutral-300 font-heading text-center">Jogos</TableHead>
                            <TableHead className="text-neutral-300 font-heading text-center">Vitórias</TableHead>
                            <TableHead className="text-neutral-300 font-heading text-center">MVPs</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {team.players.map((player: any, index: number) => {
                            const winRate = player.gamesPlayed > 0 
                              ? ((player.wins / player.gamesPlayed) * 100).toFixed(0) 
                              : '0'
                            const isMVP = team.mvpPlayerId === player.id
                            
                            return (
                              <TableRow 
                                key={player.id} 
                                className={`border-neutral-800 hover:bg-neutral-800/50 ${
                                  isMVP ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' : ''
                                }`}
                              >
                                <TableCell className="font-medium text-white">
                                  <div className="flex items-center gap-2">
                                    {isMVP && (
                                      <span className="text-yellow-400">⭐</span>
                                    )}
                                    {player.name}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {player.games && player.games.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 justify-center">
                                      {player.games.map((game: any) => (
                                        <Badge 
                                          key={game.id}
                                          variant="outline"
                                          className={`text-xs ${
                                            isRac 
                                              ? 'border-orange-500/30 text-orange-300 bg-orange-500/10' 
                                              : 'border-red-500/30 text-red-300 bg-red-500/10'
                                          }`}
                                        >
                                          {game.slug || game.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-neutral-600 text-sm">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center text-neutral-300">
                                  {player.gamesPlayed || 0}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex flex-col items-center">
                                    <span className="text-white font-semibold">{player.wins || 0}</span>
                                    {player.gamesPlayed > 0 && (
                                      <span className="text-xs text-neutral-500">({winRate}%)</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {player.mvps > 0 ? (
                                    <Badge 
                                      variant="secondary"
                                      className={`${
                                        isRac 
                                          ? 'bg-orange-500/20 text-orange-300 border-orange-500/50' 
                                          : 'bg-red-500/20 text-red-300 border-red-500/50'
                                      }`}
                                    >
                                      {player.mvps}
                                    </Badge>
                                  ) : (
                                    <span className="text-neutral-600">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400 text-center py-8">
                      {selectedGameId 
                        ? 'Nenhum jogador cadastrado para este jogo' 
                        : 'Nenhum jogador cadastrado'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}





