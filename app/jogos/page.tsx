import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { getSeriesFormat, getWinsNeeded } from '@/lib/utils/series'

export default async function JogosPage() {
  const supabase = await createClient()
  
  const { data: series } = await supabase
    .from('series')
    .select(`
      *,
      games (*),
      teams!series_winner_team_id_fkey (*)
    `)
    .order('created_at')
  
  const { data: teams } = await supabase.from('teams').select('*')

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Jogos e Modalidades</h1>
        <p className="text-muted-foreground">
          Confrontos entre RAC e AST em cada modalidade
        </p>
      </div>

      <div className="grid gap-6">
        {series?.map((serie) => {
          const game = serie.games as any
          const winner = serie.teams as any
          const racTeam = teams?.find(t => t.name === 'RAC')
          const astTeam = teams?.find(t => t.name === 'AST')
          
          return (
            <Card key={serie.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{game?.name || 'Jogo'}</CardTitle>
                    <CardDescription>{game?.slug || ''}</CardDescription>
                  </div>
                  {serie.is_completed ? (
                    <Badge 
                      className={winner?.name === 'RAC' ? 'bg-rac' : 'bg-ast'}
                    >
                      Concluído
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pendente</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {serie.is_completed ? (
                  <div className="space-y-2">
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
                      <span className="font-semibold">Placar da Série:</span>
                      <span className="text-lg">
                        {serie.score_rac} x {serie.score_ast}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Placar Atual:</span>
                      <span className="text-lg font-bold">
                        {serie.score_rac} x {serie.score_ast}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Formato:</span>
                      <Badge variant="outline" className="text-xs">
                        {getSeriesFormat(game?.slug)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Vitórias necessárias:</span>
                      <span className="text-sm font-medium">
                        {getWinsNeeded(game?.slug)} vitórias
                      </span>
                    </div>
                    {serie.date && (
                      <div className="pt-2 border-t text-muted-foreground text-sm">
                        Agendado para {new Date(serie.date).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4">
                  <Link 
                    href={`/jogos/${serie.id}`}
                    className="text-primary hover:underline text-sm"
                  >
                    Ver detalhes das partidas →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

