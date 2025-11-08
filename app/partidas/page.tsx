import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function PartidasPage() {
  const supabase = await createClient()
  
  const { data: matches } = await supabase
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Todas as Partidas</h1>
        <p className="text-muted-foreground">
          Histórico completo de todas as partidas disputadas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partidas</CardTitle>
        </CardHeader>
        <CardContent>
          {matches && matches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jogo</TableHead>
                  <TableHead>Partida</TableHead>
                  <TableHead>Vencedor</TableHead>
                  <TableHead>MVP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => {
                  const game = (match.series as any)?.games as any
                  const winner = match.teams as any
                  const mvp = match.players as any
                  
                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">
                        {game?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        Partida {match.match_number}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="default"
                          className={winner?.name === 'RAC' ? 'bg-rac' : 'bg-ast'}
                        >
                          {winner?.name || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {mvp ? (
                          <Badge variant="secondary">{mvp.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma partida registrada ainda
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

