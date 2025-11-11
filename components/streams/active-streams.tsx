'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Video, Clock, Gamepad2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface Stream {
  id: string
  twitch_url: string
  game_id: string | null
  series_id: string | null
  created_at: string
  expires_at: string
  games: { name: string; slug: string } | null
  series: { id: string; games: { name: string } } | null
}

interface ActiveStreamsProps {
  streams: Stream[]
  isAdminSuper: boolean
}

export function ActiveStreams({ streams: initialStreams, isAdminSuper }: ActiveStreamsProps) {
  const [streams, setStreams] = useState(initialStreams)
  const supabase = createClient()

  const handleDeleteStream = async (streamId: string) => {
    const { error } = await supabase
      .from('streams')
      .delete()
      .eq('id', streamId)

    if (error) {
      alert('Erro ao deletar stream: ' + error.message)
      return
    }

    // Remover da lista local
    setStreams(streams.filter(s => s.id !== streamId))
  }

  if (streams.length === 0) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-700">
        <CardContent className="py-12 text-center">
          <Video className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400 text-lg mb-2">Nenhum stream ativo no momento</p>
          <p className="text-neutral-500 text-sm">
            Adicione um link de transmissão ao vivo para aparecer aqui
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white mb-4">
        Streams Ativos ({streams.length})
      </h2>
      
      <div className="grid gap-4">
        {streams.map((stream) => {
          const expiresAt = new Date(stream.expires_at)
          const timeRemaining = formatDistanceToNow(expiresAt, { 
            addSuffix: true
          })

          return (
            <Card 
              key={stream.id}
              className="bg-neutral-900/50 border-neutral-700 hover:border-purple-500/50 transition-colors"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Video className="w-5 h-5 text-purple-400" />
                      Transmissão ao Vivo
                    </CardTitle>
                    {stream.games && (
                      <div className="mt-2 flex items-center gap-2">
                        <Gamepad2 className="w-4 h-4 text-neutral-400" />
                        <Badge variant="outline" className="text-xs">
                          {stream.games.name}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className="border-green-500/50 text-green-400 bg-green-500/10"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {timeRemaining}
                    </Badge>
                    {isAdminSuper && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-neutral-900 border-neutral-700">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Excluir Stream</AlertDialogTitle>
                            <AlertDialogDescription className="text-neutral-400">
                              Tem certeza que deseja excluir este stream? Esta ação não pode ser desfeita.
                              <br /><br />
                              <span className="font-semibold text-white">
                                {stream.twitch_url}
                              </span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteStream(stream.id)}
                              className="bg-red-600 hover:bg-red-500 text-white"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-neutral-400">
                    <span>Link:</span>
                    <a
                      href={stream.twitch_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline truncate max-w-md"
                    >
                      {stream.twitch_url}
                    </a>
                  </div>

                  {stream.series && (
                    <div className="text-sm text-neutral-400">
                      <span>Série: </span>
                      <Link
                        href={`/jogos/${stream.series.id}`}
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        Ver série
                      </Link>
                    </div>
                  )}

                  <Button
                    onClick={() => window.open(stream.twitch_url, '_blank')}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Assistir na Twitch
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

