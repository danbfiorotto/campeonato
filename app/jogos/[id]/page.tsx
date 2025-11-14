import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'
import { getSeriesFormat, getWinsNeeded } from '@/lib/utils/series'
import { ExternalLink, Video } from 'lucide-react'
import { Gallery } from '@/components/media/gallery'
import { ScoreDisplay } from '@/components/score/score-display'
import { SeriesCompletionCelebration } from '@/components/series/series-completion-celebration'
import { PublicMediaUploader } from '@/components/media/public-media-uploader'

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

  // Verificar se o usuário é admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    let { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    
    if (!profile) {
      const { data: profile2 } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      profile = profile2
    }
    
    isAdmin = profile?.role === 'super' || profile?.role === 'rac' || profile?.role === 'ast'
  }

  // Carregar mídia aprovada (público) ou aprovadas + pendentes (admin)
  const mediaQuery = supabase
    .from('match_media')
    .select('*')
    .in('match_id', matches?.map(m => m.id) || [])
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    // Público vê apenas mídia aprovada
    mediaQuery.eq('status', 'approved')
  } else {
    // Admin vê aprovadas e pendentes (não rejeitadas)
    mediaQuery.in('status', ['approved', 'pending'])
  }

  const { data: allMedia } = await mediaQuery

  // Buscar stream ativo para esta série (se houver)
  const { data: activeStream } = await supabase
    .from('streams')
    .select('*')
    .eq('series_id', params.id)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const game = serie.games as any
  const winner = serie.teams as any

  const winnerName = winner?.name as 'RAC' | 'AST' | undefined

  return (
    <div className="container mx-auto px-4 py-8">
      <SeriesCompletionCelebration 
        isCompleted={serie.is_completed}
        winner={winnerName}
        scoreRac={serie.score_rac}
        scoreAst={serie.score_ast}
      />
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{game?.name || 'Série'}</h1>
        <p className="text-muted-foreground">
          Detalhes das partidas desta série
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Resumo da Série</CardTitle>
            {activeStream && (
              <a
                href={activeStream.twitch_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md transition-colors"
              >
                <Video className="w-4 h-4" />
                Assistir ao Vivo
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
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
                  <ScoreDisplay 
                    scoreRac={serie.score_rac} 
                    scoreAst={serie.score_ast} 
                    size="md"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Status:</span>
                  <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 bg-yellow-500/10">
                    Em andamento
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Placar Atual:</span>
                  <ScoreDisplay 
                    scoreRac={serie.score_rac} 
                    scoreAst={serie.score_ast} 
                    size="md"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Formato:</span>
                  <Badge variant="outline">
                    {getSeriesFormat(game?.slug)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Vitórias necessárias:</span>
                  <span className="text-sm text-muted-foreground">
                    {getWinsNeeded(game?.slug)} vitórias
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Galeria de Provas */}
      {allMedia && allMedia.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Prova Placar</CardTitle>
          </CardHeader>
          <CardContent>
            <Gallery media={allMedia} isAdmin={isAdmin} />
          </CardContent>
        </Card>
      )}

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
                      {matchWinner ? (
                        <Badge 
                          variant="default"
                          className={matchWinner.name === 'RAC' ? 'bg-rac' : 'bg-ast'}
                        >
                          {matchWinner.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-neutral-800/50 text-neutral-400 border-neutral-600">
                          Não definido
                        </Badge>
                      )}
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

                    {/* Upload público de prints - disponível para todos */}
                    <PublicMediaUploader 
                      matchId={match.id} 
                      matchNumber={match.match_number} 
                    />
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

