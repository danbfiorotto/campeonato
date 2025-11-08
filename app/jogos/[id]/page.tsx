import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { notFound } from 'next/navigation'

export default async function SerieDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  
  const { data: serie } = await supabase
    .from('series')
    .select(`
      *,
      games (*),
      teams!series_winner_team_id_fkey (*)
    `)
    .eq('id', params.id)
    .single()
  
  if (!serie) {
    notFound()
  }
  
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      teams!matches_winner_team_id_fkey (*),
      players!matches_mvp_player_id_fkey (*)
    `)
    .eq('series_id', params.id)
    .order('match_number')
  
  const { data: matchPlayers } = await supabase
    .from('match_players')
    .select(`
      *,
      players (*),
      matches (*)
    `)
    .in('match_id', matches?.map(m => m.id) || [])

  const game = serie.games as any
  const winner = serie.teams as any

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{game?.name || 'Série'}</h1>
        <p className="text-muted-foreground">
          Detalhes das partidas desta série
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Resumo da Série</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {serie.is_completed ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Vencedor:</span>
                  <Badge 
                    variant="default"
                    className={winner?.name === 'RAC' ? 'bg-rac' : 'bg-ast'}
                  >
                    {winner?.name || 'N/A'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Placar Final:</span>
                  <span className="text-lg">
                    {serie.score_rac} x {serie.score_ast}
                  </span>
                </div>
              </>
            ) : (
              <Badge variant="outline">Em andamento</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Partidas</h2>
        {matches && matches.length > 0 ? (
          matches.map((match) => {
            const matchWinner = match.teams as any
            const mvp = match.players as any
            const playersInMatch = matchPlayers?.filter(mp => mp.match_id === match.id)
            
            return (
              <Card key={match.id}>
                <CardHeader>
                  <CardTitle>Partida {match.match_number}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Vencedor:</span>
                      <Badge 
                        variant="default"
                        className={matchWinner?.name === 'RAC' ? 'bg-rac' : 'bg-ast'}
                      >
                        {matchWinner?.name || 'N/A'}
                      </Badge>
                    </div>
                    {mvp && (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">MVP:</span>
                        <Badge variant="secondary">{mvp.name}</Badge>
                      </div>
                    )}
                    {playersInMatch && playersInMatch.length > 0 && (
                      <div>
                        <span className="font-semibold">Jogadores:</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {playersInMatch.map((mp: any) => (
                            <Badge key={mp.player_id} variant="outline">
                              {mp.players?.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {match.note && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-semibold">Observação:</span> {match.note}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma partida registrada ainda
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

